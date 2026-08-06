/**
 * Motor de calculo da Calculadora Rapida de Comissionamento (Mesa de Capitais).
 * Puro, sem I/O, usado pela API (/api/cm/commission-calculator) para computar
 * e persistir, e pode ser reaproveitado em teste unitario sem tocar banco.
 *
 * Convencao de base: o fee incide sobre valor_face, mesmo criterio ja usado pela
 * RPC calculate_cm_commission_split(p_valor_face, p_commission_percent).
 *
 * Split do fee total: buy_side_pct + sell_side_pct + fee_v3_pct = 100% do fee_total_pct.
 * fee_v3_pct e sempre digitado manualmente por operacao (a Mesa pode abrir mao ou
 * aumentar o comissionamento da V3 negociacao a negociacao), nunca calculado/fixo.
 */

export interface CommissionCalculatorInput {
  valor_face: number;
  desagio_pct?: number | null;
  is_recorrente: boolean;
  meses_recorrencia: number;
  fee_total_pct: number;
  fee_v3_pct: number;
  buy_side_pct: number;
  sell_side_pct: number;
  deducao_bancaria_pct: number;
}

export interface CommissionCalculatorResult {
  operacao: {
    valor_face: number;
    desagio_pct: number;
    valor_comprador: number; // Valor de Face x (1 - deságio)
  };
  split: {
    fee_total_pct: number;
    fee_total_value: number;
    grupo_compra: { pct: number; bruto: number; liquido: number };
    grupo_venda: { pct: number; bruto: number; liquido: number };
    v3_partners: { pct: number; bruto: number; liquido: number };
    deducao_bancaria_pct: number;
    diferenca_para_100_pct: number; // 100 - (buy+sell+v3), deve ficar ~0
  };
  recorrencia: {
    is_recorrente: boolean;
    meses_recorrencia: number;
    volume_total_acumulado: number;
    fee_total_acumulado: number;
    grupo_compra_acumulado_liquido: number;
    grupo_venda_acumulado_liquido: number;
    v3_partners_acumulado_liquido: number;
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

  const liquidoFactor = 1 - deducaoPct / 100;

  const grupoCompraBruto = round2(feeTotalValue * (buySidePct / 100));
  const grupoVendaBruto = round2(feeTotalValue * (sellSidePct / 100));
  const v3Bruto = round2(feeTotalValue * (feeV3Pct / 100));

  const grupoCompraLiquido = round2(grupoCompraBruto * liquidoFactor);
  const grupoVendaLiquido = round2(grupoVendaBruto * liquidoFactor);
  const v3Liquido = round2(v3Bruto * liquidoFactor);

  const volumeTotalAcumulado = round2(valorFace * meses);
  const feeTotalAcumulado = round2(feeTotalValue * meses);

  return {
    operacao: {
      valor_face: valorFace,
      desagio_pct: desagioPct,
      valor_comprador: valorComprador,
    },
    split: {
      fee_total_pct: feeTotalPct,
      fee_total_value: feeTotalValue,
      grupo_compra: { pct: buySidePct, bruto: grupoCompraBruto, liquido: grupoCompraLiquido },
      grupo_venda: { pct: sellSidePct, bruto: grupoVendaBruto, liquido: grupoVendaLiquido },
      v3_partners: { pct: feeV3Pct, bruto: v3Bruto, liquido: v3Liquido },
      deducao_bancaria_pct: deducaoPct,
      diferenca_para_100_pct: round4(100 - (buySidePct + sellSidePct + feeV3Pct)),
    },
    recorrencia: {
      is_recorrente: input.is_recorrente,
      meses_recorrencia: meses,
      volume_total_acumulado: volumeTotalAcumulado,
      fee_total_acumulado: feeTotalAcumulado,
      grupo_compra_acumulado_liquido: round2(grupoCompraLiquido * meses),
      grupo_venda_acumulado_liquido: round2(grupoVendaLiquido * meses),
      v3_partners_acumulado_liquido: round2(v3Liquido * meses),
    },
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
