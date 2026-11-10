// lib/esignature/certone-signer.ts
//
// A CertOne exige um CPF válido por signatário (certone-provider.ts). Partes PJ
// externas entram em operation_contracts.parties só com o CNPJ da empresa em `doc`,
// mas a qualificação (cm_party_qualifications.representation) já guarda o
// representante pessoa física (administrador, representante legal ou procurador)
// com nome e CPF. Este módulo resolve o signatário da CertOne a partir dessa cadeia,
// sem alterar o que é impresso no contrato (parties e texto ficam intactos).
//
// Funções puras, sem I/O: quem lê o banco e consulta a chave de compliance é
// lib/contract-send.ts. Nenhuma mensagem de erro daqui contém número de CPF.
import { isValidCPF } from "@/lib/validators/cpf-cnpj";

export interface RepresentationNode {
  representative_type?: string | null;
  party_nature?: string | null;
  full_name?: string | null;
  cpf_cnpj?: string | null;
  representation?: RepresentationNode | null;
}

export interface QualificationRow {
  role_in_document: string;
  email: string | null;
  person_type: string | null;
  representation: RepresentationNode | null;
}

export interface CertOneSignerInput {
  role: string;
  name: string;
  email: string;
  document: string | null;
}

export interface ResolvedSigner {
  role: string;
  email: string;
  name: string;
  /** CPF só com dígitos (11), nunca mascarado. */
  document: string;
  /** true quando o CPF veio do representante da qualificação (e não de parties.doc). */
  fromRepresentative: boolean;
}

export type SignerResolution =
  | { ok: true; signers: ResolvedSigner[] }
  | { ok: false; error: string };

const MAX_DEPTH = 5;

/**
 * Normaliza (remove tudo que não é letra ou dígito, maiúsculas) e só devolve CPF:
 * 11 posições, só dígitos, dígito verificador válido e sem sequência repetida
 * (isValidCPF, o validador único do repo). CNPJ (14, inclusive alfanumérico) nunca passa.
 */
export function normalizeCpf(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (!/^\d{11}$/.test(compact)) return null;
  return isValidCPF(compact) ? compact : null;
}

/** Desce a cadeia de representação até a pessoa física que assina. null se não houver PF com CPF válido. */
export function findRepresentativeSigner(rep: RepresentationNode | null | undefined): { name: string; cpf: string } | null {
  let node: RepresentationNode | null | undefined = rep;
  for (let depth = 0; node && depth <= MAX_DEPTH; depth++) {
    if (node.party_nature === "PJ") {
      node = node.representation;
      continue;
    }
    const cpf = normalizeCpf(node.cpf_cnpj);
    const name = (node.full_name ?? "").trim();
    return cpf && name ? { name, cpf } : null;
  }
  return null;
}

function failFor(role: string, email: string): SignerResolution {
  return {
    ok: false,
    error: `Não foi possível identificar o CPF do representante da parte ${role} (${email}). Complete a qualificação do representante dessa parte antes de enviar pela CertOne.`,
  };
}

/**
 * Resolve o signatário CertOne de cada parte:
 * - parte cujo `document` já é CPF válido (pessoa física, sócios V3): usa como está;
 * - parte PJ (documento é CNPJ): usa nome e CPF do representante da qualificação
 *   localizada por papel + e-mail. Zero ou mais de uma qualificação, ou nenhum
 *   representante PF com CPF válido: falha explícita, nunca escolhe a primeira.
 */
export function resolveCertOneSigners(
  parties: CertOneSignerInput[],
  qualifications: QualificationRow[],
): SignerResolution {
  const signers: ResolvedSigner[] = [];
  for (const p of parties) {
    const own = normalizeCpf(p.document);
    if (own) {
      signers.push({ role: p.role, email: p.email, name: p.name, document: own, fromRepresentative: false });
      continue;
    }
    const email = p.email.trim().toLowerCase();
    const matches = qualifications.filter(
      (q) => q.role_in_document === p.role && (q.email ?? "").trim().toLowerCase() === email,
    );
    if (matches.length !== 1) return failFor(p.role, p.email);
    const rep = matches[0].person_type === "PJ" ? findRepresentativeSigner(matches[0].representation) : null;
    if (!rep) return failFor(p.role, p.email);
    signers.push({ role: p.role, email: p.email, name: rep.name, document: rep.cpf, fromRepresentative: true });
  }
  return { ok: true, signers };
}
