import type { SectorSchemaDefinition } from "./registry";

export interface RealEstateDespesasBreakdown {
  condominio?: number;
  iptu?: number;
  manutencao?: number;
  seguros?: number;
  administracao?: number;
  [categoria: string]: number | undefined;
}

export interface RealEstateScenario {
  nome: string;
  receita_projetada?: number;
  noi_projetado?: number;
  premissas?: string[];
}

export interface RealEstateFinancialProjections {
  receita: number;
  noi_mensal: number;
  vacancia_pct: number;
  despesas_breakdown: RealEstateDespesasBreakdown;
  scenarios?: RealEstateScenario[];
  meta?: {
    last_updated: string;
    updated_by?: string;
    updated_from_qa?: boolean;
  };
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
