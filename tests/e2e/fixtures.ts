// Fixture fixa da suite de governanca de documentos (MPS Documentos V3 Fase 3).
// Deal "V3 Validacao Playwright Ltda" (MA-26-99184, v3_code V3-2026-07-IND-002),
// reaproveitado entre os specs para nao acumular deals de teste a cada execucao.
export const QA_DEAL_ID = "41f78955-b838-4aac-bdb5-a9bdf7368a84";
export const QA_DEAL_V3_CODE = "V3-2026-07-IND-002";
export const NONEXISTENT_DEAL_ID = "00000000-0000-0000-0000-000000000000";

export function uniqueFileContent(seed: string): string {
  return `FASE3-PLAYWRIGHT-${seed}-${Date.now()}-${Math.random()}`;
}
