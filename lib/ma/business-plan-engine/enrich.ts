// Enriquecimento matemático de financial_projections para o Modelo 3-Statement
// Deriva DRE, DFC e Indicadores a partir dos dados operacionais existentes.
// NUNCA persiste — retorna payload enriquecido apenas para uso no engine.

import type { RealEstateFinancialProjections } from "@/lib/ma/business-plan-schemas/real-estate-v1";
import type { DREEntry, DFCEntry, IndicadoresBase } from "@/types/financial";

// Newton-Raphson IRR solver — converge em <20 iterações para IRR entre 0% e 50%
export function calculateIRR(cashFlows: number[], guess = 0.08): number {
  let r = guess;
  for (let i = 0; i < 100; i++) {
    let npv = 0;
    let dNpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const disc = Math.pow(1 + r, t);
      npv += cashFlows[t] / disc;
      dNpv -= (t * cashFlows[t]) / (disc * (1 + r));
    }
    if (Math.abs(dNpv) < 1e-10) break;
    const rNew = r - npv / dNpv;
    if (Math.abs(rNew - r) < 1e-7) return parseFloat(rNew.toFixed(4));
    r = rNew;
  }
  return parseFloat(r.toFixed(4));
}

// Deriva margem NOI a partir do cenário base e da receita âncora (projetado_base)
function resolveNoiMargin(fp: RealEstateFinancialProjections): number {
  const baseScenario = fp.scenarios?.base;
  if (!baseScenario?.noi_anual || !fp.receita?.length) return 0.45;
  const anchor =
    fp.receita.find((r) => r.tipo === "projetado_base") ??
    fp.receita[fp.receita.length - 1];
  return anchor ? baseScenario.noi_anual / anchor.valor : 0.45;
}

export function deriveREDRE(fp: RealEstateFinancialProjections): DREEntry[] {
  if (!fp.receita?.length) return [];
  const noiMargin = resolveNoiMargin(fp);
  return fp.receita.map((entry) => {
    const ebitda = Math.round(entry.valor * noiMargin);
    return {
      ano: entry.ano,
      receita_liquida: Math.round(entry.valor),
      ebitda,
      margem_ebitda: parseFloat(noiMargin.toFixed(4)),
      // Lucro líquido: EBITDA − D&A (~10%) − imposto simplificado (~8%)
      lucro_liquido: Math.round(ebitda * 0.82),
    };
  });
}

export function deriveREDFC(
  fp: RealEstateFinancialProjections,
  capexRatePct = 0.04
): DFCEntry[] {
  if (!fp.receita?.length) return [];
  const noiMargin = resolveNoiMargin(fp);
  return fp.receita.map((entry) => {
    const fcop = Math.round(entry.valor * noiMargin);
    const capex = Math.round(entry.valor * capexRatePct);
    return {
      ano: entry.ano,
      fluxo_caixa_operacional: fcop,
      capex,
      fluxo_caixa_livre: fcop - capex,
    };
  });
}

export function deriveREIndicadores(
  fp: RealEstateFinancialProjections,
  holdYears = 10,
  exitCapRate = 0.03,
  noiCagr = 0.065
): IndicadoresBase {
  const base = fp.scenarios?.base;
  if (!base?.noi_anual || !base?.valuation) {
    return { irr: 0, payback_nominal: 0, working_capital_cycle_days: 30 };
  }

  // Fluxo de caixa para IRR: entrada negativa + NOI crescente + saída pelo cap rate de exit
  const cashFlows: number[] = [-base.valuation];
  let noi = base.noi_anual;
  for (let t = 1; t <= holdYears; t++) {
    if (t > 1) noi = noi * (1 + noiCagr);
    cashFlows.push(t === holdYears ? noi + noi / exitCapRate : noi);
  }

  const irr = calculateIRR(cashFlows);

  // Payback nominal: capital / NOI médio ao longo do horizonte (sem terminal)
  const noiFinal = base.noi_anual * Math.pow(1 + noiCagr, holdYears - 1);
  const avgNoi = (base.noi_anual + noiFinal) / 2;
  const paybackNominal = parseFloat((base.valuation / avgNoi).toFixed(1));

  return {
    irr,
    payback_nominal: paybackNominal,
    // Ciclo de capital de giro: aluguel cobrado mensalmente, despesas com 30 dias
    working_capital_cycle_days: 30,
  };
}

export type EnrichedREProjections = RealEstateFinancialProjections & {
  dre_projetada: DREEntry[];
  dfc_projetada: DFCEntry[];
  indicadores: IndicadoresBase;
  _enriched: true;
};

export function enrichREProjections(
  fp: RealEstateFinancialProjections
): EnrichedREProjections {
  return {
    ...fp,
    dre_projetada: deriveREDRE(fp),
    dfc_projetada: deriveREDFC(fp),
    indicadores: deriveREIndicadores(fp),
    _enriched: true,
  };
}
