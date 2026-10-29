import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

// Fixture da suite de governanca de documentos (MPS Documentos V3 Fase 3).
// Deal "V3 Validacao Playwright Ltda" (v3_code V3-2026-07-IND-002). A pasta MPS desse codigo
// continua em folder_registry; o deal em si foi apagado de ma_deals (sem rastro em audit_logs)
// e os specs de upload passaram a falhar com 404. Desde 28/10/2026 cada spec cria o deal que
// usa e apaga no final (createQaDeal/deleteQaDeal), sem depender de linha fixa no banco.
export const QA_DEAL_ID = "41f78955-b838-4aac-bdb5-a9bdf7368a84";
export const QA_DEAL_V3_CODE = "V3-2026-07-IND-002";
export const QA_DEAL_TITLE = "V3 Validacao Playwright Ltda";

function svc() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes (ver .env.local)");
  return createClient(url, key);
}

// Cria (ou recria) o deal de teste. Com withV3Code, usa o id e o v3_code fixos, que reaproveitam
// a pasta MPS ja existente; sem, um deal descartavel sem codigo (o upload cai no bucket de fallback).
export async function createQaDeal({ withV3Code }: { withV3Code: boolean }): Promise<string> {
  const db = svc();
  const { data: admin } = await db.from("profiles").select("id").eq("role", "ADMIN").limit(1).single();
  const id = withV3Code ? QA_DEAL_ID : randomUUID();
  const { error } = await db.from("ma_deals").upsert({
    id,
    code: withV3Code ? QA_DEAL_V3_CODE : `ZZTEST-E2E-${Date.now()}`,
    v3_code: withV3Code ? QA_DEAL_V3_CODE : null,
    title: QA_DEAL_TITLE,
    target_company: QA_DEAL_TITLE,
    created_by: admin!.id,
  });
  if (error) throw new Error(`createQaDeal: ${error.message}`);
  return id;
}

// Apaga o deal de teste; ma_documents e ma_deal_history saem junto (FK on delete cascade).
export async function deleteQaDeal(id: string): Promise<void> {
  await svc().from("ma_deals").delete().eq("id", id);
}
export const NONEXISTENT_DEAL_ID = "00000000-0000-0000-0000-000000000000";

// Fixture da suite da Bolsa de Capitais (Fase 3, SLA/Match/Qualificacao,
// 2026-07-28). Ativo "QA PLAYWRIGHT FIXTURE — NAO EXCLUIR" (CM-OT-FED-0002),
// reaproveitado entre execucoes, mesmo padrao do QA_DEAL_ID acima.
export const QA_CM_LISTING_ID = "6d56be58-30ec-4e62-aac5-ee14744ff009";
export const QA_CM_LISTING_ANONYMOUS_ID = "CM-OT-FED-0002";
export const NONEXISTENT_CONTRACT_ID = "00000000-0000-0000-0000-000000000000";

export function uniqueFileContent(seed: string): string {
  return `FASE3-PLAYWRIGHT-${seed}-${Date.now()}-${Math.random()}`;
}
