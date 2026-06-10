// Adapter math test — mirrors adapter.ts exactly, pure JS
// Runs without compilation: node scripts/test-bp-adapter.mjs
// Uses NELBLUE (MA-26-013) realistic parameters from the Vendedor brief.

const HORIZON = 10;
const FX_FALLBACK = 5.75;

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
  const custo_total_mes_brl = custo_pessoal + custo_insumos + custo_vet + custo_usd_mes * fx.usd_brl;

  // CAGR scenarios — cagr_base is the MAIN projection curve (12%)
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

  const anos = [];
  const receita = [];
  const currentYear = 2026;

  for (let y = 0; y < HORIZON; y++) {
    const growth = Math.pow(1 + cagr_base, y);
    const rec_nac_brl = rec_nac_base * growth;
    const rec_exp_usd = rec_exp_usd_base * growth;
    const rec_exp_brl = rec_exp_brl_base * growth;
    const rec_total_brl = rec_nac_brl + rec_exp_brl;
    const custo_op_brl = custo_total_mes_brl * 12 * growth;
    const ebitda = rec_total_brl - custo_op_brl;
    const margem = rec_total_brl > 0 ? (ebitda / rec_total_brl) * 100 : 0;

    anos.push({
      ano: currentYear + y,
      receita_brl: Math.round(rec_nac_brl),
      receita_usd: Math.round(rec_exp_usd),
      receita_total_brl: Math.round(rec_total_brl),
      custo_operacional_brl: Math.round(custo_op_brl),
      ebitda_brl: Math.round(ebitda),
      margem_ebitda_pct: parseFloat(margem.toFixed(2)),
      embrioes_nacionais: Math.round(embrioes_nac_mes * growth) * 12,
      embrioes_exportados: Math.round(embrioes_exp_mes * growth) * 12,
    });
    receita.push(
      { ano: currentYear + y, tipo: "Nacional BRL", valor: Math.round(rec_nac_brl) },
      { ano: currentYear + y, tipo: "Exportação BRL", valor: Math.round(rec_exp_brl) },
    );
  }

  const ebitda_terminal = anos[anos.length - 1]?.ebitda_brl ?? 0;
  const ebitda_y5 = anos[4]?.ebitda_brl ?? 0;

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
    anos,
    receita,
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
};

const FX = { usd_brl: FX_FALLBACK, source: "fallback", date: "2026-06-09", fetched_at: new Date().toISOString() };

const result = adaptGeneticaBovinaIntake(NELBLUE_INPUT, FX);

// ── Assertions ──────────────────────────────────────────────────────
console.log("=== ADAPTER TEST — NELBLUE (MA-26-013) ===\n");

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

// 8. Summary financials
console.log("=== FINANCIAL SUMMARY ===");
console.log(`Receita Ano 1:     R$${y0.receita_total_brl.toLocaleString("pt-BR")}`);
console.log(`EBITDA  Ano 1:     R$${y0.ebitda_brl.toLocaleString("pt-BR")} (${y0.margem_ebitda_pct}%)`);
console.log(`EBITDA  Ano 5:     R$${y5.ebitda_brl.toLocaleString("pt-BR")}`);
console.log(`EBITDA  Ano 10:    R$${result.anos[9].ebitda_brl.toLocaleString("pt-BR")}`);
console.log(`ValTerminal Base:  R$${s.base.valor_terminal_brl.toLocaleString("pt-BR")}`);
console.log(`ValTerminal Exp:   R$${s.expansao.valor_terminal_brl.toLocaleString("pt-BR")}`);
console.log(`ValTerminal Cons:  R$${s.pessimista.valor_terminal_brl.toLocaleString("pt-BR")}`);

// Output the full projections JSON for DB injection
const fs = await import("fs");
const outputPath = "./scripts/nelblue-projections.json";
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`\nProjections saved to: ${outputPath}`);
