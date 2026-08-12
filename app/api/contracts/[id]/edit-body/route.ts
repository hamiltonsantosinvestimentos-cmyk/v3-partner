import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { cancelClickSignDocument } from "@/lib/clicksign";

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
// Se o contrato já tinha sido enviado ao ClickSign (enviado_assinatura), a
// rota agora CANCELA automaticamente o documento antigo (11/08/2026, ciclo
// ClickSign Fase 1: PATCH /envelopes/{id}/documents/{document_id}, status
// canceled, endpoint confirmado na documentação oficial da ClickSign) antes
// de resetar para "rascunho" — evita que o signatário assine a versão
// desatualizada. Se o cancelamento automático falhar (documento já
// finalizado, API fora do ar), a edição NÃO é bloqueada, mas o aviso de
// cancelamento manual continua na resposta, agora como fallback explícito
// de uma tentativa automática que não deu certo, não como único caminho.
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
    .select("id, rendered_html, status_signature, external_envelope_id, external_document_id")
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

  let cancelResult: { attempted: boolean; ok: boolean; error?: string } = { attempted: false, ok: false };

  const updates: Record<string, any> = { rendered_html };
  if (hadPendingEnvelope) {
    if (contract.external_document_id) {
      cancelResult.attempted = true;
      const result = await cancelClickSignDocument(contract.external_envelope_id!, contract.external_document_id);
      cancelResult.ok = result.ok;
      if (!result.ok) cancelResult.error = result.error;
    }
    // Contrato volta pra rascunho pra poder ser reenviado pela rota /send
    // normal, que gera envelope (e document_id) novo, independente do
    // cancelamento automático ter dado certo ou não.
    updates.status_signature = "rascunho";
    updates.external_envelope_id = null;
    updates.external_document_id = null;
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
      content: `Contrato editado: ${reason.trim()}${hadPendingEnvelope ? ` (cancelamento automático do envelope antigo: ${cancelResult.ok ? "sucesso" : cancelResult.attempted ? `falhou, ${cancelResult.error}` : "não tentado, sem document_id salvo"})` : ""}`,
    });
  }

  return NextResponse.json({
    success: true,
    reset_to_rascunho: hadPendingEnvelope,
    envelope_cancelado_automaticamente: hadPendingEnvelope ? cancelResult.ok : null,
    warning: hadPendingEnvelope && !cancelResult.ok
      ? "Este contrato já tinha sido enviado ao ClickSign. O cancelamento automático do envelope antigo falhou (ou não havia document_id salvo para tentar) — cancele manualmente no painel da ClickSign antes de reenviar."
      : null,
  });
}
