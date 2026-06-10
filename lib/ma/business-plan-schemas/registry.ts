import { realEstateSchemaV1 } from "./real-estate-v1";
import { agronegocioV1Schema } from "./agronegocio-v1";

export type SectorSchemaId =
  | "real-estate-v1"
  | "agronegocio-v1"
  | "energia-v1"
  | "mineracao-v1"
  | "credito-v1";

export interface SectorSchemaDefinition<T = unknown> {
  id: SectorSchemaId;
  version: number;
  sectorAliases: string[];
  validate: (raw: unknown) => { valid: boolean; data?: T; missingFields?: string[] };
  requiredFields: string[];
  panelComponent: string;
}

export const SECTOR_ALIASES: Record<string, SectorSchemaId> = {
  "real estate": "real-estate-v1",
  imobiliario: "real-estate-v1",
  "agronegócio": "agronegocio-v1",
  agronegocio: "agronegocio-v1",
  "agropecuária": "agronegocio-v1",
  agropecuaria: "agronegocio-v1",
  energia: "energia-v1",
  "energia solar": "energia-v1",
  "mineração": "mineracao-v1",
  mineracao: "mineracao-v1",
  metais: "mineracao-v1",
  "crédito": "credito-v1",
  credito: "credito-v1",
  "recebíveis": "credito-v1",
};

export function resolveSchemaForSector(sector: string | null): SectorSchemaId | null {
  if (!sector) return null;
  return SECTOR_ALIASES[sector.trim().toLowerCase()] ?? null;
}

export const SCHEMA_REGISTRY: Record<SectorSchemaId, SectorSchemaDefinition | null> = {
  "real-estate-v1": realEstateSchemaV1,
  "agronegocio-v1": agronegocioV1Schema,
  "energia-v1": null,
  "mineracao-v1": null,
  "credito-v1": null,
};

export function getSchemaDefinition(schemaId: SectorSchemaId | null): SectorSchemaDefinition | null {
  if (!schemaId) return null;
  return SCHEMA_REGISTRY[schemaId] ?? null;
}
