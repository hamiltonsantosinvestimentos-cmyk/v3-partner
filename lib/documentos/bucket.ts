/**
 * Bucket do Storage de um anexo de proposta de crédito. Regra extraída sem mudança de
 * app/api/credit-proposals/documents/route.ts (BRIEF 09/11/2026, nomear documentos), para a leitura
 * por IA, a rota de documentos e o ZIP usarem a mesma regra.
 */
export const DEFAULT_BUCKET = "credit-documents";
export const GOVERNED_BUCKET = "v3-docs-publico";

export function resolveBucket(doc: { storage_path?: string; bucket?: string }): string {
  if (doc.bucket) return doc.bucket;
  if (doc.storage_path?.startsWith("Credito/") || doc.storage_path?.startsWith("MA/") || doc.storage_path?.startsWith("Administracao/")) return GOVERNED_BUCKET;
  return DEFAULT_BUCKET;
}
