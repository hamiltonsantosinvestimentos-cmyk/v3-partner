import type { SectorSchemaDefinition } from "./registry";

export interface RealEstateDespesasBreakdown {
  condominio?: number;
  iptu?: number;
  manutencao?: number;
  seguros?: number;
  administracao?: number;
  [categoria: string]: number | undefined;
}

// Série histórica/projetada de receita
export interface RealEstateReceitaEntry {
  ano: number;
  tipo: "realizado" | "projetado_base" | "projetado_expansao" | string;
  valor: number;
}

// NOI mensal ponto-a-ponto
export interface RealEstateNoiEntry {
  mes: string; // YYYY-MM
  valor: number;
}

// Vacância por pavimento/unidade
export interface RealEstateVacanciaEntry {
  pct: number;
  pavimento: string;
}

// Cenário financeiro nomeado
export interface RealEstateScenarioEntry {
  cap_rate?: number;
  noi_anual?: number;
  valuation?: number;
  [key: string]: number | undefined;
}

export interface RealEstateFinancialProjections {
  receita: RealEstateReceitaEntry[];
  noi_mensal: RealEstateNoiEntry[];
  vacancia_pct: RealEstateVacanciaEntry[];
  despesas_breakdown: RealEstateDespesasBreakdown;
  scenarios?: Record<string, RealEstateScenarioEntry>;
  last_updated?: string;
  updated_from_qa?: unknown[];
}

export const REAL_ESTATE_REQUIRED_FIELDS = [
  "receita",
  "noi_mensal",
  "vacancia_pct",
  "despesas_breakdown",
] as const;

export const realEstateSchemaV1: SectorSchemaDefinition<RealEstateFinancialProjections> = {
  id: "real-estate-v1",
  version: 1,
  sectorAliases: ["real estate", "imobiliario"],
  requiredFields: [...REAL_ESTATE_REQUIRED_FIELDS],
  panelComponent: "components/ma/business-plan/panels/real-estate-panel",
  validate: (raw) => {
    if (!raw || typeof raw !== "object") {
      return { valid: false, missingFields: [...REAL_ESTATE_REQUIRED_FIELDS] };
    }
    const obj = raw as Record<string, unknown>;
    const missing = REAL_ESTATE_REQUIRED_FIELDS.filter(
      (f) => obj[f] === undefined || obj[f] === null
    );
    if (missing.length > 0) {
      return { valid: false, missingFields: missing };
    }
    if (
      typeof obj.vacancia_pct === "number" &&
      (obj.vacancia_pct < 0 || obj.vacancia_pct > 100)
    ) {
      return { valid: false, missingFields: ["vacancia_pct (fora do intervalo 0-100)"] };
    }
    return { valid: true, data: obj as unknown as RealEstateFinancialProjections };
  },
};
