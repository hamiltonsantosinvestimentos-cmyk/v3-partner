import type { SupabaseClient } from "@supabase/supabase-js";
import { sortQualificationParties } from "@/lib/qualification-roles";

/**
 * Grade de comissionamento por grupo (BRIEF 06/10/2026).
 * Um link de intake por grupo para 1 representante declarar o percentual de cada participante.
 * A página pública só recebe NOMES; nunca CPF, e-mail, telefone ou dado bancário.
 */

export const COMMISSION_GROUPS = ["venda", "compra", "assessoria"] as const;
export type CommissionGroup = (typeof COMMISSION_GROUPS)[number];

export const COMMISSION_GROUP_LABELS: Record<CommissionGroup, string> = {
  venda: "Venda / Locador",
  compra: "Equipe de Compra",
  assessoria: "Assessoria V3",
};

/** Parcela do grupo na comissão total de 0,30% (Cláusula 4.2 do Mandato). */
export const COMMISSION_GROUP_PERCENT: Record<CommissionGroup, number> = { venda: 0.1, compra: 0.16, assessoria: 0.04 };

/** Contrato de origem sugerido para ler os participantes de cada grupo (mapa informado por João em 06/10/2026). */
export const COMMISSION_DEFAULT_SOURCE: Record<CommissionGroup, string> = {
  venda: "V3C-ADE-2026-0001",
  compra: "V3C-NDA-2026-0052",
  assessoria: "V3C-NDA-2026-0053",
};

/** Assessoria: divisão fixada na Cláusula 4.3 do Mandato (1/5, 1/5 e 3/5 da comissão líquida da V3). */
export const ASSESSORIA_FIXED_PERCENT_EACH = 20;
export const ASSESSORIA_V3_FIXED = { label: "V3 Partners Soluções Ltda", percent: 60 };

export const COMMISSION_TOKEN_DAYS = 7;
export const COMMISSION_APP_ORIGIN = "https://app.v3partners.com.br";
export const commissionLink = (token: string) => `${COMMISSION_APP_ORIGIN}/intake/comissao/${token}`;

export interface GridParticipant {
  qualification_id: string;
  name: string;
  fixed_percent?: number;
}

export interface GridAllocationInput {
  qualification_id: string;
  percent: string | number;
}

/** "33,33" ou "33.33" vira centésimos inteiros (3333). Retorna null se inválido (mais de 2 casas, negativo, texto). */
export function percentToCents(raw: string | number): number | null {
  const s = String(raw).trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ""] = s.split(".");
  return parseInt(int, 10) * 100 + parseInt(dec.padEnd(2, "0"), 10);
}

export const centsToPercent = (cents: number) => (cents / 100).toFixed(2);

export interface AllocationCheck {
  ok: boolean;
  error?: string;
  /** qualification_id -> centésimos */
  cents?: Record<string, number>;
}

/** Valida em centésimos inteiros (nunca float): só participantes da grade, mínimo 0,01, soma exata de 100,00. */
export function validateAllocations(
  participants: GridParticipant[],
  fixed: { label: string; percent: number }[],
  input: GridAllocationInput[],
): AllocationCheck {
  const byId = new Map(participants.map((p) => [p.qualification_id, p]));
  const cents: Record<string, number> = {};
  let sum = 0;
  for (const p of participants) {
    if (typeof p.fixed_percent === "number") {
      cents[p.qualification_id] = Math.round(p.fixed_percent * 100);
      sum += cents[p.qualification_id];
    }
  }
  for (const a of input) {
    const p = byId.get(a.qualification_id);
    if (!p) return { ok: false, error: "Há um participante que não pertence a esta grade." };
    if (typeof p.fixed_percent === "number") continue; // percentual travado pelo Mandato: nunca vem do cliente
    const c = percentToCents(a.percent);
    if (c === null) return { ok: false, error: `Percentual inválido para ${p.name}. Use até 2 casas decimais, por exemplo 16,67.` };
    if (c < 1) return { ok: false, error: `O percentual de ${p.name} precisa ser maior que 0,00%.` };
    if (c > 10000) return { ok: false, error: `O percentual de ${p.name} não pode passar de 100,00%.` };
    cents[a.qualification_id] = c;
    sum += c;
  }
  const missing = participants.filter((p) => cents[p.qualification_id] === undefined);
  if (missing.length) return { ok: false, error: `Preencha o percentual de: ${missing.map((m) => m.name).join(", ")}.` };
  for (const f of fixed) sum += Math.round(f.percent * 100);
  if (sum !== 10000) {
    const diff = (10000 - sum) / 100;
    return { ok: false, error: `A soma precisa ser exatamente 100,00%. ${diff > 0 ? "Faltam" : "Sobram"} ${Math.abs(diff).toFixed(2).replace(".", ",")}%.` };
  }
  return { ok: true, cents };
}

/** Participantes de um contrato de origem, na ordem canônica das partes. Só nome e id (nunca dado pessoal). */
export async function loadParticipantsFromContract(
  db: SupabaseClient,
  contractCode: string,
): Promise<{ ok: true; contractId: string; participants: GridParticipant[] } | { ok: false; status: number; error: string }> {
  const { data: contract } = await db
    .from("operation_contracts")
    .select("id, qualification_batch_id, deleted_at")
    .eq("contract_code", contractCode)
    .maybeSingle();
  if (!contract) return { ok: false, status: 404, error: `Contrato ${contractCode} não encontrado.` };
  if (contract.deleted_at) return { ok: false, status: 422, error: `O contrato ${contractCode} está na Lixeira.` };
  if (!contract.qualification_batch_id) return { ok: false, status: 422, error: `O contrato ${contractCode} não tem lote de qualificação.` };
  const { data: rows } = await db
    .from("cm_party_qualifications")
    .select("id, full_name, role_in_document, created_at")
    .eq("batch_id", contract.qualification_batch_id)
    .is("deleted_at", null);
  const sorted = sortQualificationParties(rows ?? []);
  if (sorted.length === 0) return { ok: false, status: 422, error: `O lote do contrato ${contractCode} não tem participantes.` };
  return {
    ok: true,
    contractId: contract.id as string,
    participants: sorted.map((r) => ({ qualification_id: r.id as string, name: String(r.full_name) })),
  };
}
