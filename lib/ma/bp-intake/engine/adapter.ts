// Transforms raw intake form responses into FinancialProjections for the Business Plan Engine.
// Each deal sector has its own adapter function.
// FX snapshot must be passed in — never fetched here (pure-function contract).

import type { FxSnapshot } from "./fx-service";
import type { HedgeAnalysis, BgiViabilidadeResult } from "./hedge-calculator";
import { calcularHedge, calcularViabilidadeBGI } from "./hedge-calculator";

// ── Output types ──────────────────────────────────────────────────────────────

export interface AgronegocioProjectionYear {
  ano: number;
  receita_brl: number;
  receita_usd: number;
  receita_total_brl: number;
  receita_igg_select_brl?: number;
  custo_operacional_brl: number;
  ebitda_brl: number;
  margem_ebitda_pct: number;
  embrioes_nacionais: number;
  embrioes_exportados: number;
  embrioes_igg_select?: number;
}

export interface AgronegocioScenarioEntry {
  label: string;
  cagr_pct: number;
  valor_terminal_brl: number;
}

export interface AgronegocioProjections {
  schema_id: "agronegocio-v1";
  sub_sector: "genetica_bovina";
  horizon_years: number;
  fx_snapshot: FxSnapshot;
  hedge_analysis: HedgeAnalysis | null;
  viabilidade_bgi?: BgiViabilidadeResult;
  anos: AgronegocioProjectionYear[];
  receita: Array<{ ano: number; tipo: string; valor: number }>;
  scenarios: {
    base:      AgronegocioScenarioEntry;
    expansao:  AgronegocioScenarioEntry; // 18% — stress/comitê de crédito
    pessimista: AgronegocioScenarioEntry;
  };
  indicadores: {
    embrioes_produzidos_mes: number;
    taxa_prenhez_pct: number;
    preco_medio_embriao_brl: number;
    preco_medio_embriao_usd: number;
    hedge_natural_pct: number;
    exposicao_residual_usd: number;
    embrioes_igg_select_mes?: number;
    preco_medio_igg_select_brl?: number;
    custo_unitario_embriao_brl?: number;
    custo_unitario_igg_select_brl?: number;
    margem_custo_marketing_pct?: number;
    comissao_fixa_veterinario_brl?: number;
    preco_arroba_boi_gordo_rs?: number;
    custo_embriao_em_arrobas?: number;
  };
  benchmarks_aplicados: Record<string, number>;
}

// ── Adapter: Genética Bovina ──────────────────────────────────────────────────

export interface GeneticaBovinaIntakeData {
  // auditoria_preenchedor (audit trail — not used in calculation)
  nome_operador?: string;
  cargo_operador?: string;
  email_operador?: string;
  // producao_genetica
  n_matrizes_doadoras?: number;
  taxa_prenhez_pct?: number;
  embrioes_produzidos_mes?: number;
  embrioes_vitrificados_estoque?: number;
  racas_principais?: string;
  modelo_venda?: string;
  // proporcao_kit (conditional on modelo_venda)
  pct_machos_predeterminado?: number;
  pct_femeas_predeterminado?: number;
  // exportacao
  embrioes_exportados_mes?: number;
  // igg_select
  embrioes_igg_select_mes?: number;
  embrioes_igg_select_exportados_mes?: number;
  // precificacao
  preco_embriao_nacional_brl?: number;
  preco_embriao_exportacao_usd?: number;
  preco_igg_select_nacional_brl?: number;
  preco_igg_select_exportacao_usd?: number;
  preco_semen_dose_brl?: number;
  // custos operacionais
  custo_pessoal_mes_brl?: number;
  custo_insumos_mes_brl?: number;
  custo_veterinario_mes_brl?: number;
  custo_importado_usd_mes?: number;
  capex_expansao_brl?: number;
  // custos_ecossistema (new)
  custo_embriao_sem_sexagem?: number;
  custo_embriao_sexado?: number;
  margem_custo_marketing_pct?: number;
  comissao_fixa_veterinario?: number;
  // referencias_mercado
  crescimento_mercado_pct_aa?: number;
  // benchmarks from market_benchmarks table (pre-loaded)
  benchmark_crescimento_estabilizado_pct?: number;
  benchmark_crescimento_expansao_pct?: number;
  benchmark_crescimento_pessimista_pct?: number;
  benchmark_hedge_custo_ndf_pct?: number;
  benchmark_hedge_custo_opcao_pct?: number;
  // B3 BGI — indicador CEPEA/B3 SP (R$/@), referência de liquidação do contrato futuro
  benchmark_preco_arroba_boi_gordo_rs?: number;
  // Preços de referência de mercado (fallback quando o formulário não informa)
  benchmark_preco_medio_embriao_dom_brl?: number;
  benchmark_preco_medio_embriao_exp_usd?: number;
}

const HORIZON = 10;

export function adaptGeneticaBovinaIntake(
  data: GeneticaBovinaIntakeData,
  fx: FxSnapshot
): AgronegocioProjections {
  // ── Conventional embryo volumes ───────────────────────────────
  const taxa_prenhez = data.taxa_prenhez_pct ?? 62;
  const embrioes_mes = data.embrioes_produzidos_mes ?? 0;
  const embrioes_exp_mes = data.embrioes_exportados_mes ?? 0;
  const embrioes_nac_mes = Math.max(0, embrioes_mes - embrioes_exp_mes);

  // ── IGG Select (sexagem bovina) volumes ───────────────────────
  const embrioes_igg_mes = data.embrioes_igg_select_mes ?? 0;
  const embrioes_igg_exp_mes = data.embrioes_igg_select_exportados_mes ?? 0;
  const embrioes_igg_nac_mes = Math.max(0, embrioes_igg_mes - embrioes_igg_exp_mes);

  // ── Conventional embryo prices ────────────────────────────────
  // Fallback de mercado vem de market_benchmarks (preco_medio_embriao_dom_brl /
  // preco_medio_embriao_exp_usd) — nunca valor fixo no código.
  const preco_nac_brl = data.preco_embriao_nacional_brl ?? data.benchmark_preco_medio_embriao_dom_brl ?? 0;
  const preco_exp_usd = data.preco_embriao_exportacao_usd ?? data.benchmark_preco_medio_embriao_exp_usd ?? 0;

  // ── IGG Select prices ─────────────────────────────────────────
  const preco_igg_nac_brl = data.preco_igg_select_nacional_brl ?? 0;
  const preco_igg_exp_usd = data.preco_igg_select_exportacao_usd ?? 0;
  const preco_igg_exp_brl = preco_igg_exp_usd * fx.usd_brl;

  // ── Fixed operational costs ───────────────────────────────────
  const custo_pessoal = data.custo_pessoal_mes_brl ?? 0;
  const custo_insumos = data.custo_insumos_mes_brl ?? 0;
  const custo_vet = data.custo_veterinario_mes_brl ?? 0;
  const custo_usd_mes = data.custo_importado_usd_mes ?? 0;
  const custo_fixo_mes_brl =
    custo_pessoal + custo_insumos + custo_vet + custo_usd_mes * fx.usd_brl;

  // ── Ecosystem / variable costs ────────────────────────────────
  // custo_embriao_sem_sexagem / custo_embriao_sexado: per-unit production cost
  // margem_custo_marketing_pct: applied as % of annual revenue
  // comissao_fixa_veterinario: per-embryo commission for vet channel
  const custo_unitario_embriao = data.custo_embriao_sem_sexagem ?? 0;
  const custo_unitario_igg = data.custo_embriao_sexado ?? 0;
  const margem_marketing_pct = (data.margem_custo_marketing_pct ?? 0) / 100;
  const comissao_vet_brl = data.comissao_fixa_veterinario ?? 0;

  // ── B3 BGI (Boi Gordo) — viabilidade em arrobas-equivalentes ───
  // Redenomina o custo/margem unitária do embrião usando o indicador
  // CEPEA/B3 SP (R$/@) como unidade de conta — referência familiar ao
  // pecuarista comprador. Não altera o P&L em BRL.
  let viabilidade_bgi: BgiViabilidadeResult | undefined;
  const preco_arroba_bgi = data.benchmark_preco_arroba_boi_gordo_rs;
  if (preco_arroba_bgi && preco_arroba_bgi > 0 && custo_unitario_embriao > 0) {
    viabilidade_bgi = calcularViabilidadeBGI({
      custo_unitario_embriao_brl: custo_unitario_embriao,
      preco_medio_embriao_brl: preco_nac_brl,
      preco_arroba_boi_gordo_rs: preco_arroba_bgi,
      custo_unitario_igg_select_brl: custo_unitario_igg > 0 ? custo_unitario_igg : undefined,
      preco_medio_igg_select_brl: preco_igg_nac_brl > 0 ? preco_igg_nac_brl : undefined,
    });
  }

  // ── CAGR scenarios ────────────────────────────────────────────
  // cagr_base: central case (benchmark crescimento_mercado_pct_aa) — conservative,
  //   suitable for credit committees and Family Offices
  // cagr_expansao: upside stress (benchmark crescimento_estabilizado_pct) — strictly
  //   for scenarios.expansao node only
  // cagr_pessimista: downside (benchmark crescimento_pessimista_pct)
  // All three sourced from market_benchmarks — no hardcoded percentages.
  const cagr_base = (data.crescimento_mercado_pct_aa ?? 0) / 100;
  const cagr_expansao = (data.benchmark_crescimento_estabilizado_pct ?? 0) / 100;
  const cagr_pessimista = (data.benchmark_crescimento_pessimista_pct ?? 0) / 100;

  // ── Hedge analysis — includes IGG Select export USD ───────────
  const receita_usd_mes =
    embrioes_exp_mes * preco_exp_usd + embrioes_igg_exp_mes * preco_igg_exp_usd;
  let hedge_analysis: HedgeAnalysis | null = null;
  if (receita_usd_mes > 0) {
    hedge_analysis = calcularHedge({
      receita_usd_mes,
      custo_usd_mes,
      usd_brl: fx.usd_brl,
      hedge_custo_ndf_pct: data.benchmark_hedge_custo_ndf_pct ?? 0,
      hedge_custo_opcao_pct: data.benchmark_hedge_custo_opcao_pct ?? 0,
    });
  }

  // ── Base-year revenues (year 0, no compounding) ───────────────
  const rec_nac_base = embrioes_nac_mes * 12 * preco_nac_brl;
  const rec_exp_usd_base = embrioes_exp_mes * 12 * preco_exp_usd;
  const rec_exp_brl_base = rec_exp_usd_base * fx.usd_brl;
  const rec_igg_nac_base = embrioes_igg_nac_mes * 12 * preco_igg_nac_brl;
  const rec_igg_exp_brl_base = embrioes_igg_exp_mes * 12 * preco_igg_exp_brl;

  const anos: AgronegocioProjectionYear[] = [];
  const receita: AgronegocioProjections["receita"] = [];
  const baseYear = new Date().getFullYear();

  for (let y = 0; y < HORIZON; y++) {
    const growth = Math.pow(1 + cagr_base, y);

    // Revenue — conventional
    const rec_nac_brl = rec_nac_base * growth;
    const rec_exp_usd = rec_exp_usd_base * growth;
    const rec_exp_brl = rec_exp_brl_base * growth;

    // Revenue — IGG Select
    const rec_igg_nac_brl = rec_igg_nac_base * growth;
    const rec_igg_exp_brl = rec_igg_exp_brl_base * growth;
    const rec_igg_total_brl = rec_igg_nac_brl + rec_igg_exp_brl;

    const rec_total_brl = rec_nac_brl + rec_exp_brl + rec_igg_total_brl;

    // Costs
    const custo_fixo_brl = custo_fixo_mes_brl * 12 * growth;

    // Unit product costs grow with production volume
    const embrioes_nac_anual = embrioes_nac_mes * 12 * growth;
    const embrioes_exp_anual = embrioes_exp_mes * 12 * growth;
    const embrioes_igg_anual = embrioes_igg_mes * 12 * growth;
    const custo_produto_brl =
      (embrioes_nac_anual + embrioes_exp_anual) * custo_unitario_embriao +
      embrioes_igg_anual * custo_unitario_igg;

    // Marketing margin (% of revenue) — grows with revenue
    const custo_marketing_brl = rec_total_brl * margem_marketing_pct;

    // Vet channel commission (per embryo sold) — grows with volume
    const custo_comissao_brl =
      (embrioes_nac_anual + embrioes_exp_anual + embrioes_igg_anual) * comissao_vet_brl;

    const custo_op_brl =
      custo_fixo_brl + custo_produto_brl + custo_marketing_brl + custo_comissao_brl;

    const ebitda = rec_total_brl - custo_op_brl;
    const margem = rec_total_brl > 0 ? (ebitda / rec_total_brl) * 100 : 0;

    const yearEntry: AgronegocioProjectionYear = {
      ano: baseYear + y,
      receita_brl: Math.round(rec_nac_brl),
      receita_usd: Math.round(rec_exp_usd),
      receita_total_brl: Math.round(rec_total_brl),
      custo_operacional_brl: Math.round(custo_op_brl),
      ebitda_brl: Math.round(ebitda),
      margem_ebitda_pct: parseFloat(margem.toFixed(2)),
      embrioes_nacionais: Math.round(embrioes_nac_mes * growth) * 12,
      embrioes_exportados: Math.round(embrioes_exp_mes * growth) * 12,
    };

    if (embrioes_igg_mes > 0) {
      yearEntry.receita_igg_select_brl = Math.round(rec_igg_total_brl);
      yearEntry.embrioes_igg_select = Math.round(embrioes_igg_anual);
    }

    anos.push(yearEntry);

    receita.push(
      { ano: baseYear + y, tipo: "Nacional BRL", valor: Math.round(rec_nac_brl) },
      { ano: baseYear + y, tipo: "Exportação BRL", valor: Math.round(rec_exp_brl) }
    );
    if (rec_igg_nac_brl > 0) {
      receita.push({ ano: baseYear + y, tipo: "IGG Select Nacional BRL", valor: Math.round(rec_igg_nac_brl) });
    }
    if (rec_igg_exp_brl > 0) {
      receita.push({ ano: baseYear + y, tipo: "IGG Select Exportação BRL", valor: Math.round(rec_igg_exp_brl) });
    }
  }

  // ── Terminal values ───────────────────────────────────────────
  // base: year-10 EBITDA (12% curve) × 8× EV/EBITDA
  // expansao: year-5 EBITDA extrapolated 5y at 18% × 10× (higher multiple at peak growth)
  // pessimista: year-5 EBITDA extrapolated 5y at -5% × 6×
  const ebitda_terminal = anos[anos.length - 1]?.ebitda_brl ?? 0;
  const ebitda_y5 = anos[4]?.ebitda_brl ?? 0;

  const scenarios: AgronegocioProjections["scenarios"] = {
    base: {
      label: "Base",
      cagr_pct: cagr_base * 100,
      valor_terminal_brl: Math.round(ebitda_terminal * 8),
    },
    expansao: {
      label: "Expansão",
      cagr_pct: cagr_expansao * 100,
      valor_terminal_brl: Math.round(ebitda_y5 * Math.pow(1 + cagr_expansao, 5) * 10),
    },
    pessimista: {
      label: "Conservador",
      cagr_pct: cagr_pessimista * 100,
      valor_terminal_brl: Math.round(ebitda_y5 * Math.pow(1 + cagr_pessimista, 5) * 6),
    },
  };

  // ── Build indicadores ─────────────────────────────────────────
  const indicadores: AgronegocioProjections["indicadores"] = {
    embrioes_produzidos_mes: embrioes_mes,
    taxa_prenhez_pct: taxa_prenhez,
    preco_medio_embriao_brl: preco_nac_brl,
    preco_medio_embriao_usd: preco_exp_usd,
    hedge_natural_pct: hedge_analysis?.taxa_hedge_natural_pct ?? 0,
    exposicao_residual_usd: hedge_analysis?.exposicao_residual_usd ?? 0,
  };
  if (embrioes_igg_mes > 0) {
    indicadores.embrioes_igg_select_mes = embrioes_igg_mes;
    indicadores.preco_medio_igg_select_brl = preco_igg_nac_brl;
  }
  if (custo_unitario_embriao > 0) {
    indicadores.custo_unitario_embriao_brl = custo_unitario_embriao;
  }
  if (custo_unitario_igg > 0) {
    indicadores.custo_unitario_igg_select_brl = custo_unitario_igg;
  }
  if (margem_marketing_pct > 0) {
    indicadores.margem_custo_marketing_pct = margem_marketing_pct * 100;
  }
  if (comissao_vet_brl > 0) {
    indicadores.comissao_fixa_veterinario_brl = comissao_vet_brl;
  }
  if (viabilidade_bgi) {
    indicadores.preco_arroba_boi_gordo_rs = viabilidade_bgi.preco_arroba_boi_gordo_rs;
    indicadores.custo_embriao_em_arrobas = viabilidade_bgi.custo_embriao_em_arrobas;
  }

  // ── Build benchmarks_aplicados ────────────────────────────────
  const benchmarks_aplicados: Record<string, number> = {
    cagr_base_pct: cagr_base * 100,
    cagr_expansao_pct: cagr_expansao * 100,
    cagr_pessimista_pct: cagr_pessimista * 100,
  };
  if (custo_unitario_embriao > 0) {
    benchmarks_aplicados.custo_unitario_embriao_brl = custo_unitario_embriao;
  }
  if (custo_unitario_igg > 0) {
    benchmarks_aplicados.custo_unitario_igg_select_brl = custo_unitario_igg;
  }
  if (margem_marketing_pct > 0) {
    benchmarks_aplicados.margem_marketing_pct = margem_marketing_pct * 100;
  }
  if (comissao_vet_brl > 0) {
    benchmarks_aplicados.comissao_fixa_veterinario_brl = comissao_vet_brl;
  }
  if (viabilidade_bgi) {
    benchmarks_aplicados.preco_arroba_boi_gordo_rs = viabilidade_bgi.preco_arroba_boi_gordo_rs;
  }

  return {
    schema_id: "agronegocio-v1",
    sub_sector: "genetica_bovina",
    horizon_years: HORIZON,
    fx_snapshot: fx,
    hedge_analysis,
    ...(viabilidade_bgi ? { viabilidade_bgi } : {}),
    anos,
    receita,
    scenarios,
    indicadores,
    benchmarks_aplicados,
  };
}
