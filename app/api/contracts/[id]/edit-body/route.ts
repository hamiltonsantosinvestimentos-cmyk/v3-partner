import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("full_name, role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return { userId: user.id, name: profile.full_name ?? "Usuário", role: profile.role as string };
}

// PATCH /api/contracts/[id]/edit-body — corrige pontualmente o texto de um
// contrato JÁ GERADO (11/08/2026, pedido de João: cliente reporta problema
// numa cláusula via WhatsApp/e-mail — deal@/juridico@v3partners.com.br —
// não existe formulário público, o feedback chega por canal humano; esta
// rota é onde a Mesa aplica a correção e reenvia). Antes de hoje o campo
// rendered_html era imutável: nenhuma rota jamais escrevia nele depois do
// INSERT original em /api/contracts/generate.
//
// Se o contrato já tinha sido enviado ao ClickSign (enviado_assinatura), o
// envelope antigo fica órfão — ClickSign não permite editar documento em
// processo de assinatura. Esta rota NÃO cancela o envelope automaticamente
// (nenhuma função de cancelamento existe em lib/clicksign.ts hoje e não
// verificamos a API real de cancelamento ainda — não adivinhar contrato de
// API externa, regra do projeto). Reseta o contrato para "rascunho" e avisa
// explicitamente na resposta para cancelar o envelope antigo manualmente no
// painel da ClickSign antes de clicar "Enviar para Assinatura" de novo.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { rendered_html, reason } = await req.json();

  if (!rendered_html?.trim())
    return NextResponse.json({ error: "rendered_html obrigatório" }, { status: 422 });

  const db = svc();

  const { data: contract } = await db
    .from("operation_contracts")
    .select("id, rendered_html, status_signature, external_envelope_id")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (contract.status_signature === "assinado")
    return NextResponse.json({ error: "Contrato já assinado — não pode ser editado. Gere um novo instrumento (aditivo) se necessário." }, { status: 409 });
  if (contract.status_signature === "cancelado")
    return NextResponse.json({ error: "Contrato cancelado — não pode ser editado." }, { status: 409 });

  const hadPendingEnvelope = contract.status_signature === "enviado_assinatura" && !!contract.external_envelope_id;

  // Snapshot do texto anterior ANTES de sobrescrever — nunca perder versão.
  if (contract.rendered_html) {
    await db.from("operation_contract_versions").insert({
      contract_id: id,
      rendered_html: contract.rendered_html,
      edited_by: caller.userId,
      edited_by_name: caller.name,
      reason: reason?.trim() || null,
    });
  }

  const updates: Record<string, any> = { rendered_html };
  if (hadPendingEnvelope) {
    // Envelope antigo fica órfão no ClickSign — precisa ser cancelado lá
    // manualmente (ver comentário acima). Contrato volta pra rascunho pra
    // poder ser reenviado pela rota /send normal, que gera envelope novo.
    updates.status_signature = "rascunho";
    updates.external_envelope_id = null;
    updates.sent_to_signature_at = null;
  }

  const { error } = await db.from("operation_contracts").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (reason?.trim()) {
    await db.from("contract_notes").insert({
      contract_id: id,
      author_id: caller.userId,
      author_name: caller.name,
      note_type: "edicao_pos_geracao",
      content: `Contrato editado: ${reason.trim()}`,
    });
  }

  return NextResponse.json({
    success: true,
    reset_to_rascunho: hadPendingEnvelope,
    warning: hadPendingEnvelope
      ? "Este contrato já tinha sido enviado ao ClickSign. Cancele o envelope antigo manualmente no painel da ClickSign antes de reenviar — a plataforma não faz isso automaticamente."
      : null,
  });
}
