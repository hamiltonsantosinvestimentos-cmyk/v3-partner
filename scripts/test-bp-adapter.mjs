// Adapter math test — mirrors adapter.ts exactly, pure JS
// Runs without compilation: node scripts/test-bp-adapter.mjs
// Uses NELBLUE (MA-26-013) realistic parameters from the Vendedor brief.
// Inclui Capital Stacking — Modelo A (MVP Orgânico) vs Modelo B (Expansão
// Institucional + Giro Rápido).

const HORIZON = 10;
const FX_FALLBACK = 5.75;

// Indicador B3 BGI (Boi Gordo, CEPEA/B3 SP) usado como referência de revenda no
// Giro Rápido quando o formulário não informa um preço de arroba específico.
const BGI_INDEX_FALLBACK_BRL = 346.0;

// ── Hedge calculator (mirrors hedge-calculator.ts) ────────────────────
function calcularHedge({ receita_usd_mes, custo_usd_mes, usd_brl, hedge_custo_ndf_pct, hedge_custo_opcao_pct }) {
  const exposicao_liquida_usd = receita_usd_mes - custo_usd_mes;
  const taxa_hedge_natural_pct = custo_usd_mes / receita_usd_mes * 100;
  const exposicao_residual_usd = Math.max(0, exposicao_liquida_usd);

  const custo_ndf_anual_brl = exposicao_residual_usd * 12 * usd_brl * (hedge_custo_ndf_pct / 100);
  const custo_opcao_anual_brl = exposicao_residual_usd * 12 * usd_brl * (hedge_custo_opcao_pct / 100);

  const instrumento = custo_ndf_anual_brl <= custo_opcao_anual_brl ? "NDF" : "opcao_cambial";
  const custo_anual_brl = instrumento === "NDF" ? custo_ndf_anual_brl : custo_opcao_anual_brl;

  return {
    taxa_hedge_natural_pct: parseFloat(taxa_hedge_natural_pct.toFixed(2)),
    exposicao_residual_usd: Math.round(exposicao_residual_usd),
    instrumento_sugerido: instrumento,
    custo_anual_ndf_brl: Math.round(custo_ndf_anual_brl),
    custo_anual_opcao_brl: Math.round(custo_opcao_anual_brl),
    custo_anual_recomendado_brl: Math.round(custo_anual_brl),
    justificativa: `Hedge natural: ${taxa_hedge_natural_pct.toFixed(1)}% — instrumento: ${instrumento}`,
  };
}

// ── Gera a série de 10 anos (receita/custo/EBITDA) para um dado CAGR ─────────
// Mirrors buildYearSeries() in adapter.ts — compartilhada pelo Modelo A
// (cagr_base) e pelo Modelo B (cagr_expansao), mesma unit economics.
function buildYearSeries(cagr, b) {
  const anos = [];
  const receita = [];

  for (let y = 0; y < HORIZON; y++) {
    const growth = Math.pow(1 + cagr, y);

    const rec_nac_brl = b.rec_nac_base * growth;
    const rec_exp_usd = b.rec_exp_usd_base * growth;
    const rec_exp_brl = b.rec_exp_brl_base * growth;
    const rec_total_brl = rec_nac_brl + rec_exp_brl;

    const custo_op_brl = b.custo_fixo_mes_brl * 12 * growth;

    const ebitda = rec_total_brl - custo_op_brl;
    const margem = rec_total_brl > 0 ? (ebitda / rec_total_brl) * 100 : 0;

    anos.push({
      ano: b.baseYear + y,
      receita_brl: Math.round(rec_nac_brl),
      receita_usd: Math.round(rec_exp_usd),
      receita_total_brl: Math.round(rec_total_brl),
      custo_operacional_brl: Math.round(custo_op_brl),
      ebitda_brl: Math.round(ebitda),
      margem_ebitda_pct: parseFloat(margem.toFixed(2)),
      fcl_brl: Math.round(ebitda),
      embrioes_nacionais: Math.round(b.embrioes_nac_mes * growth) * 12,
      embrioes_exportados: Math.round(b.embrioes_exp_mes * growth) * 12,
    });

    receita.push(
      { ano: b.baseYear + y, tipo: "Nacional BRL", valor: Math.round(rec_nac_brl) },
      { ano: b.baseYear + y, tipo: "Exportação BRL", valor: Math.round(rec_exp_brl) },
    );
  }

  return { anos, receita };
}

// ── Adapter (mirrors adapter.ts exactly) ────────────────────────────
function adaptGeneticaBovinaIntake(data, fx) {
  const taxa_prenhez = data.taxa_prenhez_pct ?? 62;
  const embrioes_mes = data.embrioes_produzidos_mes ?? 0;
  const embrioes_exp_mes = data.embrioes_exportados_mes ?? 0;
  const embrioes_nac_mes = Math.max(0, embrioes_mes - embrioes_exp_mes);

  const preco_nac_brl = data.preco_embriao_nacional_brl ?? 4500;
  const preco_exp_usd = data.preco_embriao_exportacao_usd ?? 850;

  const custo_pessoal = data.custo_pessoal_mes_brl ?? 0;
  const custo_insumos = data.custo_insumos_mes_brl ?? 0;
  const custo_vet = data.custo_veterinario_mes_brl ?? 0;
  const custo_usd_mes = data.custo_importado_usd_mes ?? 0;
  const custo_fixo_mes_brl = custo_pessoal + custo_insumos + custo_vet + custo_usd_mes * fx.usd_brl;

  // CAGR scenarios — cagr_base é a curva do Modelo A (MVP Orgânico, 12%);
  // cagr_expansao é a curva do Modelo B (Expansão Institucional, 18%)
  const cagr_base = (data.crescimento_mercado_pct_aa ?? 12) / 100;
  const cagr_expansao = (data.benchmark_crescimento_estabilizado_pct ?? 18) / 100;
  const cagr_pessimista = (data.benchmark_crescimento_pessimista_pct ?? -5) / 100;

  // Hedge
  const receita_usd_mes = embrioes_exp_mes * preco_exp_usd;
  let hedge_analysis = null;
  if (receita_usd_mes > 0) {
    hedge_analysis = calcularHedge({
      receita_usd_mes, custo_usd_mes, usd_brl: fx.usd_brl,
      hedge_custo_ndf_pct: data.benchmark_hedge_custo_ndf_pct ?? 3.5,
      hedge_custo_opcao_pct: data.benchmark_hedge_custo_opcao_pct ?? 5.2,
    });
  }

  // Base-year revenue (year 0, no compounding — applied ONCE per year)
  const rec_nac_base = embrioes_nac_mes * 12 * preco_nac_brl;
  const rec_exp_usd_base = embrioes_exp_mes * 12 * preco_exp_usd;
  const rec_exp_brl_base = rec_exp_usd_base * fx.usd_brl;

  const baseYear = 2026;

  const yearSeriesBases = {
    baseYear,
    rec_nac_base,
    rec_exp_usd_base,
    rec_exp_brl_base,
    custo_fixo_mes_brl,
    embrioes_nac_mes,
    embrioes_exp_mes,
  };

  // ── Modelo A (MVP Orgânico) e Modelo B (Expansão Institucional) ────
  const seriesA = buildYearSeries(cagr_base, yearSeriesBases);
  const seriesB = buildYearSeries(cagr_expansao, yearSeriesBases);

  // ── Capital Stacking — Fase 1 (Capex originador) e Fase 2 (capital
  // institucional + Giro Rápido) ─────────────────────────────────────
  const capexFase1 = data.capex_fase1_producao_brl ?? 0;
  const aporteFase2 = data.aporte_fase2_institucional_brl ?? 0;
  const instrumentoFase2 =
    data.instrumento_fase2 === "Dívida Estruturada"
      ? "divida_estruturada"
      : data.instrumento_fase2 === "Equity Sênior"
        ? "equity_senior"
        : "nao_definido";

  const giroCabecas = data.giro_gado_cabecas ?? 0;
  const giroArrobasCompra = data.giro_gado_arrobas_compra ?? 0;
  const giroPrecoCompra = data.giro_gado_preco_arroba_compra_brl ?? 0;
  const giroArrobasDesmame = data.giro_gado_arrobas_desmame ?? 0;
  const giroMesesAteVenda = data.giro_gado_meses_ate_venda ?? 12;
  const precoArrobaBgi = data.benchmark_preco_arroba_boi_gordo_rs ?? BGI_INDEX_FALLBACK_BRL;

  // Giro Rápido: capital de giro investido na compra de receptoras (Ano 1) e
  // receita de revenda travada via B3 BGI no ano correspondente ao prazo de
  // engorda/desmame. Fluxo SEGREGADO — não entra em receita_total_brl/ebitda.
  const capital_giro_brl = giroCabecas * giroArrobasCompra * giroPrecoCompra;
  const receita_giro_brl = giroCabecas * giroArrobasDesmame * precoArrobaBgi;
  const resultado_giro_brl = receita_giro_brl - capital_giro_brl;
  const ano_resultado_idx = Math.min(HORIZON - 1, Math.max(0, Math.round(giroMesesAteVenda / 12)));

  // Modelo A: FCL = EBITDA − Capex Fase 1 (apenas no Ano 1)
  const anosA = seriesA.anos.map((entry, idx) => ({
    ...entry,
    fcl_brl: Math.round(entry.ebitda_brl - (idx === 0 ? capexFase1 : 0)),
  }));

  // Modelo B: FCL = EBITDA − Capex Fase 1 − Capital de Giro (Ano 1) +
  // Resultado do Giro Rápido (no ano de revenda)
  const anosB = seriesB.anos.map((entry, idx) => {
    let fcl = entry.ebitda_brl;
    if (idx === 0) fcl -= capexFase1;
    if (idx === 0) fcl -= capital_giro_brl;
    if (idx === ano_resultado_idx) fcl += resultado_giro_brl;
    return { ...entry, fcl_brl: Math.round(fcl) };
  });

  const modelo_a = {
    label: "Modelo A — MVP Orgânico",
    cagr_aplicado_pct: cagr_base * 100,
    anos: anosA,
    receita: seriesA.receita,
  };

  const modelo_b = {
    label: "Modelo B — Expansão Institucional",
    cagr_aplicado_pct: cagr_expansao * 100,
    anos: anosB,
    receita: seriesB.receita,
  };

  const capital_stack = {
    fase_1: {
      label: "Fase 1 — Capex Originador",
      fonte: "Cotas de Investimento Tokenizadas (RWA) — Produtores Rurais Parceiros",
      capex_brl: capexFase1,
      descricao:
        "Capex inicial do centro de melhoramento genético (infraestrutura, laboratórios, matrizes doadoras), " +
        "aportado pelos produtores rurais parceiros via cotas de investimento tokenizadas com lastro em ativo real.",
    },
    fase_2: {
      label: "Fase 2 — Capital de Aceleração Institucional",
      fonte: "Capital Institucional Externo",
      aporte_brl: aporteFase2,
      instrumento: instrumentoFase2,
      estrategia:
        "Giro Rápido — aquisição de receptoras no mercado físico com revenda travada via B3 BGI (Boi Gordo)",
      descricao:
        "O aporte institucional financia a aquisição de gado receptor no mercado físico; a revenda é projetada " +
        "ao indicador B3 BGI (CEPEA/B3 SP), e o lote serve de base de recepção para os embriões sexados do centro " +
        "genético, acelerando a escala de produção do Modelo B frente ao Modelo A.",
      ...(giroCabecas > 0
        ? {
            giro_gado: {
              cabecas: giroCabecas,
              capital_giro_brl: Math.round(capital_giro_brl),
              receita_giro_brl: Math.round(receita_giro_brl),
              resultado_giro_brl: Math.round(resultado_giro_brl),
              ano_resultado: baseYear + ano_resultado_idx,
              preco_arroba_bgi_brl: precoArrobaBgi,
            },
          }
        : {}),
    },
  };

  const ebitda_terminal = anosA[anosA.length - 1]?.ebitda_brl ?? 0;
  const ebitda_y5 = anosA[4]?.ebitda_brl ?? 0;

  const scenarios = {
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

  return {
    schema_id: "agronegocio-v1",
    sub_sector: "genetica_bovina",
    horizon_years: HORIZON,
    fx_snapshot: fx,
    hedge_analysis,
    // Espelhos do Modelo A — Zero Breaking Changes para consumidores existentes
    anos: modelo_a.anos,
    receita: modelo_a.receita,
    scenarios,
    indicadores: {
      embrioes_produzidos_mes: embrioes_mes,
      taxa_prenhez_pct: taxa_prenhez,
      preco_medio_embriao_brl: preco_nac_brl,
      preco_medio_embriao_usd: preco_exp_usd,
      hedge_natural_pct: hedge_analysis?.taxa_hedge_natural_pct ?? 0,
      exposicao_residual_usd: hedge_analysis?.exposicao_residual_usd ?? 0,
    },
    benchmarks_aplicados: {
      cagr_base_pct: cagr_base * 100,
      cagr_expansao_pct: cagr_expansao * 100,
      cagr_pessimista_pct: cagr_pessimista * 100,
    },
    modelo_a,
    modelo_b,
    capital_stack,
  };
}

// ── NELBLUE realistic test parameters ─────────────────────────────────
const NELBLUE_INPUT = {
  n_matrizes_doadoras: 52,
  taxa_prenhez_pct: 65,
  embrioes_produzidos_mes: 80,
  embrioes_exportados_mes: 22,
  preco_embriao_nacional_brl: 4800,
  preco_embriao_exportacao_usd: 920,
  custo_pessoal_mes_brl: 48000,
  custo_insumos_mes_brl: 32000,
  custo_veterinario_mes_brl: 18000,
  custo_importado_usd_mes: 2500,
  crescimento_mercado_pct_aa: 12,
  benchmark_crescimento_estabilizado_pct: 18,
  benchmark_crescimento_pessimista_pct: -5,
  benchmark_hedge_custo_ndf_pct: 3.5,
  benchmark_hedge_custo_opcao_pct: 5.2,
  // ── Capital Stacking — Fase 1 (Capex Originador) + Fase 2 (Capital
  // Institucional / Giro Rápido) ────────────────────────────────────
  capex_fase1_producao_brl: 2500000,
  aporte_fase2_institucional_brl: 8000000,
  instrumento_fase2: "Dívida Estruturada",
  giro_gado_cabecas: 500,
  giro_gado_arrobas_compra: 18,
  giro_gado_preco_arroba_compra_brl: 280,
  giro_gado_arrobas_desmame: 24,
  giro_gado_meses_ate_venda: 12,
};

const FX = { usd_brl: FX_FALLBACK, source: "fallback", date: "2026-06-09", fetched_at: new Date().toISOString() };

const result = adaptGeneticaBovinaIntake(NELBLUE_INPUT, FX);

// ── Assertions ──────────────────────────────────────────────────────
console.log("=== ADAPTER TEST — NELBLUE (MA-26-013) — Capital Stacking ===\n");

// 1. Year-0 math verification
const y0 = result.anos[0];
const embNac = NELBLUE_INPUT.embrioes_produzidos_mes - NELBLUE_INPUT.embrioes_exportados_mes;
const expectedRec0 = embNac * 12 * NELBLUE_INPUT.preco_embriao_nacional_brl
  + NELBLUE_INPUT.embrioes_exportados_mes * 12 * NELBLUE_INPUT.preco_embriao_exportacao_usd * FX_FALLBACK;
const diff0 = Math.abs(y0.receita_total_brl - Math.round(expectedRec0));

console.log(`[1] Year-0 receita_total_brl:`);
console.log(`    Expected: ${Math.round(expectedRec0).toLocaleString("pt-BR")}`);
console.log(`    Got:      ${y0.receita_total_brl.toLocaleString("pt-BR")}`);
console.log(`    PASS: ${diff0 <= 1 ? "✓" : "✗ FAIL — diff=" + diff0}\n`);

// 2. CAGR Base 12% — year-1 must be year-0 × 1.12
const y1 = result.anos[1];
const expected_y1_rec = y0.receita_total_brl * 1.12;
const cagr_diff = Math.abs(y1.receita_total_brl - Math.round(expected_y1_rec));
console.log(`[2] CAGR Base 12% — Year-1 = Year-0 × 1.12:`);
console.log(`    Expected: ${Math.round(expected_y1_rec).toLocaleString("pt-BR")}`);
console.log(`    Got:      ${y1.receita_total_brl.toLocaleString("pt-BR")}`);
console.log(`    PASS: ${cagr_diff <= 2 ? "✓" : "✗ FAIL — diff=" + cagr_diff}\n`);

// 3. No double-compounding: year-5 ebitda sanity check
const y5 = result.anos[4];
const growth5 = Math.pow(1.12, 4);
const expectedEbitda5 = (expectedRec0 * growth5) - (NELBLUE_INPUT.custo_pessoal_mes_brl + NELBLUE_INPUT.custo_insumos_mes_brl + NELBLUE_INPUT.custo_veterinario_mes_brl + NELBLUE_INPUT.custo_importado_usd_mes * FX_FALLBACK) * 12 * growth5;
const ebitda5_diff = Math.abs(y5.ebitda_brl - Math.round(expectedEbitda5));
console.log(`[3] No double-compounding — Year-5 EBITDA:`);
console.log(`    Expected: ${Math.round(expectedEbitda5).toLocaleString("pt-BR")}`);
console.log(`    Got:      ${y5.ebitda_brl.toLocaleString("pt-BR")}`);
console.log(`    PASS: ${ebitda5_diff <= 5 ? "✓" : "✗ FAIL — diff=" + ebitda5_diff}\n`);

// 4. scenarios keys must be base/expansao/pessimista (not otimista)
const scenarioKeys = Object.keys(result.scenarios);
const hasExpansao = scenarioKeys.includes("expansao");
const hasOtimista = scenarioKeys.includes("otimista");
console.log(`[4] scenarios keys: ${JSON.stringify(scenarioKeys)}`);
console.log(`    expansao present: ${hasExpansao ? "✓" : "✗ FAIL"}`);
console.log(`    otimista absent:  ${!hasOtimista ? "✓" : "✗ FAIL — otimista still present"}\n`);

// 5. Expansão CAGR must be 18
const s = result.scenarios;
console.log(`[5] Scenario CAGRs:`);
console.log(`    base:      ${s.base.cagr_pct}% (expected 12) ${s.base.cagr_pct === 12 ? "✓" : "✗"}`);
console.log(`    expansao:  ${s.expansao.cagr_pct}% (expected 18) ${s.expansao.cagr_pct === 18 ? "✓" : "✗"}`);
console.log(`    pessimista: ${s.pessimista.cagr_pct}% (expected -5) ${s.pessimista.cagr_pct === -5 ? "✓" : "✗"}\n`);

// 6. schema_id
console.log(`[6] schema_id: ${result.schema_id} ${result.schema_id === "agronegocio-v1" ? "✓" : "✗ FAIL"}\n`);

// 7. Hedge analysis present (NELBLUE has exports)
console.log(`[7] Hedge analysis: ${result.hedge_analysis ? "present ✓" : "null ✗ FAIL"}`);
if (result.hedge_analysis) {
  console.log(`    Instrumento: ${result.hedge_analysis.instrumento_sugerido}`);
  console.log(`    Taxa natural: ${result.hedge_analysis.taxa_hedge_natural_pct}%`);
  console.log(`    Custo NDF anual: R$${result.hedge_analysis.custo_anual_ndf_brl.toLocaleString("pt-BR")}\n`);
}

// 8. modelo_a / modelo_b — CAGRs aplicados e alias de raiz (Zero Breaking Changes)
const { modelo_a, modelo_b, capital_stack } = result;
console.log(`[8] Modelo A / Modelo B — CAGR aplicado:`);
console.log(`    modelo_a.cagr_aplicado_pct: ${modelo_a.cagr_aplicado_pct}% (expected 12) ${modelo_a.cagr_aplicado_pct === 12 ? "✓" : "✗ FAIL"}`);
console.log(`    modelo_b.cagr_aplicado_pct: ${modelo_b.cagr_aplicado_pct}% (expected 18) ${modelo_b.cagr_aplicado_pct === 18 ? "✓" : "✗ FAIL"}`);
const rootAliasOk = result.anos[0].fcl_brl === modelo_a.anos[0].fcl_brl && result.receita.length === modelo_a.receita.length;
console.log(`    root anos/receita === modelo_a (alias): ${rootAliasOk ? "✓" : "✗ FAIL"}\n`);

// 9. Capex Fase 1 — FCL Modelo A Ano 1 = EBITDA Ano 1 − Capex Fase 1
const capexFase1 = NELBLUE_INPUT.capex_fase1_producao_brl;
const expectedFclA0 = modelo_a.anos[0].ebitda_brl - capexFase1;
console.log(`[9] Modelo A — FCL Ano 1 = EBITDA − Capex Fase 1:`);
console.log(`    Expected: ${expectedFclA0.toLocaleString("pt-BR")}`);
console.log(`    Got:      ${modelo_a.anos[0].fcl_brl.toLocaleString("pt-BR")}`);
console.log(`    PASS: ${modelo_a.anos[0].fcl_brl === expectedFclA0 ? "✓" : "✗ FAIL"}\n`);

// 10. Giro Rápido — capital de giro, receita travada via BGI fallback (R$346) e resultado
const giroCabecas = NELBLUE_INPUT.giro_gado_cabecas;
const capitalGiroEsperado = giroCabecas * NELBLUE_INPUT.giro_gado_arrobas_compra * NELBLUE_INPUT.giro_gado_preco_arroba_compra_brl;
const receitaGiroEsperada = giroCabecas * NELBLUE_INPUT.giro_gado_arrobas_desmame * BGI_INDEX_FALLBACK_BRL;
const resultadoGiroEsperado = receitaGiroEsperada - capitalGiroEsperado;
const giroGado = capital_stack.fase_2.giro_gado;
console.log(`[10] Giro Rápido (fallback BGI R$${BGI_INDEX_FALLBACK_BRL}):`);
console.log(`    capital_giro_brl:   esperado ${capitalGiroEsperado.toLocaleString("pt-BR")} | got ${giroGado.capital_giro_brl.toLocaleString("pt-BR")} ${giroGado.capital_giro_brl === capitalGiroEsperado ? "✓" : "✗ FAIL"}`);
console.log(`    receita_giro_brl:   esperado ${receitaGiroEsperada.toLocaleString("pt-BR")} | got ${giroGado.receita_giro_brl.toLocaleString("pt-BR")} ${giroGado.receita_giro_brl === receitaGiroEsperada ? "✓" : "✗ FAIL"}`);
console.log(`    resultado_giro_brl: esperado ${resultadoGiroEsperado.toLocaleString("pt-BR")} | got ${giroGado.resultado_giro_brl.toLocaleString("pt-BR")} ${giroGado.resultado_giro_brl === resultadoGiroEsperado ? "✓" : "✗ FAIL"}`);
console.log(`    preco_arroba_bgi_brl: ${giroGado.preco_arroba_bgi_brl} (expected ${BGI_INDEX_FALLBACK_BRL}) ${giroGado.preco_arroba_bgi_brl === BGI_INDEX_FALLBACK_BRL ? "✓" : "✗ FAIL"}\n`);

// 11. Modelo B — FCL Ano 1 = EBITDA − Capex Fase 1 − Capital de Giro; FCL Ano 2 = EBITDA + Resultado do Giro
const expectedFclB0 = modelo_b.anos[0].ebitda_brl - capexFase1 - capitalGiroEsperado;
const anoResultadoIdx = Math.min(HORIZON - 1, Math.max(0, Math.round(NELBLUE_INPUT.giro_gado_meses_ate_venda / 12)));
const expectedFclB1 = modelo_b.anos[anoResultadoIdx].ebitda_brl + resultadoGiroEsperado;
console.log(`[11] Modelo B — FCL com Giro Rápido injetado:`);
console.log(`    Ano 1 (ano_idx=0): esperado ${Math.round(expectedFclB0).toLocaleString("pt-BR")} | got ${modelo_b.anos[0].fcl_brl.toLocaleString("pt-BR")} ${modelo_b.anos[0].fcl_brl === Math.round(expectedFclB0) ? "✓" : "✗ FAIL"}`);
console.log(`    Ano ${anoResultadoIdx + 1} (ano_idx=${anoResultadoIdx}): esperado ${Math.round(expectedFclB1).toLocaleString("pt-BR")} | got ${modelo_b.anos[anoResultadoIdx].fcl_brl.toLocaleString("pt-BR")} ${modelo_b.anos[anoResultadoIdx].fcl_brl === Math.round(expectedFclB1) ? "✓" : "✗ FAIL"}`);
console.log(`    giro_gado.ano_resultado: ${giroGado.ano_resultado} (expected ${2026 + anoResultadoIdx}) ${giroGado.ano_resultado === 2026 + anoResultadoIdx ? "✓" : "✗ FAIL"}\n`);

// 12. Giro Rápido segregado — receita_total_brl/ebitda_brl NÃO são afetados pelo Giro
const recIgualA0 = modelo_a.anos[0].receita_total_brl === modelo_b.anos[0].receita_total_brl;
const ebitdaIgualA0 = modelo_a.anos[0].ebitda_brl === modelo_b.anos[0].ebitda_brl;
console.log(`[12] Giro Rápido segregado (não polui receita/EBITDA recorrentes em Ano 1):`);
console.log(`    receita_total_brl A === B (y0, mesmo growth^0=1): ${recIgualA0 ? "✓" : "✗ FAIL"}`);
console.log(`    ebitda_brl A === B (y0, mesmo growth^0=1):        ${ebitdaIgualA0 ? "✓" : "✗ FAIL"}\n`);

// 13. capital_stack — estrutura Fase 1 / Fase 2
console.log(`[13] capital_stack:`);
console.log(`    fase_1.capex_brl: ${capital_stack.fase_1.capex_brl.toLocaleString("pt-BR")} (expected ${capexFase1.toLocaleString("pt-BR")}) ${capital_stack.fase_1.capex_brl === capexFase1 ? "✓" : "✗ FAIL"}`);
console.log(`    fase_2.aporte_brl: ${capital_stack.fase_2.aporte_brl.toLocaleString("pt-BR")} (expected ${NELBLUE_INPUT.aporte_fase2_institucional_brl.toLocaleString("pt-BR")}) ${capital_stack.fase_2.aporte_brl === NELBLUE_INPUT.aporte_fase2_institucional_brl ? "✓" : "✗ FAIL"}`);
console.log(`    fase_2.instrumento: ${capital_stack.fase_2.instrumento} (expected divida_estruturada) ${capital_stack.fase_2.instrumento === "divida_estruturada" ? "✓" : "✗ FAIL"}`);
console.log(`    fase_1.fonte: ${capital_stack.fase_1.fonte}`);
console.log(`    fase_2.fonte: ${capital_stack.fase_2.fonte}\n`);

// 14. Summary financials
console.log("=== FINANCIAL SUMMARY ===");
console.log(`Receita Ano 1:     R$${y0.receita_total_brl.toLocaleString("pt-BR")}`);
console.log(`EBITDA  Ano 1:     R$${y0.ebitda_brl.toLocaleString("pt-BR")} (${y0.margem_ebitda_pct}%)`);
console.log(`EBITDA  Ano 5:     R$${y5.ebitda_brl.toLocaleString("pt-BR")}`);
console.log(`EBITDA  Ano 10:    R$${result.anos[9].ebitda_brl.toLocaleString("pt-BR")}`);
console.log(`ValTerminal Base:  R$${s.base.valor_terminal_brl.toLocaleString("pt-BR")}`);
console.log(`ValTerminal Exp:   R$${s.expansao.valor_terminal_brl.toLocaleString("pt-BR")}`);
console.log(`ValTerminal Cons:  R$${s.pessimista.valor_terminal_brl.toLocaleString("pt-BR")}`);
console.log(`\n--- Modelo A (MVP Orgânico, CAGR ${modelo_a.cagr_aplicado_pct}%) ---`);
console.log(`FCL Ano 1:  R$${modelo_a.anos[0].fcl_brl.toLocaleString("pt-BR")}`);
console.log(`FCL Ano 10: R$${modelo_a.anos[9].fcl_brl.toLocaleString("pt-BR")}`);
console.log(`\n--- Modelo B (Expansão Institucional, CAGR ${modelo_b.cagr_aplicado_pct}%) ---`);
console.log(`FCL Ano 1:  R$${modelo_b.anos[0].fcl_brl.toLocaleString("pt-BR")}`);
console.log(`FCL Ano 2:  R$${modelo_b.anos[1].fcl_brl.toLocaleString("pt-BR")} (ponto de virada — Giro Rápido)`);
console.log(`FCL Ano 10: R$${modelo_b.anos[9].fcl_brl.toLocaleString("pt-BR")}`);

// Output the full projections JSON for DB injection
const fs = await import("fs");
const outputPath = "./scripts/nelblue-projections.json";
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`\nProjections saved to: ${outputPath}`);
