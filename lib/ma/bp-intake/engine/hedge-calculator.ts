// Pure function — no side effects, no I/O.
// Input: USD revenues, USD costs, BRL costs, FX rate + benchmark hedge costs.
// Output: HedgeAnalysis with natural hedge ratio + residual exposure + scenarios.

export interface HedgeInput {
  receita_usd_mes: number;        // USD revenue / month
  custo_usd_mes: number;          // USD costs / month (natural hedge offset)
  usd_brl: number;                // current spot rate
  hedge_custo_ndf_pct: number;    // % of notional for NDF contract (benchmark)
  hedge_custo_opcao_pct: number;  // % of notional for FX option
}

export interface HedgeScenario {
  label: string;
  usd_brl_assumed: number;
  receita_brl: number;
  custo_hedge_brl: number;
  resultado_liquido_brl: number;
  variacao_vs_spot_pct: number;
}

export interface HedgeAnalysis {
  // Raw exposures
  receita_usd_mes: number;
  custo_usd_mes: number;
  exposicao_liquida_usd: number;  // revenue - natural-hedge costs
  taxa_hedge_natural_pct: number; // % covered by USD costs
  exposicao_residual_usd: number; // net USD that needs hedging

  // BRL equivalents at spot
  receita_brl_spot: number;
  exposicao_residual_brl_spot: number;

  // Annual hedge costs
  custo_anual_ndf_brl: number;
  custo_anual_opcao_brl: number;

  // 3 scenarios (BRL appreciation, spot, BRL depreciation)
  scenarios: HedgeScenario[];

  // Recommendation
  instrumento_sugerido: "NDF" | "Opcao_Cambio" | "Natural_Suficiente";
  justificativa: string;
}

export function calcularHedge(input: HedgeInput): HedgeAnalysis {
  const {
    receita_usd_mes,
    custo_usd_mes,
    usd_brl,
    hedge_custo_ndf_pct,
    hedge_custo_opcao_pct,
  } = input;

  // ── Natural hedge ─────────────────────────────────────────────
  const taxa_hedge_natural_pct =
    receita_usd_mes > 0
      ? Math.min(100, (custo_usd_mes / receita_usd_mes) * 100)
      : 0;

  const exposicao_liquida_usd = Math.max(0, receita_usd_mes - custo_usd_mes);
  const exposicao_residual_usd = exposicao_liquida_usd; // net after natural hedge
  const exposicao_residual_brl_spot = exposicao_residual_usd * usd_brl;
  const receita_brl_spot = receita_usd_mes * usd_brl;

  // ── Annual hedge costs (on residual notional, monthly × 12) ───
  const notional_anual_usd = exposicao_residual_usd * 12;
  const notional_anual_brl = notional_anual_usd * usd_brl;
  const custo_anual_ndf_brl  = notional_anual_brl * (hedge_custo_ndf_pct / 100);
  const custo_anual_opcao_brl = notional_anual_brl * (hedge_custo_opcao_pct / 100);

  // ── Scenarios ─────────────────────────────────────────────────
  const buildScenario = (
    label: string,
    fx: number,
    custo_hedge_brl: number
  ): HedgeScenario => {
    const receita_brl = receita_usd_mes * fx;
    const resultado_liquido_brl = receita_brl - custo_hedge_brl;
    const variacao_vs_spot_pct =
      receita_brl_spot > 0
        ? ((resultado_liquido_brl - receita_brl_spot) / receita_brl_spot) * 100
        : 0;
    return {
      label,
      usd_brl_assumed: parseFloat(fx.toFixed(4)),
      receita_brl: Math.round(receita_brl),
      custo_hedge_brl: Math.round(custo_hedge_brl),
      resultado_liquido_brl: Math.round(resultado_liquido_brl),
      variacao_vs_spot_pct: parseFloat(variacao_vs_spot_pct.toFixed(2)),
    };
  };

  const fxApreciacao = usd_brl * 0.85;  // BRL +15%
  const fxDepreciacao = usd_brl * 1.15; // BRL -15%
  const custo_hedge_mensal_ndf = custo_anual_ndf_brl / 12;

  const scenarios: HedgeScenario[] = [
    buildScenario("Apreciação BRL (-15% USD)", fxApreciacao, custo_hedge_mensal_ndf),
    buildScenario("Câmbio spot (atual)", usd_brl, 0),
    buildScenario("Depreciação BRL (+15% USD)", fxDepreciacao, custo_hedge_mensal_ndf),
  ];

  // ── Recommendation ────────────────────────────────────────────
  let instrumento_sugerido: HedgeAnalysis["instrumento_sugerido"];
  let justificativa: string;

  if (taxa_hedge_natural_pct >= 80) {
    instrumento_sugerido = "Natural_Suficiente";
    justificativa = `Hedge natural de ${taxa_hedge_natural_pct.toFixed(0)}% — custos USD cobrem a maior parte da receita USD. Hedge financeiro não necessário neste estágio.`;
  } else if (exposicao_residual_usd <= 5000) {
    instrumento_sugerido = "Natural_Suficiente";
    justificativa = `Exposição residual pequena (USD ${exposicao_residual_usd.toFixed(0)}/mês). Custo do instrumento superaria o benefício.`;
  } else if (custo_anual_ndf_brl < custo_anual_opcao_brl) {
    instrumento_sugerido = "NDF";
    justificativa = `NDF mais eficiente: custo anual estimado R$ ${Math.round(custo_anual_ndf_brl).toLocaleString("pt-BR")} vs R$ ${Math.round(custo_anual_opcao_brl).toLocaleString("pt-BR")} da opção. Indicado para exposição de alta recorrência mensal.`;
  } else {
    instrumento_sugerido = "Opcao_Cambio";
    justificativa = `Opção de câmbio recomendada para preservar upside em cenários de depreciação do BRL. Custo anual estimado: R$ ${Math.round(custo_anual_opcao_brl).toLocaleString("pt-BR")}.`;
  }

  return {
    receita_usd_mes,
    custo_usd_mes,
    exposicao_liquida_usd,
    taxa_hedge_natural_pct: parseFloat(taxa_hedge_natural_pct.toFixed(2)),
    exposicao_residual_usd,
    receita_brl_spot: Math.round(receita_brl_spot),
    exposicao_residual_brl_spot: Math.round(exposicao_residual_brl_spot),
    custo_anual_ndf_brl: Math.round(custo_anual_ndf_brl),
    custo_anual_opcao_brl: Math.round(custo_anual_opcao_brl),
    scenarios,
    instrumento_sugerido,
    justificativa,
  };
}
