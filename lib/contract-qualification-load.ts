/**
 * Monta as partes (QParty) que a conferência Q-01 a Q-07 precisa, a partir da qualificação
 * gravada no lote do contrato e das partes do próprio contrato.
 *
 * Leitura do banco só com a chave de serviço, no servidor. O mapeamento em si é puro e testado
 * (`qualificationRowsToParties`). Nada aqui devolve dado pessoal além do necessário à conferência,
 * e nenhum consumidor deve gravar esses valores em log ou mensagem.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QParty, QPerson } from "./contract-qualification-check";

export const QUALIFICATION_GATE_COLUMNS =
  "role_in_document, full_name, person_type, party_nature, cpf_cnpj, rg, id_type, id_number, id_country, marital_status, marital_status_code, nationality, nationality_code, company_name, company_cnpj, cnpj_razao_social, representation";

export interface QualificationGateRow {
  role_in_document: string;
  full_name?: string | null;
  person_type?: string | null;
  party_nature?: string | null;
  cpf_cnpj?: string | null;
  rg?: string | null;
  id_type?: string | null;
  id_number?: string | null;
  id_country?: string | null;
  marital_status?: string | null;
  marital_status_code?: string | null;
  nationality?: string | null;
  nationality_code?: string | null;
  company_name?: string | null;
  company_cnpj?: string | null;
  cnpj_razao_social?: string | null;
  representation?: unknown;
}

export interface ContractPartyLite {
  role: string;
  name?: string | null;
  doc?: string | null;
}

const PROFUNDIDADE_MAXIMA_DA_CADEIA = 6;

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Achata a cadeia recursiva de representantes (representation dentro de representation). */
export function achatarRepresentacao(representation: unknown): QPerson[] {
  const pessoas: QPerson[] = [];
  let no: unknown = representation;
  for (let nivel = 0; nivel < PROFUNDIDADE_MAXIMA_DA_CADEIA; nivel++) {
    if (!no || typeof no !== "object") break;
    const n = no as Record<string, unknown>;
    pessoas.push({
      cpfCnpj: texto(n.cpf_cnpj),
      rg: texto(n.rg),
      idType: texto(n.id_type),
      idNumber: texto(n.id_number),
      idCountry: texto(n.id_country),
    });
    no = n.representation;
  }
  return pessoas.filter((p) => p.cpfCnpj || p.rg || p.idNumber);
}

/**
 * Converte as linhas de qualificação em partes para a conferência. O Head (e qualquer parte do
 * contrato que não tenha ficha de qualificação mas tenha documento) entra a partir de `parties`,
 * para o Q-07 comparar também com o documento dele. Parte que tem ficha nunca entra duas vezes.
 */
export function qualificationRowsToParties(
  rows: QualificationGateRow[],
  contractParties: ContractPartyLite[] = [],
): QParty[] {
  const partes: QParty[] = rows.map((r) => {
    const pj = r.party_nature === "PJ" || r.person_type === "PJ";
    return {
      role: r.role_in_document,
      nature: pj ? "PJ" : "PF",
      fullName: r.full_name ?? null,
      cpfCnpj: r.cpf_cnpj ?? null,
      rg: r.rg ?? null,
      idType: r.id_type ?? null,
      idNumber: r.id_number ?? null,
      idCountry: r.id_country ?? null,
      maritalCode: r.marital_status_code ?? null,
      maritalText: r.marital_status ?? null,
      nationalityCode: r.nationality_code ?? null,
      nationalityText: r.nationality ?? null,
      companyName: r.company_name ?? null,
      companyCnpj: r.company_cnpj ?? null,
      cnpjRazaoSocial: r.cnpj_razao_social ?? null,
      representatives: achatarRepresentacao(r.representation),
    };
  });

  const comFicha = new Set(rows.map((r) => r.role_in_document));
  for (const p of contractParties) {
    if (!p.doc || comFicha.has(p.role)) continue;
    partes.push({ role: p.role, nature: "PF", fullName: p.name ?? null, cpfCnpj: p.doc });
  }
  return partes;
}

export type LoadResult =
  | { ok: true; parties: QParty[] }
  | { ok: false; error: string };

/** Lê a qualificação do lote do contrato. Sem lote, devolve só as partes do próprio contrato. */
export async function loadQualificationParties(
  db: SupabaseClient,
  contract: { qualification_batch_id?: string | null; parties?: ContractPartyLite[] | null },
): Promise<LoadResult> {
  const contractParties = contract.parties ?? [];
  if (!contract.qualification_batch_id) {
    return { ok: true, parties: qualificationRowsToParties([], contractParties) };
  }
  const { data, error } = await db
    .from("cm_party_qualifications")
    .select(QUALIFICATION_GATE_COLUMNS)
    .eq("batch_id", contract.qualification_batch_id)
    .is("deleted_at", null);
  if (error) return { ok: false, error: "Falha ao ler a qualificação das partes para a conferência do envio." };
  return { ok: true, parties: qualificationRowsToParties((data ?? []) as unknown as QualificationGateRow[], contractParties) };
}
