import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getProvider, type EsignatureProviderName } from "@/lib/esignature";
import { enviosDoMandato, isMandatoCreditoContract, marcarEnvioCancelado } from "@/lib/mandato-credito";

// POST /api/mesa-credito/mandato/[contractId]/cancelar { motivo } — cancela um
// Mandato de Crédito enviado pelo botão "Mandato" do modal da proposta
// (12/10/2026, pedido do Hamilton: antes só dava para cancelar por fora,
// editando o contrato na Central). Mesmo fluxo do cancelamento de NDA da Mesa:
//  - rascunho (nunca enviado): vai para a Lixeira.
//  - enviado para assinatura: cancela o documento no provedor (ClickSign/
//    CertOne, o mesmo que criou o envelope) e marca status "cancelado".
//  - assinado: não cancela (409).
// O envio também fica marcado como cancelado em metadata.mandato_envios da proposta.

const ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { contractId } = await params;
  const { motivo } = (await req.json().catch(() => ({}))) as { motivo?: string };
  if (typeof motivo !== "string" || motivo.trim().length < 5) {
    return NextResponse.json({ error: "Informe o motivo do cancelamento (mínimo 5 caracteres)." }, { status: 422 });
  }

  const { data: contrato } = await db
    .from("operation_contracts")
    .select("id, template_id, contract_code, credit_proposal_id, status_signature, external_envelope_id, external_document_id, esignature_provider, sent_to_signature_at, deleted_at")
    .eq("id", contractId)
    .maybeSingle();
  if (!contrato || contrato.deleted_at) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (!(await isMandatoCreditoContract(db, contrato.template_id as string | null))) {
    return NextResponse.json({ error: "Só contratos de Mandato de Crédito podem ser cancelados por aqui." }, { status: 422 });
  }
  if (contrato.status_signature === "assinado") {
    return NextResponse.json({ error: "Mandato já assinado não pode ser cancelado." }, { status: 409 });
  }
  if (contrato.status_signature === "cancelado") {
    return NextResponse.json({ error: "Este mandato já está cancelado." }, { status: 409 });
  }

  const autor = (profile as { full_name?: string | null }).full_name ?? "Mesa";
  let modo: "rascunho" | "enviado";
  let provedorCancelado = false;

  if (contrato.status_signature === "rascunho" && !contrato.external_envelope_id && !contrato.sent_to_signature_at) {
    // ── Rascunho: Lixeira ──
    const { data: updated, error } = await db
      .from("operation_contracts")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        deletion_reason: `Mandato cancelado: ${motivo.trim()}`,
        deletion_status: "approved",
      })
      .eq("id", contractId)
      .eq("status_signature", "rascunho")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "O mandato mudou de estado. Recarregue a tela." }, { status: 409 });
    modo = "rascunho";
  } else {
    // ── Enviado para assinatura: cancela no provedor e marca "cancelado" ──
    if (contrato.external_envelope_id && contrato.external_document_id) {
      let erro: string | undefined;
      try {
        const p = await getProvider({ contractId, provider: (contrato.esignature_provider as EsignatureProviderName | null) ?? undefined });
        const r = await p.cancel(contrato.external_envelope_id as string, contrato.external_document_id as string);
        if (!r.ok) erro = r.error ?? "erro desconhecido";
      } catch (e) {
        erro = (e as Error).message;
      }
      if (erro) {
        return NextResponse.json({
          error: `Não foi possível cancelar no provedor de assinatura: ${erro}. O mandato continua ativo, tente de novo ou cancele direto no ClickSign/CertOne.`,
        }, { status: 502 });
      }
      provedorCancelado = true;
    }

    const { error } = await db
      .from("operation_contracts")
      .update({ status_signature: "cancelado", updated_at: new Date().toISOString() })
      .eq("id", contractId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await db.from("contract_notes").insert({
      contract_id: contractId,
      author_id: user.id,
      author_name: autor,
      note_type: "sistema",
      content: `Mandato cancelado: ${motivo.trim()}${provedorCancelado ? " (documento cancelado no provedor de assinatura)" : " (sem envelope salvo no provedor)"}`,
    });
    modo = "enviado";
  }

  // Histórico na proposta (best effort: o cancelamento já valeu).
  let metadata: Record<string, unknown> | null = null;
  if (contrato.credit_proposal_id) {
    const { data: prop } = await db
      .from("credit_desk_proposals")
      .select("metadata")
      .eq("id", contrato.credit_proposal_id)
      .maybeSingle();
    const atual = (prop?.metadata ?? {}) as Record<string, unknown>;
    const envios = enviosDoMandato(atual);
    if (envios.some((e) => e.contract_id === contractId)) {
      metadata = {
        ...atual,
        mandato_envios: marcarEnvioCancelado(envios, contractId, { em: new Date().toISOString(), por: autor, motivo: motivo.trim() }),
      };
      const { error } = await db.from("credit_desk_proposals").update({ metadata }).eq("id", contrato.credit_proposal_id);
      if (error) metadata = null;
    }
  }

  return NextResponse.json({ ok: true, modo, contract_code: contrato.contract_code, provedor_cancelado: provedorCancelado, metadata });
}
