// Travas da Entrega 2a da Due Diligence (08/10/2026): regra de decisor e aceite do Aviso de Privacidade.
// BRIEF: scratchpad brief-e2-dd.md (REVISAO v2). Funcoes PURAS, todas FAIL CLOSED:
// valor ausente, vazio, ambiguo ou desconhecido NEGA a consulta de pessoa fisica.

// Posicoes da qualificacao (role_in_document) com poder de decisao na operacao: o cedente
// (parte_principal) e os mandatarios. Todas as demais (intermediarios, finders, testemunha, partner,
// estruturador, head_mesa) NAO sao decisoras. Suposicao registrada: "cedente" = parte_principal.
export const DD_DECISOR_ROLES = ["parte_principal", "mandatario", "mandatario_1", "mandatario_2"] as const;

export function isDecisorRole(role: string | null | undefined): boolean {
  return !!role && (DD_DECISOR_ROLES as readonly string[]).includes(role);
}

// Ordem cronologica das versoes do Aviso de Privacidade da Qualificacao (a mais antiga primeiro).
// A versao 2 esta em aprovacao (rascunho); ela entra aqui para a comparacao funcionar assim que for ao ar.
export const LGPD_VERSION_ORDER = ["2026-10-05-v1", "2026-10-08-v2"] as const;

/**
 * "Igual ou posterior" a versao minima configurada em DD_PF_MIN_LGPD_VERSION: a versao aceita pela parte
 * precisa estar na lista de versoes conhecidas e ficar na mesma posicao da minima ou depois dela.
 * Variavel ausente, vazia ou fora da lista, ou versao da parte ausente ou desconhecida: NEGA.
 */
export function lgpdVersionAllowsPf(partyVersion: string | null | undefined, minVersion: string | null | undefined): boolean {
  const order = LGPD_VERSION_ORDER as readonly string[];
  const min = (minVersion ?? "").trim();
  const party = (partyVersion ?? "").trim();
  if (!min || !party) return false;
  const minIdx = order.indexOf(min);
  const partyIdx = order.indexOf(party);
  if (minIdx < 0 || partyIdx < 0) return false;
  return partyIdx >= minIdx;
}

export type PfBlock = "nao_decisor" | "aceite_pendente" | null;

/** Motivo do bloqueio de consulta de PF, ou null quando liberada. A ordem importa: decisor primeiro. */
export function pfBlockReason(
  role: string | null | undefined,
  partyLgpdVersion: string | null | undefined,
  minVersion: string | null | undefined,
): PfBlock {
  if (!isDecisorRole(role)) return "nao_decisor";
  if (!lgpdVersionAllowsPf(partyLgpdVersion, minVersion)) return "aceite_pendente";
  return null;
}

export const PF_BLOCK_TEXT: Record<Exclude<PfBlock, null>, string> = {
  nao_decisor: "Disponível apenas para mandatário ou cedente decisor",
  aceite_pendente: "Aguardando aceite do novo Aviso de Privacidade",
};
