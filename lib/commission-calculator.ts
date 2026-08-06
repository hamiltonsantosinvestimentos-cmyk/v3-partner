/**
 * Motor de calculo da Calculadora Rapida de Comissionamento (Mesa de Capitais).
 * Puro, sem I/O, usado pela API (/api/cm/commission-calculator) para computar
 * e persistir, e pode ser reaproveitado em teste unitario sem tocar banco.
 *
 * Fase 2 (06/08/2026): quebra cada lado (Compra/Venda) em Mandatario/Titular +
 * Grupo de Intermediarios, e reparte a fatia da V3 entre os dois lados na
 * mesma proporcao que Compra/Venda tem entre si (decisao de Joao). O "%
 * Alocado" de toda linha e sempre % do FEE TOTAL da operacao, nunca % do
 * lado, para as 6 linhas das duas tabelas somarem 100% entre si.
 *
 * Convencao de base: o fee incide sobre valor_face, mesmo criterio ja usado
 * pela RPC calculate_cm_commission_split(p_valor_face, p_commission_percent).
 *
 * Split de topo: buy_side_pct + sell_side_pct + fee_v3_pct = 100% do
 * fee_total_pct. fee_v3_pct e sempre digitado manualmente por operacao,
 * porque a Mesa pode abrir mao ou aumentar o comissionamento da V3
 * negociacao a negociacao, nunca calculado/fixo.
 *
 * Dentro de cada lado: Mandatario/Titular e digitado em % DO LADO ou em R$
 * direto (unit "pct" ou "valor"). Grupo de Intermediarios nunca e digitado,
 * e sempre o restante automatico do lado (bruto do lado menos o Mandatario).
 */

export type MandatarioInputUnit = "pct" | "valor";

export interface MandatarioInput {
  value: number;
  unit: MandatarioInputUnit;
}

export interface CommissionCalculatorInput {
  valor_face: number;
  desagio_pct?: number | null;
  is_recorrente: boolean;
  meses_recorrencia: number;
  fee_total_pct: number;
  fee_v3_pct: number;
  buy_side_pct: number;
  sell_side_pct: number;
  buy_mandatario_input: MandatarioInput;
  sell_mandatario_input: MandatarioInput;
  deducao_bancaria_pct: number;
}

export interface SideBreakdown {
  side_total_pct: number; // % do fee total alocado a este lado
  side_total_bruto: number;
  side_total_liquido: number;
  v3_share: { pct_of_total: number; bruto: number; liquido: number };
  mandatario: {
    input_unit: MandatarioInputUnit;
    input_value: number;
    pct_of_side: number;
    pct_of_total: number;
    bruto: number;
    liquido: number;
  };
  intermediarios: { pct_of_side: number; pct_of_total: number; bruto: number; liquido: number };
}

export interface CommissionCalculatorResult {
  operacao: {
    valor_face: number;
    desagio_pct: number;
    valor_comprador: number; // Valor de Face x (1 - deságio)
  };
  fee: {
    fee_total_pct: number;
    fee_total_value: number;
    fee_v3_pct: number;
    v3_total_value: number;
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

function buildSide(
  sideTotalPct: number,
  sideTotalBruto: number,
  v3TotalValue: number,
  v3SideRatio: number,
  mandatarioInput: MandatarioInput,
  liquidoFactor: number
): SideBreakdown {
  const v3ShareBruto = round2(v3TotalValue * v3SideRatio);
  const v3SharePctOfTotal = round4(mandatarioInput ? 0 : 0); // placeholder, sobrescrito pelo chamador

  let mandatarioPctOfSide: number;
  let mandatarioBruto: number;
  if (mandatarioInput.unit === "pct") {
    mandatarioPctOfSide = Math.max(0, Math.min(100, Number(mandatarioInput.value)));
    mandatarioBruto = round2(sideTotalBruto * (mandatarioPctOfSide / 100));
  } else {
    mandatarioBruto = Math.max(0, Math.min(sideTotalBruto, Number(mandatarioInput.value)));
    mandatarioPctOfSide = sideTotalBruto > 0 ? round4((mandatarioBruto / sideTotalBruto) * 100) : 0;
  }

  const intermediariosBruto = round2(Math.max(0, sideTotalBruto - mandatarioBruto));
  const intermediariosPctOfSide = round4(100 - mandatarioPctOfSide);

  const mandatarioPctOfTotal = round4(sideTotalPct * (mandatarioPctOfSide / 100));
  const intermediariosPctOfTotal = round4(sideTotalPct * (intermediariosPctOfSide / 100));

  return {
    side_total_pct: sideTotalPct,
    side_total_bruto: sideTotalBruto,
    side_total_liquido: round2(sideTotalBruto * liquidoFactor),
    v3_share: {
      pct_of_total: v3SharePctOfTotal, // sobrescrito pelo chamador (precisa de fee_v3_pct)
      bruto: v3ShareBruto,
      liquido: round2(v3ShareBruto * liquidoFactor),
    },
    mandatario: {
      input_unit: mandatarioInput.unit,
      input_value: Number(mandatarioInput.value),
      pct_of_side: mandatarioPctOfSide,
      pct_of_total: mandatarioPctOfTotal,
      bruto: mandatarioBruto,
      liquido: round2(mandatarioBruto * liquidoFactor),
    },
    intermediarios: {
      pct_of_side: intermediariosPctOfSide,
      pct_of_total: intermediariosPctOfTotal,
      bruto: intermediariosBruto,
      liquido: round2(intermediariosBruto * liquidoFactor),
    },
  };
}

export function calculateCommission(input: CommissionCalculatorInput): CommissionCalculatorResult {
  const valorFace = Number(input.valor_face);
  const desagioPct = Number(input.desagio_pct ?? 0);
  const feeTotalPct = Number(input.fee_total_pct);
  const feeV3Pct = Number(input.fee_v3_pct);
  const buySidePct = Number(input.buy_side_pct);
  const sellSidePct = Number(input.sell_side_pct);
  const deducaoPct = Number(input.deducao_bancaria_pct);
  const meses = input.is_recorrente ? Math.max(1, Math.min(60, Number(input.meses_recorrencia) || 1)) : 1;

  const valorComprador = round2(valorFace * (1 - desagioPct / 100));
  const feeTotalValue = round2(valorFace * (feeTotalPct / 100));
  const v3TotalValue = round2(feeTotalValue * (feeV3Pct / 100));

  const liquidoFactor = 1 - deducaoPct / 100;

  const buySideBruto = round2(feeTotalValue * (buySidePct / 100));
  const sellSideBruto = round2(feeTotalValue * (sellSidePct / 100));

  // Fatia da V3 repartida entre os lados na mesma proporcao que Compra/Venda
  // tem entre si (decisao de Joao, 06/08/2026). Guarda contra divisao por
  // zero no caso extremo de fee_v3_pct = 100% (buy+sell = 0).
  const sideDenominator = buySidePct + sellSidePct;
  const buySideRatio = sideDenominator > 0 ? buySidePct / sideDenominator : 0.5;
  const sellSideRatio = sideDenominator > 0 ? sellSidePct / sideDenominator : 0.5;

  const buySide = buildSide(buySidePct, buySideBruto, v3TotalValue, buySideRatio, input.buy_mandatario_input, liquidoFactor);
  const sellSide = buildSide(sellSidePct, sellSideBruto, v3TotalValue, sellSideRatio, input.sell_mandatario_input, liquidoFactor);

  buySide.v3_share.pct_of_total = round4(feeV3Pct * buySideRatio);
  sellSide.v3_share.pct_of_total = round4(feeV3Pct * sellSideRatio);

  const volumeTotalAcumulado = round2(valorFace * meses);
  const feeTotalAcumulado = round2(feeTotalValue * meses);

  return {
    operacao: { valor_face: valorFace, desagio_pct: desagioPct, valor_comprador: valorComprador },
    fee: {
      fee_total_pct: feeTotalPct,
      fee_total_value: feeTotalValue,
      fee_v3_pct: feeV3Pct,
      v3_total_value: v3TotalValue,
      deducao_bancaria_pct: deducaoPct,
    },
    buy_side: buySide,
    sell_side: sellSide,
    recorrencia: {
      is_recorrente: input.is_recorrente,
      meses_recorrencia: meses,
      volume_total_acumulado: volumeTotalAcumulado,
      fee_total_acumulado: feeTotalAcumulado,
      buy_side_acumulado_liquido: round2(buySide.side_total_liquido * meses),
      sell_side_acumulado_liquido: round2(sellSide.side_total_liquido * meses),
    },
  };
}
