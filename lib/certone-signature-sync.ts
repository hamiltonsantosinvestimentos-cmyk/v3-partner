// lib/certone-signature-sync.ts
//
// Leva para o contrato o que a CertOne informa: uma nota na linha do tempo por assinatura e o
// fechamento quando o documento conclui. Usado pelo webhook (/api/webhooks/certone) e pelo botão
// "Atualizar status das assinaturas". Idempotente. Escreve só em contract_notes e, no fechamento,
// em operation_contracts (status e data).
//
// Não replica as ações que o webhook do ClickSign dispara no fechamento (FPA Venda, avanço do deal,
// linha do tempo do deal, clientes a performar, aviso de oferta): ficam para a fase 2.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCertOneSignatures } from "@/lib/esignature/certone-provider";
import { applyEnvelopeClosed, recordSignatureNote } from "@/lib/contract-signature-timeline";

const PROVIDER_LABEL = "CertOne";

export interface CertOneSyncContract {
  id: string;
  status_signature: string;
  parties: Array<{ email?: string | null; name?: string | null }> | null;
}

export type CertOneSyncResult =
  | { ok: true; documentStatus: string; total: number; assinaram: number; pendentes: string[]; novasNotas: number; fechado: boolean }
  | { ok: false; error: string; status: number };

export async function syncCertOneContract(db: SupabaseClient, contract: CertOneSyncContract, documentId: string): Promise<CertOneSyncResult> {
  // Só contrato em envio. Cancelado ou em rascunho pode manter o id de um documento antigo já concluído.
  if (contract.status_signature !== "enviado_assinatura") {
    return { ok: false, error: `contrato em ${contract.status_signature}, não está em envio para assinatura`, status: 409 };
  }

  const doc = await getCertOneSignatures(documentId);
  if (!doc.ok) return { ok: false, error: doc.error, status: doc.status };

  let novasNotas = 0;
  for (const sig of doc.signatures) {
    const r = await recordSignatureNote(db, { id: contract.id, parties: contract.parties }, { name: sig.name, email: sig.email, signedAt: sig.signedAt }, PROVIDER_LABEL);
    if (r === "criada") novasNotas++;
  }

  let fechado = false;
  if (doc.isConcluded) {
    fechado = await applyEnvelopeClosed(db, { id: contract.id, status_signature: contract.status_signature }, doc.lastSignedAt ?? new Date().toISOString(), PROVIDER_LABEL, true);
  }

  const parties = (contract.parties ?? []).filter((p) => p.email?.trim());
  const assinaram = new Set(doc.signatures.map((x) => x.email.toLowerCase()));
  const pendentes = parties.filter((p) => !assinaram.has(String(p.email).trim().toLowerCase())).map((p) => String(p.name ?? p.email));
  return { ok: true, documentStatus: doc.status, total: parties.length, assinaram: assinaram.size, pendentes, novasNotas, fechado };
}
