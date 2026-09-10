import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getProvider } from "@/lib/esignature";

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
    .select("id, rendered_html, status_signature, external_envelope_id, external_document_id, esignature_provider")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (contract.status_signature === "assinado")
    return NextResponse.json({ error: "Contrato já assinado — não pode ser editado. Gere um novo instrumento (aditivo) se necessário." }, { status: 409 });
  if (contract.status_signature === "cancelado")
    return NextResponse.json({ error: "Contrato cancelado — não pode ser editado." }, { status: 409 });

  const hadPendingEnvelope = contract.status_signature === "enviado_assinatura" && !!contract.external_envelope_id;

  let cancelResult: { attempted: boolean; ok: boolean; error?: string } = { attempted: false, ok: false };

  // Cancelamento no provedor real (ClickSign/CertOne) é uma chamada de rede
  // externa: não pode entrar na transação de banco abaixo, por isso
  // acontece ANTES, na aplicação, como sempre foi.
  if (hadPendingEnvelope && contract.external_document_id) {
    cancelResult.attempted = true;
    // Fase 3 (10/09/2026): usa sempre o provedor congelado no envio original
    // (esignature_provider), nunca a config atual da vertical -- o envelope
    // real vive no provedor que criou ele, não no que está configurado hoje.
    const result = await (await getProvider({ contractId: id, provider: contract.esignature_provider ?? undefined })).cancel(contract.external_envelope_id!, contract.external_document_id);
    cancelResult.ok = result.ok;
    if (!result.ok) cancelResult.error = result.error;
  }

  // Escrita atômica (08/09/2026, achado de governança de dados): antes esta
  // rota fazia o snapshot em operation_contract_versions e depois um UPDATE
  // separado (2 chamadas HTTP independentes ao banco), risco real de estado
  // inconsistente se a função serverless morresse entre as duas. A RPC
  // cancel_and_edit_contract() faz o snapshot e a transição
  // enviado_assinatura -> rascunho dentro da MESMA transação de banco,
  // atômica por construção do Postgres, independente do resultado do
  // cancelamento acima (o reset para rascunho sempre acontece, mesmo
  // padrão de antes: não trava a edição por falha externa da API de
  // assinatura).
  const { error } = await db.rpc("cancel_and_edit_contract", {
    p_contract_id: id,
    p_rendered_html: rendered_html,
    p_reason: reason?.trim() || null,
    p_editor_id: caller.userId,
    p_editor_name: caller.name,
  });
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
