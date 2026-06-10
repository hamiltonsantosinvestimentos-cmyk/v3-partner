import type { SectorSchemaDefinition } from "./registry";

export interface AgronegocioProjectionYear {
  ano: number;
  receita_total_brl: number;
  ebitda_brl: number;
  margem_ebitda_pct: number;
  [key: string]: number;
}

export interface AgronegocioFinancialProjections {
  schema_id: "agronegocio-v1";
  sub_sector?: string;
  anos: AgronegocioProjectionYear[];
  receita: Array<{ ano: number; tipo: string; valor: number }>;
  scenarios: {
    base:      { label: string; cagr_pct: number; valor_terminal_brl: number };
    expansao:  { label: string; cagr_pct: number; valor_terminal_brl: number };
    pessimista: { label: string; cagr_pct: number; valor_terminal_brl: number };
  };
  indicadores: {
    taxa_prenhez_pct?: number;
    embrioes_produzidos_mes?: number;
    preco_medio_embriao_brl?: number;
    preco_medio_embriao_usd?: number;
    hedge_natural_pct?: number;
    exposicao_residual_usd?: number;
    [key: string]: number | undefined;
  };
  fx_snapshot?: { usd_brl: number; source: string; date: string; fetched_at: string };
  hedge_analysis?: Record<string, unknown> | null;
  benchmarks_aplicados?: Record<string, number>;
}

const AGRONEGOCIO_REQUIRED_FIELDS = ["anos", "receita", "scenarios", "indicadores"] as const;

export const agronegocioV1Schema: SectorSchemaDefinition<AgronegocioFinancialProjections> = {
  id: "agronegocio-v1",
  version: 1,
  sectorAliases: ["agronegócio", "agronegocio", "agropecuária", "agropecuaria"],
  requiredFields: [...AGRONEGOCIO_REQUIRED_FIELDS],
  panelComponent: "components/ma/business-plan/panels/agronegocio-panel",
  validate: (raw) => {
    if (!raw || typeof raw !== "object") {
      return { valid: false, missingFields: [...AGRONEGOCIO_REQUIRED_FIELDS] };
    }
    const obj = raw as Record<string, unknown>;
    const missing = AGRONEGOCIO_REQUIRED_FIELDS.filter(
      (f) => obj[f] === undefined || obj[f] === null
    );
    if (missing.length > 0) {
      return { valid: false, missingFields: missing };
    }
    if (!Array.isArray(obj.anos) || (obj.anos as unknown[]).length === 0) {
      return { valid: false, missingFields: ["anos (array vazio)"] };
    }
    return { valid: true, data: obj as unknown as AgronegocioFinancialProjections };
  },
};
