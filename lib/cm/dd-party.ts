// Funcoes compartilhadas das rotas da aba Due Diligence (Entregas 1 a 3, 08/10/2026): documento da parte,
// parte, numero do contrato de origem e nomes de usuario. Movidas de .../due-diligence/route.ts, sem mudar o comportamento.

import { createClient as sc } from "@supabase/supabase-js";
import { detectDocument } from "@/lib/document-check";

export function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export type PartyDoc =
  | { ok: true; kind: "cpf" | "cnpj"; value: string }
  | { ok: false; reason: string };

export function resolveDocument(row: { person_type: string | null; cpf_cnpj: string | null; company_cnpj: string | null }): PartyDoc {
  const raw = row.person_type === "PJ" ? row.company_cnpj : row.cpf_cnpj;
  if (!raw || !raw.trim()) return { ok: false, reason: "Parte sem CPF ou CNPJ informado (parte estrangeira ou cadastro incompleto)" };
  const d = detectDocument(raw);
  if (!d) return { ok: false, reason: "Documento da parte inválido: a consulta não foi liberada" };
  return { ok: true, kind: d.kind, value: d.value };
}

export async function loadParty(db: ReturnType<typeof svc>, id: string) {
  const { data: row } = await db
    .from("cm_party_qualifications")
    .select("id, status, deleted_at, person_type, cpf_cnpj, company_cnpj, batch_id, role_in_document, lgpd_text_version, full_name, company_name")
    .eq("id", id)
    .maybeSingle();
  if (!row || row.deleted_at) return null;
  return row;
}

/**
 * Numero do contrato ligado ao lote da parte. Nos NCNDA o lote e "consumido" pelo contrato
 * (consumido_por_contract_id) e operation_contract_id fica vazio; por isso olhamos os tres
 * vinculos e damos preferencia ao contrato de serie NCNDA (V3C-NDA), que e o que origina a due diligence.
 */
export async function resolveContractCode(db: ReturnType<typeof svc>, batchId: string | null): Promise<string | null> {
  if (!batchId) return null;
  const { data: batch } = await db
    .from("cm_qualification_batches")
    .select("operation_contract_id, consumido_por_contract_id, parent_contract_id")
    .eq("id", batchId)
    .maybeSingle();
  const ids = [batch?.operation_contract_id, batch?.consumido_por_contract_id, batch?.parent_contract_id].filter(Boolean) as string[];
  if (ids.length === 0) return null;
  const { data: contracts } = await db.from("operation_contracts").select("id, contract_code").in("id", ids);
  const byId = new Map((contracts ?? []).map((c) => [c.id as string, (c.contract_code as string | null) ?? null]));
  const codes = ids.map((id) => byId.get(id)).filter(Boolean) as string[];
  return codes.find((c) => c.startsWith("V3C-NDA")) ?? codes[0] ?? null;
}

export async function namesByUserId(db: ReturnType<typeof svc>, ids: string[]): Promise<Record<string, string>> {
  const uniq = Array.from(new Set(ids));
  if (uniq.length === 0) return {};
  const { data } = await db.from("profiles").select("id, full_name").in("id", uniq);
  return Object.fromEntries((data ?? []).map((p) => [p.id as string, (p.full_name as string) ?? "Usuário"]));
}
