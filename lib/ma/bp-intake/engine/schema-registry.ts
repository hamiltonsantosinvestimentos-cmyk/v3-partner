// ══════════════════════════════════════════════════════════════
//  BP Intake — Schema Registry
//  Config files por setor definem campos, seções e condicionalidade.
//  O renderer genérico (form-renderer.tsx) consome este registry.
// ══════════════════════════════════════════════════════════════

export type FieldType =
  | "number"
  | "currency"      // BRL
  | "currency_usd"  // USD — exibe badge USD, converte no adapter
  | "percentage"
  | "text"
  | "select";

export interface IntakeField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  hint?: string;
  options?: string[];   // para type: "select"
  min?: number;
  max?: number;
}

export interface SectionCondition {
  /** Seção só aparece se esta tag estiver presente no estado do form */
  tag?: string;
  /** Seção só aparece se outro campo tiver este valor */
  field_equals?: { key: string; value: string };
}

export interface IntakeSection {
  id: string;
  title: string;
  description?: string;
  condition?: SectionCondition;
  fields: IntakeField[];
}

export interface IntakeSchema {
  id: string;
  label: string;
  sector: string;
  sub_sector?: string;
  /** ID do schema pai — herda suas seções como base */
  parent_schema_id?: string;
  /** Tags ativam módulos condicionais (ex: "startup", "exportacao") */
  tags: string[];
  sections: IntakeSection[];
}

// ── Registry ──────────────────────────────────────────────────

import { baseSchema }           from "../schemas/_base";
import { agronegocioV1Schema }  from "../schemas/agronegocio-v1";
import { geneticaBovinaV1Schema } from "../schemas/genetica-bovina-v1";

export type IntakeSchemaId =
  | "_base"
  | "agronegocio-v1"
  | "genetica-bovina-v1"
  | "real-estate-v1"   // placeholder — schema completo na Fase 2
  | "credito-v1";      // placeholder — schema completo na Fase 2

export const INTAKE_REGISTRY: Record<string, IntakeSchema> = {
  "_base":               baseSchema,
  "agronegocio-v1":      agronegocioV1Schema,
  "genetica-bovina-v1":  geneticaBovinaV1Schema,
};

/** Resolve schema pelo setor do deal (mesmo mapeamento do bp-schemas registry) */
export const INTAKE_SECTOR_MAP: Record<string, string> = {
  "real estate":     "real-estate-v1",
  "agronegócio":     "agronegocio-v1",
  "agronegocio":     "agronegocio-v1",
  "agropecuária":    "agronegocio-v1",
  "agropecuaria":    "agronegocio-v1",
  // sub-setores — podem ser passados via asset_data.sub_sector
  "melhoramento genético": "genetica-bovina-v1",
  "genética bovina":       "genetica-bovina-v1",
  "genetica bovina":       "genetica-bovina-v1",
  "genetica_bovina":       "genetica-bovina-v1",
  "genética_bovina":       "genetica-bovina-v1",
};

export function resolveIntakeSchema(
  sector: string | null | undefined,
  subSector?: string | null
): IntakeSchema {
  const normalised = (sector ?? "").toLowerCase().trim();
  const normSub    = (subSector ?? "").toLowerCase().trim();

  // Sub-sector tem precedência
  if (normSub && INTAKE_REGISTRY[INTAKE_SECTOR_MAP[normSub] ?? ""]) {
    return INTAKE_REGISTRY[INTAKE_SECTOR_MAP[normSub]]!;
  }
  const schemaId = INTAKE_SECTOR_MAP[normalised];
  return INTAKE_REGISTRY[schemaId ?? ""] ?? baseSchema;
}
