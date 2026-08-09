/**
 * REGISTRO CENTRAL DE CLIENTE V3 (CLIENT 360)
 *
 * CONTEXTO
 *   Identidade de cliente vivia isolada por vertical: credit_desk_proposals
 *   guarda client_cpf_cnpj, cm_asset_listings guarda seller_cpf_cnpj,
 *   credit_profiles guarda subject_cpf_cnpj, partner_registrations guarda
 *   cpf/cnpj separados. Nenhuma dessas colunas referenciava a outra —
 *   impossível responder "tudo que a V3 já fez com este CPF/CNPJ" com uma
 *   query só. Fase 1, aprovada por João em 08/08/2026.
 *
 * REGRA
 *   Toda vez que uma rota grava um CPF/CNPJ numa das 4 tabelas vinculadas
 *   (credit_desk_proposals, cm_asset_listings, credit_profiles,
 *   partner_registrations), chama resolveClient() para obter o v3_client_id
 *   e grava junto. Nunca calcular/adivinhar o vínculo na aplicação.
 *
 * PRÉ-REQUISITO
 *   Migration 20260810a_v3_clients.sql aplicada. O backfill histórico
 *   (20260810b) é separado e está gated por sign-off LGPD do Robson — não
 *   aplicado ainda. resolveClient() funciona independente disso: ele só
 *   afeta linhas novas a partir de quando for chamado.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type V3DocumentType = "CPF" | "CNPJ";

function serviceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Remove tudo que não é dígito. É a chave de identidade — nunca comparar com máscara. */
export function normalizeDocument(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** CPF tem 11 dígitos, CNPJ tem 14. Qualquer outro tamanho não é documento válido. */
export function detectDocumentType(digits: string): V3DocumentType | null {
  if (digits.length === 11) return "CPF";
  if (digits.length === 14) return "CNPJ";
  return null;
}

/**
 * Resolve o v3_client_id de um CPF/CNPJ: acha se já existe, cria se não
 * existir. Idempotente sob concorrência via upsert com onConflict — duas
 * requisições simultâneas para o mesmo documento nunca criam dois registros.
 *
 * Retorna null quando o documento não é um CPF/CNPJ válido (11 ou 14
 * dígitos). Nunca cria um registro "sujo" no Client 360 a partir de dado
 * claramente incompleto ou digitado errado — melhor ficar sem vínculo do
 * que vincular a um documento inválido.
 */
export async function resolveClient(
  cpfCnpj: string | null | undefined,
  opts: { legalName?: string | null; vertical?: string; db?: SupabaseClient } = {}
): Promise<string | null> {
  const digits = normalizeDocument(cpfCnpj);
  const docType = detectDocumentType(digits);
  if (!docType) return null;

  const svc = opts.db ?? serviceClient();

  const { data: existing } = await svc
    .from("v3_clients")
    .select("id")
    .eq("document_number", digits)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await svc
    .from("v3_clients")
    .upsert(
      {
        document_number: digits,
        document_type: docType,
        legal_name: opts.legalName ?? null,
        first_seen_vertical: opts.vertical ?? null,
      },
      { onConflict: "document_number", ignoreDuplicates: false }
    )
    .select("id")
    .single();

  if (error) {
    console.warn(`[v3-clients] falha ao resolver ${docType} ${digits}: ${error.message}`);
    return null;
  }
  return (created?.id as string) ?? null;
}
