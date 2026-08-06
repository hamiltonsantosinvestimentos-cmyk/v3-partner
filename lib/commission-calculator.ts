/**
 * Motor de calculo da Calculadora Rapida de Comissionamento (Mesa de Capitais).
 * Puro, sem I/O, roda igual no navegador (preview em tempo real, sem chamar
 * a API a cada tecla) e no servidor (na hora de persistir a simulacao).
 *
 * Fase 4 (06/08/2026), espelha a planilha operacional "Simular Grades" da
 * V3: escala unica "padrao planilha Excel", todo percentual e sempre %
 * DIRETO da operacao (mesma escala da Comissao Total, isto e, % do Valor de
 * Face), nunca % de um sub-total intermediario. Cascata por lado em 2
 * decotes explicitos, igual a planilha:
 *
 *   Grupo (Cheia)          = % direto alocado ao lado (default metade da
 *                             Comissao Total, ajustavel)
 *   Grupo Liquido (pos V3) = Grupo Cheia - Fee V3 (lado)
 *   Intermediarios (resto) = Grupo Liquido - Mandatario (lado)
 *
 * Ou seja, de ponta a ponta: Intermediarios = Cheia - V3 - Mandatario, tudo
 * na mesma escala percentual direta. Cada linha em R$ e sempre
 * Valor de Face x (% direto da linha) / 100, nunca "% de uma % ja
 * calculada".
 *
 * Intermediarios pode ficar negativo se a Mesa digitar V3 + Mandatario acima
 * da Fatia Cheia do lado. Isso NAO trava o calculo (decisao explicita de
 * Joao desde a Fase 3: tela livre para digitar, nunca mensagem de erro
 * bloqueante), so desabilita a exportacao do PDF daquele lado especifico,
 * ver hasNegativeResidual().
 */

export interface SideCascadeInput {
  side_pct: number; // Grupo (Cheia): % direto do Valor de Face alocado a este lado
  fee_v3_pct: number; // Fee V3 do lado: % direto do Valor de Face
  mandatario_pct: number; // Mandatario/Titular do lado: % direto do Valor de Face
}

export interface CommissionCalculatorInput {
  valor_face: number;
  desagio_pct?: number | null;
  titulares_pct?: number | null;
  is_recorrente: boolean;
  meses_recorrencia: number;
  comissao_total_pct: number;
  buy_side: SideCascadeInput;
  sell_side: SideCascadeInput;
  deducao_bancaria_pct: number;
}

interface Linha {
  pct: number;
  bruto: number;
  liquido: number;
}

/** Mesma Linha, com o acumulado do periodo de recorrencia (bruto/liquido x meses).
 * Quando is_recorrente = false, meses = 1 e acumulado espelha o mensal. */
interface LinhaComAcumulado extends Linha {
  acumulado_bruto: number;
  acumulado_liquido: number;
}

export interface SideBreakdown {
  side_pct: number; // Grupo (Cheia), % direto
  side_bruto: number;
  side_liquido: number;
  v3: LinhaComAcumulado;
  grupo_liquido: Linha; // Cheia - V3 (decote 1, exibido como etapa explicita)
  mandatario: LinhaComAcumulado;
  intermediarios: LinhaComAcumulado; // resto automatico = grupo_liquido - mandatario, pode ser negativo
}

export interface CommissionCalculatorResult {
  operacao: {
    valor_face: number;
    desagio_pct: number;
    desagio_bruto: number; // valor em R$ do proprio desagio (nao o valor do comprador)
    valor_comprador: number; // Valor de Face x (1 - deságio)
    titulares_pct: number;
    titulares_bruto: number; // informativo, independente da cascata de comissao
  };
  fee: {
    comissao_total_pct: number;
    comissao_total_value: number;
    deducao_bancaria_pct: number;
    v3_total_pct: number; // soma buy.v3.pct + sell.v3.pct, informativo
    v3_total_bruto: number;
  };
  buy_side: SideBreakdown;
  sell_side: SideBreakdown;
  recorrencia: {
    is_recorrente: boolean;
    meses_recorrencia: number;
    volume_total_acumulado: number;
    fee_total_acumulado: number;
    buy_side_acumulado_liquido: number;
    sell_side_acumulado_liquido: number;
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

function linha(pct: number, valorFace: number, liquidoFactor: number): Linha {
  const bruto = round2(valorFace * (pct / 100));
  return { pct: round4(pct), bruto, liquido: round2(bruto * liquidoFactor) };
}

function linhaComAcumulado(pct: number, valorFace: number, liquidoFactor: number, meses: number): LinhaComAcumulado {
  const base = linha(pct, valorFace, liquidoFactor);
  return { ...base, acumulado_bruto: round2(base.bruto * meses), acumulado_liquido: round2(base.liquido * meses) };
}

function buildSide(input: SideCascadeInput, valorFace: number, liquidoFactor: number, meses: number): SideBreakdown {
  const sidePct = Number(input.side_pct) || 0;
  const v3Pct = Number(input.fee_v3_pct) || 0;
  const mandatarioPct = Number(input.mandatario_pct) || 0;

  const grupoLiquidoPct = sidePct - v3Pct; // decote 1
  const intermediariosPct = grupoLiquidoPct - mandatarioPct; // resto automatico

  return {
    side_pct: round4(sidePct),
    side_bruto: round2(valorFace * (sidePct / 100)),
    side_liquido: round2(valorFace * (sidePct / 100) * liquidoFactor),
    v3: linhaComAcumulado(v3Pct, valorFace, liquidoFactor, meses),
    grupo_liquido: linha(grupoLiquidoPct, valorFace, liquidoFactor),
    mandatario: linhaComAcumulado(mandatarioPct, valorFace, liquidoFactor, meses),
    intermediarios: linhaComAcumulado(intermediariosPct, valorFace, liquidoFactor, meses),
  };
}

export function calculateCommission(input: CommissionCalculatorInput): CommissionCalculatorResult {
  const valorFace = Number(input.valor_face) || 0;
  const desagioPct = Number(input.desagio_pct ?? 0) || 0;
  const titularesPct = Number(input.titulares_pct ?? 0) || 0;
  const comissaoTotalPct = Number(input.comissao_total_pct) || 0;
  const deducaoPct = Number(input.deducao_bancaria_pct) || 0;
  const meses = input.is_recorrente ? Math.max(1, Math.min(60, Number(input.meses_recorrencia) || 1)) : 1;

  const valorComprador = round2(valorFace * (1 - desagioPct / 100));
  const desagioBruto = round2(valorFace * (desagioPct / 100));
  const titularesBruto = round2(valorFace * (titularesPct / 100));
  const comissaoTotalValue = round2(valorFace * (comissaoTotalPct / 100));
  const liquidoFactor = 1 - deducaoPct / 100;

  const buySide = buildSide(input.buy_side, valorFace, liquidoFactor, meses);
  const sellSide = buildSide(input.sell_side, valorFace, liquidoFactor, meses);

  const v3TotalPct = round4(buySide.v3.pct + sellSide.v3.pct);
  const v3TotalBruto = round2(buySide.v3.bruto + sellSide.v3.bruto);

  const volumeTotalAcumulado = round2(valorFace * meses);
  const feeTotalAcumulado = round2(comissaoTotalValue * meses);

  return {
    operacao: {
      valor_face: valorFace,
      desagio_pct: desagioPct,
      desagio_bruto: desagioBruto,
      valor_comprador: valorComprador,
      titulares_pct: titularesPct,
      titulares_bruto: titularesBruto,
    },
    fee: {
      comissao_total_pct: comissaoTotalPct,
      comissao_total_value: comissaoTotalValue,
      deducao_bancaria_pct: deducaoPct,
      v3_total_pct: v3TotalPct,
      v3_total_bruto: v3TotalBruto,
    },
    buy_side: buySide,
    sell_side: sellSide,
    recorrencia: {
      is_recorrente: input.is_recorrente,
      meses_recorrencia: meses,
      volume_total_acumulado: volumeTotalAcumulado,
      fee_total_acumulado: feeTotalAcumulado,
      buy_side_acumulado_liquido: round2(buySide.side_liquido * meses),
      sell_side_acumulado_liquido: round2(sellSide.side_liquido * meses),
    },
  };
}

/** Intermediarios negativo naquele lado: exportacao de PDF daquele lado fica bloqueada na UI. */
export function hasNegativeResidual(side: SideBreakdown): boolean {
  return side.intermediarios.bruto < 0;
}
