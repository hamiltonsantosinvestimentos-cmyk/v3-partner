/**
 * Motor de calculo da Calculadora Rapida de Comissionamento (Mesa de Capitais).
 * Puro, sem I/O, roda igual no navegador (preview em tempo real, sem chamar
 * a API a cada tecla) e no servidor (na hora de persistir a simulacao).
 *
 * Fase 3 (06/08/2026), cascata top-down: fim da trava de soma 100%. Cada
 * lado (Compra/Venda) recebe uma fatia bruta independente (% da Comissao
 * Total, default 50/50, ajustavel, sem obrigacao de fechar 100% entre os
 * dois). Dentro de cada lado, V3 e Mandatario sao % manuais DAQUELE LADO
 * (nao mais uma fatia global da V3 repartida proporcionalmente, como era
 * na Fase 2), e Grupo de Intermediarios e sempre o RESTO automatico:
 *
 *   Intermediarios (lado) = Fatia Bruta (lado) - V3 (lado) - Mandatario (lado)
 *
 * Esse resto pode ficar negativo se a Mesa digitar V3 + Mandatario acima de
 * 100% do lado. Isso NAO trava o calculo (decisao explicita de Joao: tela
 * livre para digitar, nunca mensagem de erro bloqueante), so desabilita a
 * exportacao do PDF daquele lado especifico, ver hasNegativeResidual().
 */

export interface SideCascadeInput {
  side_pct: number; // % da Comissao Total alocada a este lado (independente do outro lado)
  fee_v3_pct: number; // % da fatia bruta DESTE LADO que fica com a V3
  mandatario_pct: number; // % da fatia bruta DESTE LADO que fica com o Mandatario/Titular
}

export interface CommissionCalculatorInput {
  valor_face: number;
  desagio_pct?: number | null;
  is_recorrente: boolean;
  meses_recorrencia: number;
  comissao_total_pct: number;
  buy_side: SideCascadeInput;
  sell_side: SideCascadeInput;
  deducao_bancaria_pct: number;
}

export interface SideBreakdown {
  side_pct: number;
  side_bruto: number;
  side_liquido: number;
  v3: { pct_of_side: number; bruto: number; liquido: number };
  mandatario: { pct_of_side: number; bruto: number; liquido: number };
  intermediarios: { pct_of_side: number; bruto: number; liquido: number }; // pode ser negativo
}

export interface CommissionCalculatorResult {
  operacao: {
    valor_face: number;
    desagio_pct: number;
    valor_comprador: number; // Valor de Face x (1 - deságio)
  };
  fee: {
    comissao_total_pct: number;
    comissao_total_value: number;
    deducao_bancaria_pct: number;
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

function buildSide(input: SideCascadeInput, comissaoTotalValue: number, liquidoFactor: number): SideBreakdown {
  const sidePct = Number(input.side_pct) || 0;
  const v3Pct = Number(input.fee_v3_pct) || 0;
  const mandatarioPct = Number(input.mandatario_pct) || 0;

  const sideBruto = round2(comissaoTotalValue * (sidePct / 100));
  const v3Bruto = round2(sideBruto * (v3Pct / 100));
  const mandatarioBruto = round2(sideBruto * (mandatarioPct / 100));
  // Resto automatico, nunca digitado, pode dar negativo de proposito (ver
  // comentario no topo do arquivo), quem trata a exportacao e a UI.
  const intermediariosBruto = round2(sideBruto - v3Bruto - mandatarioBruto);
  const intermediariosPct = round4(100 - v3Pct - mandatarioPct);

  return {
    side_pct: sidePct,
    side_bruto: sideBruto,
    side_liquido: round2(sideBruto * liquidoFactor),
    v3: { pct_of_side: v3Pct, bruto: v3Bruto, liquido: round2(v3Bruto * liquidoFactor) },
    mandatario: { pct_of_side: mandatarioPct, bruto: mandatarioBruto, liquido: round2(mandatarioBruto * liquidoFactor) },
    intermediarios: { pct_of_side: intermediariosPct, bruto: intermediariosBruto, liquido: round2(intermediariosBruto * liquidoFactor) },
  };
}

export function calculateCommission(input: CommissionCalculatorInput): CommissionCalculatorResult {
  const valorFace = Number(input.valor_face) || 0;
  const desagioPct = Number(input.desagio_pct ?? 0) || 0;
  const comissaoTotalPct = Number(input.comissao_total_pct) || 0;
  const deducaoPct = Number(input.deducao_bancaria_pct) || 0;
  const meses = input.is_recorrente ? Math.max(1, Math.min(60, Number(input.meses_recorrencia) || 1)) : 1;

  const valorComprador = round2(valorFace * (1 - desagioPct / 100));
  const comissaoTotalValue = round2(valorFace * (comissaoTotalPct / 100));
  const liquidoFactor = 1 - deducaoPct / 100;

  const buySide = buildSide(input.buy_side, comissaoTotalValue, liquidoFactor);
  const sellSide = buildSide(input.sell_side, comissaoTotalValue, liquidoFactor);

  const volumeTotalAcumulado = round2(valorFace * meses);
  const feeTotalAcumulado = round2(comissaoTotalValue * meses);

  return {
    operacao: { valor_face: valorFace, desagio_pct: desagioPct, valor_comprador: valorComprador },
    fee: { comissao_total_pct: comissaoTotalPct, comissao_total_value: comissaoTotalValue, deducao_bancaria_pct: deducaoPct },
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
