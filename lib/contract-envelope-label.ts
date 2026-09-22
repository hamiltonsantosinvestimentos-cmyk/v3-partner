// lib/contract-envelope-label.ts
//
// Nome do envelope de assinatura (e do arquivo enviado ao provedor). Até 21/09/2026 era
// `${contract_code} · ${contract_title}`, e contract_title é o nome INTERNO da minuta
// (ex: "NCNDA V3 PARTNERS MODELO 2026 09 03"), que os signatários viam no convite.
// Decisão de João: o envelope leva número do contrato, tipo, setor e partner.
//
// O código do contrato vem SEMPRE primeiro: o arquivamento automático do PDF assinado
// (lib/clicksign-archive.ts) casa o anexo pelo prefixo "{contract_code} ".
import { VERTICAL_LABELS } from "@/lib/contract-verticals";

const SERIES_LABEL: Record<string, string> = {
  "V3C-FPA": "FPA",
  "V3C-LOI": "Carta de Intenção",
  "V3C-MAN": "Mandato",
  "V3C-CES": "Cessão",
  "V3C-ORG": "Originação",
  "V3C-FUN": "Fundo",
  "V3C-FOR": "Fornecedor",
  "V3C-PAR": "Adesão de Partner",
  "V3C-REG": "Regularização",
};

export interface ContractForEnvelopeLabel {
  contract_code: string | null;
  contract_title: string;
  vertical?: string | null;
  parties?: Array<{ role?: string | null; name?: string | null }> | null;
}

function docTypeLabel(code: string, title: string): string | null {
  const series = code.match(/^(V3C-[A-Z]{3})-/)?.[1];
  if (!series) return null;
  if (series === "V3C-NDA") return /ncnda/i.test(title) ? "NCNDA" : "NDA";
  return SERIES_LABEL[series] ?? null;
}

// Caracteres que o provedor ou o sistema de arquivos tratam mal no nome do arquivo.
function sanitize(label: string): string {
  return label.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

const MAX_LABEL_LENGTH = 150;

export function buildEnvelopeLabel(contract: ContractForEnvelopeLabel): string {
  const code = contract.contract_code?.trim();
  if (!code) return sanitize(contract.contract_title);

  const tipo = docTypeLabel(code, contract.contract_title) ?? contract.contract_title;
  const setor = contract.vertical ? VERTICAL_LABELS[contract.vertical] : undefined;
  const partnerName = (contract.parties ?? []).find((p) => p.role === "partner" && p.name?.trim())?.name?.trim();

  const partes = [code, tipo, setor, partnerName ? `Partner ${partnerName}` : null].filter((p): p is string => !!p);
  let label = sanitize(partes.join(" · "));
  if (label.length > MAX_LABEL_LENGTH) label = label.slice(0, MAX_LABEL_LENGTH).replace(/\s+\S*$/, "").trim();
  return label;
}
