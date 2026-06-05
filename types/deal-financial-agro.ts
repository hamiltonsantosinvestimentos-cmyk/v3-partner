// Domain model financeiro para deals do setor Agropecuária / Genética Animal
// Persiste em ma_deals.asset_data.financial_projections (JSONB)
// Rota: GET|PATCH /api/ma/projections/[id]

export interface AgroFase1 {
  custo_embriao_brl: number;
  custo_dose_semen_brl: number;
  custo_iatf_brl: number;
  custo_igg_select_brl: number;
  custo_te_brl: number;
  opex_central_genetica_brl: number;
  volume_embrioes_ano: number;
  preco_venda_embriao_brl: number;
  preco_venda_dose_brl: number;
}

export interface AgroFase2 {
  custo_spe_juridico: number;
  custo_cvm88_estruturacao: number;
  custo_assessoria_legal_mes: number;
  receita_contrato_futuro_estimada: number;
}

export interface AgroFase3 {
  custo_gacc: number;
  custo_halal: number;
  custo_quarentena_cabeca: number;
  frete_medio_cabeca_usd: number;
  volume_cabecas_ano: number;
  preco_arroba_brl: number;
  rendimento_carcaca_pct: number;
}

export interface AgroScenario {
  receita_total: number;
  custo_total: number;
  ebitda: number;
  margem_pct: number;
}

export interface AgroFluxoMes {
  mes: number;
  receita: number;
  custo: number;
  saldo: number;
}

export interface AgroFinancialProjections {
  fase_1_mvp: AgroFase1;
  fase_2_contratos: AgroFase2;
  fase_3_exportacao: AgroFase3;
  scenarios: {
    base: AgroScenario;
    otimista: AgroScenario;
    conservador: AgroScenario;
  };
  fluxo_caixa_12m: AgroFluxoMes[];
  break_even: {
    fase_1_meses: number | null;
    fase_2_meses: number | null;
    fase_3_meses: number | null;
  };
  comparativo_igg: {
    igg_custo: number;
    citometria_custo: number;
    economia_pct: number;
  };
  meta: {
    last_updated: string;
    updated_by: string;
  };
}

export const emptyAgroProjections = (): AgroFinancialProjections => ({
  fase_1_mvp: {
    custo_embriao_brl: 0,
    custo_dose_semen_brl: 0,
    custo_iatf_brl: 0,
    custo_igg_select_brl: 0,
    custo_te_brl: 0,
    opex_central_genetica_brl: 0,
    volume_embrioes_ano: 0,
    preco_venda_embriao_brl: 0,
    preco_venda_dose_brl: 0,
  },
  fase_2_contratos: {
    custo_spe_juridico: 0,
    custo_cvm88_estruturacao: 0,
    custo_assessoria_legal_mes: 0,
    receita_contrato_futuro_estimada: 0,
  },
  fase_3_exportacao: {
    custo_gacc: 0,
    custo_halal: 0,
    custo_quarentena_cabeca: 0,
    frete_medio_cabeca_usd: 0,
    volume_cabecas_ano: 0,
    preco_arroba_brl: 0,
    rendimento_carcaca_pct: 62,
  },
  scenarios: {
    base:        { receita_total: 0, custo_total: 0, ebitda: 0, margem_pct: 0 },
    otimista:    { receita_total: 0, custo_total: 0, ebitda: 0, margem_pct: 0 },
    conservador: { receita_total: 0, custo_total: 0, ebitda: 0, margem_pct: 0 },
  },
  fluxo_caixa_12m: Array.from({ length: 12 }, (_, i) => ({
    mes: i + 1, receita: 0, custo: 0, saldo: 0,
  })),
  break_even: { fase_1_meses: null, fase_2_meses: null, fase_3_meses: null },
  comparativo_igg: { igg_custo: 60, citometria_custo: 250, economia_pct: 76 },
  meta: { last_updated: new Date().toISOString(), updated_by: "" },
});
