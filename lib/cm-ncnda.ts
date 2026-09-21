import type { SupabaseClient } from "@supabase/supabase-js";

// NCNDA da Bolsa de Ativos (Fase 5, 5.3, 20/09/2026).
//
// Ha DUAS minutas aprovadas com vertical=capital_markets e serie V3C-NDA:
// o Acordo Mestre "NCNDA V3 PARTNERS MODELO" (le o bloco de qualificacao das
// partes) e o "NDA (Comprador Bolsa de Ativos)", um NDA curto escrito em torno
// de um ativo (variaveis do cedente, parte receptora em branco). Vertical mais
// serie nao distinguem as duas, e um `.find()` sobre a lista escolheria uma por
// acidente de ordem alfabetica (mesmo defeito do "Solicitar NCNDA" de M&A em
// 07/09/2026, que gerou uma Carta de Intencao por engano).
//
// O que faz uma minuta servir a um lote de qualificacao e consumir o bloco
// {{party_qualifications_block}}. Esse e o seletor: nao depende do nome, entao
// o juridico pode renomear ou substituir a minuta sem quebrar o botao.
const PARTY_BLOCK_PATTERN = "%{{party_qualifications_block}}%";

export interface NcndaTemplate {
  id: string;
  template_name: string;
}

export async function resolveBolsaNcndaTemplate(db: SupabaseClient): Promise<NcndaTemplate | null> {
  const { data } = await db
    .from("contract_templates")
    .select("id, template_name")
    .eq("vertical", "capital_markets")
    .eq("contract_series", "V3C-NDA")
    .eq("approval_status", "aprovado")
    .eq("is_active", true)
    .ilike("body_text_raw", PARTY_BLOCK_PATTERN)
    .order("updated_at", { ascending: false })
    .limit(1);
  return (data?.[0] as NcndaTemplate | undefined) ?? null;
}

export type NcndaStage =
  | "sem_lote"
  | "coletando"
  | "pronto_para_contrato"
  | "contrato_gerado"
  | "enviado_assinatura"
  | "assinado";

export interface DemandNcndaState {
  stage: NcndaStage;
  signed: boolean;
  template: NcndaTemplate | null;
  batch: {
    id: string;
    status: string;
    parties_total: number;
    parties_filled: number;
    party_names: string[];
  } | null;
  contract: { id: string; contract_code: string | null; status_signature: string } | null;
}

/** Estado do NCNDA de uma demanda de compra, derivado so de dados que ja existem:
 *  lote (cm_qualification_batches.demand_id) e contrato (operation_contracts.qualification_batch_id).
 *  Sem coluna nova. `signed` e o mesmo criterio de demand_has_signed_ncnda() no banco. */
export async function getDemandNcndaState(db: SupabaseClient, demandId: string): Promise<DemandNcndaState> {
  const template = await resolveBolsaNcndaTemplate(db);

  // So lotes formais (com minuta e instrumento definidos). A indicacao rapida
  // (aguardando_triagem_governanca, sem template) nao e NCNDA.
  const { data: batches } = await db
    .from("cm_qualification_batches")
    .select("id, status, template_id, consumido_por_contract_id, created_at, cm_party_qualifications(full_name, status, deleted_at)")
    .eq("demand_id", demandId)
    .not("template_id", "is", null)
    .order("created_at", { ascending: false });

  const list = batches ?? [];
  const batchIds = list.map((b) => b.id as string);

  let contracts: { id: string; contract_code: string | null; status_signature: string; qualification_batch_id: string; created_at: string }[] = [];
  if (batchIds.length > 0) {
    const { data } = await db
      .from("operation_contracts")
      .select("id, contract_code, status_signature, qualification_batch_id, created_at")
      .in("qualification_batch_id", batchIds)
      .like("contract_code", "V3C-NDA-%")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    contracts = (data ?? []) as typeof contracts;
  }

  const signedContract = contracts.find((c) => c.status_signature === "assinado") ?? null;
  const liveContract = signedContract ?? contracts.find((c) => c.status_signature !== "cancelado") ?? null;

  // Lote de referencia: o do contrato vivo, ou o mais recente ainda sem contrato.
  const batchRow = liveContract
    ? list.find((b) => b.id === liveContract.qualification_batch_id)
    : list[0];

  const parties = ((batchRow?.cm_party_qualifications ?? []) as { full_name: string; status: string; deleted_at: string | null }[])
    .filter((p) => !p.deleted_at);

  let stage: NcndaStage = "sem_lote";
  if (signedContract) stage = "assinado";
  else if (liveContract) stage = liveContract.status_signature === "enviado_assinatura" ? "enviado_assinatura" : "contrato_gerado";
  else if (batchRow) stage = batchRow.status === "completo" ? "pronto_para_contrato" : "coletando";

  return {
    stage,
    signed: !!signedContract,
    template,
    batch: batchRow
      ? {
          id: batchRow.id as string,
          status: batchRow.status as string,
          parties_total: parties.length,
          parties_filled: parties.filter((p) => p.status === "preenchido").length,
          party_names: parties.map((p) => p.full_name),
        }
      : null,
    contract: liveContract
      ? { id: liveContract.id, contract_code: liveContract.contract_code, status_signature: liveContract.status_signature }
      : null,
  };
}
