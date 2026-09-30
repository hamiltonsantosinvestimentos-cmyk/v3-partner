import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getProvider, type EsignatureProviderName } from "@/lib/esignature";
import { isNdaMesaContract, NDA_MESA_ROLES } from "@/lib/nda-mesa-operacoes";

// POST /api/mesa-op/nda-clientes/[contractId]/cancelar { motivo } — cancela um
// NDA (Mesa de operações) do painel "NDA para clientes" (30/09/2026):
//  - rascunho (nunca enviado): vai para a Lixeira; o gatilho do banco libera o
//    lote de qualificação, e o cliente volta a "Qualificado" no painel.
//  - enviado para assinatura: cancela o documento no provedor (ClickSign/
//    CertOne, o mesmo que criou o envelope) e marca status "cancelado".
//  - assinado: não cancela (409).
// Só vale para contratos desse template.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile || !NDA_MESA_ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { contractId } = await params;
  const { motivo } = (await req.json().catch(() => ({}))) as { motivo?: string };
  if (typeof motivo !== "string" || motivo.trim().length < 5) {
    return NextResponse.json({ error: "Informe o motivo do cancelamento (mínimo 5 caracteres)." }, { status: 422 });
  }

  const { data: contrato } = await db
    .from("operation_contracts")
    .select("id, template_id, contract_code, status_signature, external_envelope_id, external_document_id, esignature_provider, sent_to_signature_at, deleted_at")
    .eq("id", contractId)
    .maybeSingle();
  if (!contrato || contrato.deleted_at) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (!(await isNdaMesaContract(db, contrato.template_id as string | null))) {
    return NextResponse.json({ error: "Só NDAs do template \"NDA (Mesa de operações)\" podem ser cancelados por aqui." }, { status: 422 });
  }
  if (contrato.status_signature === "assinado") {
    return NextResponse.json({ error: "NDA já assinado não pode ser cancelado." }, { status: 409 });
  }
  if (contrato.status_signature === "cancelado") {
    return NextResponse.json({ error: "Este NDA já está cancelado." }, { status: 409 });
  }

  const autor = (profile as { full_name?: string | null }).full_name ?? "Mesa Operacional";

  // ── Rascunho: Lixeira + lote liberado pelo gatilho do banco ──
  if (contrato.status_signature === "rascunho" && !contrato.external_envelope_id && !contrato.sent_to_signature_at) {
    const { data: updated, error } = await db
      .from("operation_contracts")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        deletion_reason: `NDA cancelado pela Mesa: ${motivo.trim()}`,
        deletion_status: "approved",
      })
      .eq("id", contractId)
      .eq("status_signature", "rascunho")
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "O NDA mudou de estado. Recarregue a tela." }, { status: 409 });
    return NextResponse.json({ ok: true, modo: "rascunho", contract_code: contrato.contract_code });
  }

  // ── Enviado para assinatura: cancela no provedor e marca "cancelado" ──
  let provedor: { tentado: boolean; ok: boolean; erro?: string } = { tentado: false, ok: false };
  if (contrato.external_envelope_id && contrato.external_document_id) {
    provedor.tentado = true;
    try {
      const p = await getProvider({ contractId, provider: (contrato.esignature_provider as EsignatureProviderName | null) ?? undefined });
      const r = await p.cancel(contrato.external_envelope_id as string, contrato.external_document_id as string);
      provedor = { tentado: true, ok: r.ok, ...(r.ok ? {} : { erro: r.error }) };
    } catch (e) {
      provedor = { tentado: true, ok: false, erro: (e as Error).message };
    }
  }
  if (provedor.tentado && !provedor.ok) {
    return NextResponse.json({
      error: `Não foi possível cancelar no provedor de assinatura: ${provedor.erro ?? "erro desconhecido"}. O NDA continua ativo — tente de novo ou cancele direto no ClickSign/CertOne.`,
    }, { status: 502 });
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
    content: `NDA cancelado pela Mesa: ${motivo.trim()}${provedor.tentado ? " (documento cancelado no provedor de assinatura)" : " (sem envelope salvo no provedor)"}`,
  });

  return NextResponse.json({ ok: true, modo: "enviado", contract_code: contrato.contract_code, provedor_cancelado: provedor.ok });
}
