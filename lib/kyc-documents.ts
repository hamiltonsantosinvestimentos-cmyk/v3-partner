/**
 * REAPROVEITAMENTO DE KYC (Anexo ID + Contrato Social) — Client 360
 *
 * Documentos de KYC (foto de identificação, contrato social) são ancorados
 * por v3_client_id (cm_party_qualification_documents), não por qualificação
 * individual -- o mesmo CPF/CNPJ reaproveita o arquivo já enviado numa
 * operação anterior, sem duplicar bytes no Storage. Ver migration
 * 20260904d_kyc_document_reuse.sql para o racional completo.
 *
 * Validade: 12 meses corridos a partir de uploaded_at, calculada em runtime
 * (nunca armazenada como coluna própria -- fonte de verdade única).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type KycDocumentKind = "identificacao_foto" | "contrato_social";

export const KYC_VALIDITY_MONTHS = 12;

export const KYC_DOCUMENT_KIND_LABELS: Record<KycDocumentKind, string> = {
  identificacao_foto: "Documento de Identificação com Foto",
  contrato_social: "Contrato Social / Estatuto",
};

// Tipos de arquivo aceitos e tamanho máximo -- validado no client e no server.
export const KYC_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
export const KYC_MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export interface KycDocumentRow {
  id: string;
  v3_client_id: string;
  document_kind: KycDocumentKind;
  owner_label: string | null;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  uploaded_by_qualification_id: string | null;
  uploaded_at: string;
}

/** Data-limite (ISO) a partir da qual um documento enviado hoje deixaria de ser válido. */
export function kycValidUntil(uploadedAt: string): string {
  const d = new Date(uploadedAt);
  d.setMonth(d.getMonth() + KYC_VALIDITY_MONTHS);
  return d.toISOString();
}

export function isKycDocumentValid(uploadedAt: string): boolean {
  return new Date(kycValidUntil(uploadedAt)).getTime() > Date.now();
}

/** Documento válido mais recente de um cliente para um tipo, ou null se não houver / estiver vencido. */
export async function findValidKycDocument(
  db: SupabaseClient,
  v3ClientId: string,
  kind: KycDocumentKind
): Promise<KycDocumentRow | null> {
  const { data } = await db
    .from("cm_party_qualification_documents")
    .select("*")
    .eq("v3_client_id", v3ClientId)
    .eq("document_kind", kind)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return isKycDocumentValid(data.uploaded_at) ? (data as KycDocumentRow) : null;
}
