// Deal Room (VDR): regra única de identidade do deal para o convidado externo.
// Política de sigilo de 31/10/2026 e BRIEF de segurança do Deal Room de 08/11/2026.
//
// Nesta entrega o NDA assinado é o único gatilho. Sala que não exige NDA fica genérica
// (a regra completa, com contratos assinados e due diligence liberada, é o BRIEF B3).
// Dúvida vai para o lado do sigilo: sem NDA assinado, nada que identifique o deal sai.

export const NOME_SALA_GENERICO = "Deal Room";

export type DealBruto = {
  v3_code?: string | null;
  code?: string | null;
  target_company?: string | null;
  sector?: string | null;
} | null | undefined;

export type DealPublico = {
  id: string | null;
  v3_code: string | null;
  legacy_code: string | null;
  target_company: string | null;
  sector: string | null;
};

/** A identidade só é liberada com o NDA assinado. */
export function identidadeLiberada(ndaSigned: boolean): boolean {
  return ndaSigned === true;
}

/** Campos do deal que o convidado pode ver. Sem NDA assinado, tudo nulo, inclusive o id. */
export function montarDealPublico(ndaSigned: boolean, dealId: string | null | undefined, deal: DealBruto): DealPublico {
  if (!identidadeLiberada(ndaSigned)) {
    return { id: null, v3_code: null, legacy_code: null, target_company: null, sector: null };
  }
  return {
    id: dealId ?? null,
    v3_code: deal?.v3_code ?? null,
    legacy_code: deal?.code ?? null,
    target_company: deal?.target_company ?? null,
    sector: deal?.sector ?? null,
  };
}

/** O nome da sala costuma levar o código do deal. Sem NDA assinado, nome genérico. */
export function nomeSalaPublico(ndaSigned: boolean, nome: string | null | undefined): string {
  return identidadeLiberada(ndaSigned) ? (nome ?? NOME_SALA_GENERICO) : NOME_SALA_GENERICO;
}

const GRUPO_VALIDO = /^[a-z0-9-]{1,40}$/;

/** x-vdr-group vem de ?grp= e é forjável: só aceita o formato esperado, senão "direct". */
export function sanitizarGrupo(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase();
  return GRUPO_VALIDO.test(v) ? v : "direct";
}

/**
 * Linha de log das rotas públicas de CIM (cim-pdf e preview-criativo), até o B2 as fechar.
 * Sem IP, sem o dealId completo e sem dado pessoal: só os 8 primeiros caracteres do dealId,
 * que correlacionam acessos mas não bastam para abrir o CIM.
 */
export function montarLogCimAcesso(
  rota: "cim-pdf" | "preview-criativo",
  dealId: string,
  tokenPresente: boolean,
  tokenValido: boolean,
  agora: Date = new Date(),
) {
  return {
    event: "cim_acesso_publico",
    rota,
    deal_prefixo: String(dealId).slice(0, 8),
    token_presente: tokenPresente,
    token_valido: tokenValido,
    ts: agora.toISOString(),
  };
}
