// Modelo financeiro base — 3-Statement Model (DRE, DFC, Indicadores)
// Estende ma_deals.asset_data.financial_projections (JSONB)
// Todos os campos são opcionais para backward compatibility com deals existentes

export interface DREEntry {
  ano: number;
  receita_liquida: number;
  ebitda: number;
  margem_ebitda: number;
  lucro_liquido: number;
}

export interface DFCEntry {
  ano: number;
  fluxo_caixa_operacional: number;
  capex: number;
  fluxo_caixa_livre: number;
}

export interface IndicadoresBase {
  irr: number;
  payback_nominal: number;
  working_capital_cycle_days: number;
}

export interface ScenarioBase {
  cap_rate?: number;
  yield_on_cost?: number;
  noi_anual?: number;
  valuation: number;
  desconto_aplicado_pct?: number;
}

export interface FinancialProjectionsBase {
  receita: Array<{ ano: number; tipo: string; valor: number }>;
  despesas_breakdown: Record<string, number>;
  dre_projetada?: DREEntry[];
  dfc_projetada?: DFCEntry[];
  indicadores?: IndicadoresBase;
  scenarios?: Record<string, ScenarioBase>;
}
