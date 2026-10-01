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
import { INSTRUMENT_DOCUMENT_LABELS } from "./qualification-schema";

export type KycDocumentKind =
  | "identificacao_foto"
  | "contrato_social"
  | "mandato"
  | "certidao_nascimento"
  | "termo_curatela"
  | "termo_tutela"
  | "termo_inventariante";

/**
 * Só a identificação com foto e o contrato social podem ser reaproveitados de uma operação
 * anterior (12 meses). O anexo do instrumento de representação é próprio de cada relação
 * (BRIEF 5.11): nunca reaproveitado.
 */
export const KYC_REUSABLE_KINDS: readonly KycDocumentKind[] = ["identificacao_foto", "contrato_social"];

/**
 * Tipos de anexo de instrumento que a Fase 1B aceita (B1 mandato, C1 termo de inventariante).
 * certidao_nascimento, termo_curatela e termo_tutela (B2 e B3) ficam reservados para a
 * sub-entrega 1D, junto com a declaração do representante legal de menor.
 */
export const KYC_INSTRUMENT_KINDS_ENABLED: readonly KycDocumentKind[] = ["mandato", "termo_inventariante"];

export const KYC_VALIDITY_MONTHS = 12;

export const KYC_DOCUMENT_KIND_LABELS: Record<KycDocumentKind, string> = {
  identificacao_foto: "Documento de Identificação com Foto",
  contrato_social: "Contrato Social / Estatuto",
  mandato: INSTRUMENT_DOCUMENT_LABELS.mandato,
  certidao_nascimento: INSTRUMENT_DOCUMENT_LABELS.certidao_nascimento,
  termo_curatela: INSTRUMENT_DOCUMENT_LABELS.termo_curatela,
  termo_tutela: INSTRUMENT_DOCUMENT_LABELS.termo_tutela,
  termo_inventariante: INSTRUMENT_DOCUMENT_LABELS.termo_inventariante,
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
  // Compliance (11/09/2026, pedido de Robson Lino): IP de quem enviou.
  uploaded_ip: string | null;
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
