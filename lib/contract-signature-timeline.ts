// lib/contract-signature-timeline.ts
//
// Registra na linha do tempo do contrato (contract_notes, tipo "sistema") o que o
// provedor de assinatura informa: cada assinatura individual e o fechamento do
// envelope. Compartilhado pelo webhook do ClickSign (tempo real) e pela rota
// "Atualizar status das assinaturas" (recupera o que um webhook perdeu).
//
// Achado real de 21/09/2026, com o NCNDA de teste V3C-NDA-2026-0037: o webhook
// do ClickSign estava ativo e entregando (HMAC ok), mas o handler procurava o
// contrato por external_envelope_id usando document.key, que é o id do
// DOCUMENTO (o mesmo valor de external_document_id). Nenhum evento sign ou
// close chegava ao contrato, então 7 assinaturas reais não apareciam em lugar
// nenhum do portal. Mesmo padrão nos contratos de 10 a 40 dias parados em
// "enviado_assinatura".
import type { SupabaseClient } from "@supabase/supabase-js";

// contract_notes.author_id tem FK real para auth.users(id); mesmo UUID real já
// usado como autor de sistema em app/api/cron/clicksign-sync e relatorios/ingest.
export const SYSTEM_USER_ID = "d0af8eaa-9f3c-4e7a-b8c6-613736524317";
export const SIGNATURE_AUTHOR_NAME = "ClickSign";

export interface ContractForTimeline {
  id: string;
  parties: Array<{ email?: string | null; name?: string | null }> | null;
}

export interface SignatureEvent {
  name: string;
  email: string;
  signedAt: string | null;
}

export type RecordResult = "criada" | "ja_registrada" | "erro";

function signatoryCount(parties: ContractForTimeline["parties"]): number {
  return (parties ?? []).filter((p) => p.email?.trim()).length;
}

/**
 * Grava "NOME assinou digitalmente no ClickSign (n de N)." uma única vez por
 * signatário (idempotente: o ClickSign reenvia entregas e a rota de atualização
 * pode rodar várias vezes). A nota usa a data real da assinatura.
 */
export async function recordSignatureNote(
  db: SupabaseClient,
  contract: ContractForTimeline,
  ev: SignatureEvent,
): Promise<RecordResult> {
  const nome = (ev.name ?? "").trim() || ev.email;

  const { data: existentes, error: readError } = await db
    .from("contract_notes")
    .select("content")
    .eq("contract_id", contract.id)
    .eq("note_type", "sistema")
    .eq("author_name", SIGNATURE_AUTHOR_NAME);
  if (readError) {
    console.error(`[contract-signature-timeline] falha ao ler notas do contrato ${contract.id}:`, readError.message);
    return "erro";
  }

  const assinaturas = (existentes ?? []).filter((n) => typeof n.content === "string" && n.content.includes(" assinou digitalmente"));
  if (assinaturas.some((n) => (n.content as string).startsWith(`${nome} assinou digitalmente`))) return "ja_registrada";

  const total = signatoryCount(contract.parties);
  const content = `${nome} assinou digitalmente no ClickSign${total > 0 ? ` (${assinaturas.length + 1} de ${total})` : ""}.`;

  const { error } = await db.from("contract_notes").insert({
    contract_id: contract.id,
    author_id: SYSTEM_USER_ID,
    author_name: SIGNATURE_AUTHOR_NAME,
    note_type: "sistema",
    content,
    ...(ev.signedAt ? { created_at: ev.signedAt } : {}),
  });
  if (error) {
    console.error(`[contract-signature-timeline] falha ao gravar nota de assinatura do contrato ${contract.id}:`, error.message);
    return "erro";
  }
  return "criada";
}

/**
 * Marca o contrato como assinado quando o envelope fecha (todos assinaram) e
 * registra o fechamento na linha do tempo. Devolve true só quando fez a
 * transição agora (false se já estava assinado ou se a gravação falhou).
 */
export async function applyEnvelopeClosed(
  db: SupabaseClient,
  contract: { id: string; status_signature: string },
  signedAtIso: string,
): Promise<boolean> {
  if (contract.status_signature === "assinado") return false;

  const { error } = await db
    .from("operation_contracts")
    .update({ status_signature: "assinado", signed_at: signedAtIso })
    .eq("id", contract.id);
  if (error) {
    console.error(`[contract-signature-timeline] falha ao marcar o contrato ${contract.id} como assinado:`, error.message);
    return false;
  }

  const content = "Envelope fechado no ClickSign: todos os signatários assinaram.";
  const { data: jaTem } = await db
    .from("contract_notes")
    .select("id")
    .eq("contract_id", contract.id)
    .eq("note_type", "sistema")
    .eq("content", content)
    .limit(1);
  if (!jaTem || jaTem.length === 0) {
    const { error: noteError } = await db.from("contract_notes").insert({
      contract_id: contract.id,
      author_id: SYSTEM_USER_ID,
      author_name: SIGNATURE_AUTHOR_NAME,
      note_type: "sistema",
      content,
      created_at: signedAtIso,
    });
    if (noteError) console.error(`[contract-signature-timeline] falha ao gravar nota de fechamento do contrato ${contract.id}:`, noteError.message);
  }
  return true;
}

// Id de documento/envelope do ClickSign é UUID. Valida antes de interpolar em filtro .or().
export function isSafeProviderId(value: string): boolean {
  return /^[0-9a-zA-Z-]{8,64}$/.test(value);
}
