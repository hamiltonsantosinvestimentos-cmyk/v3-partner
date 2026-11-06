// Reserva da Idempotency-Key antes de criar a proposta (BRIEF ajustes de segurança, 06/11/2026).
// A chave primária (key_id, idempotency_key) garante que só uma chamada cria; as outras esperam
// ou recebem a proposta já criada. Reserva "em andamento" há mais de 2 minutos é considerada
// abandonada e pode ser retomada.
import type { SupabaseClient } from "@supabase/supabase-js";

export const RESERVA_ABANDONADA_MS = 2 * 60_000;

export type ReservaIdempotencia = { tipo: "nova" } | { tipo: "concluida"; proposalId: string } | { tipo: "em_andamento" };

export async function reservarIdempotencia(db: SupabaseClient, keyId: string, chave: string, agora = Date.now()): Promise<ReservaIdempotencia> {
  const { error } = await db.from("partner_api_idempotencia").insert({ key_id: keyId, idempotency_key: chave, status: "em_andamento" });
  if (!error) return { tipo: "nova" };
  if ((error as { code?: string }).code !== "23505") throw new Error(`reserva de idempotência: ${error.message}`);

  const { data } = await db.from("partner_api_idempotencia")
    .select("status, proposal_id, criado_em").eq("key_id", keyId).eq("idempotency_key", chave).maybeSingle();
  const r = data as { status: string; proposal_id: string | null; criado_em: string } | null;
  if (!r) return reservarIdempotencia(db, keyId, chave, agora);
  if (r.status === "concluida" && r.proposal_id) return { tipo: "concluida", proposalId: r.proposal_id };
  if (agora - new Date(r.criado_em).getTime() < RESERVA_ABANDONADA_MS) return { tipo: "em_andamento" };

  // Abandonada: retoma só se ninguém retomou antes (mesma criado_em).
  const { data: retomada } = await db.from("partner_api_idempotencia")
    .update({ criado_em: new Date(agora).toISOString() })
    .eq("key_id", keyId).eq("idempotency_key", chave).eq("status", "em_andamento").eq("criado_em", r.criado_em)
    .select("key_id");
  return Array.isArray(retomada) && retomada.length ? { tipo: "nova" } : { tipo: "em_andamento" };
}
