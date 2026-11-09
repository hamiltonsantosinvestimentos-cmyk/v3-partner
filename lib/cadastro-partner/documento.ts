/**
 * DOCUMENTOS DO CADASTRO PÚBLICO DE PARTNER (BRIEF 09/11/2026: docs/briefs/2026-11-09_cadastro-partner-enterprise.md)
 *
 * Fonte única da regra de CPF/CNPJ do formulário (/cadastro-partner e links exclusivos) e da API
 * POST /api/cadastro-partner. Função pura, sem I/O.
 *
 * Formato canônico gravado: CPF só com dígitos; CNPJ com dígitos e letras maiúsculas (CNPJ
 * alfanumérico da Receita, desde 31/07/2026). Nunca usar replace(/\D/g, "") no CNPJ: apaga a letra.
 */
import { formatCNPJ, isValidCNPJ, isValidCPF } from "@/lib/validators/cpf-cnpj";

export function normalizarCpf(v: string | null | undefined): string {
  return String(v ?? "").replace(/\D/g, "").slice(0, 11);
}

export function normalizarCnpj(v: string | null | undefined): string {
  return String(v ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase().slice(0, 14);
}

/** Máscara progressiva do CNPJ (numérico ou alfanumérico): 12.ABC.345/01DE-35. Preserva letras e põe em maiúsculas. */
export function mascaraCnpj(v: string): string {
  const c = normalizarCnpj(v);
  if (c.length === 14) return formatCNPJ(c);
  if (c.length <= 2) return c;
  if (c.length <= 5) return `${c.slice(0, 2)}.${c.slice(2)}`;
  if (c.length <= 8) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5)}`;
  if (c.length <= 12) return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8)}`;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export const ERRO_CPF = "CPF inválido. Confira os números.";
export const ERRO_CNPJ = "CNPJ inválido. Confira os caracteres.";

export type CampoDocumento = "cpf" | "cnpj" | "cpf_socio";
export type ResultadoDocumentos =
  | { ok: true; cpf: string; cnpj?: string }
  | { ok: false; campo: CampoDocumento; erro: string };

/**
 * Valida os documentos do cadastro pelo dígito verificador.
 * PF: cpf. PJ: cnpj + cpf do sócio (o cpf devolvido no PJ é o do sócio, como a tabela grava hoje).
 */
export function validarDocumentosCadastro(
  tipo: "PF" | "PJ",
  d: { cpf?: string | null; cnpj?: string | null; cpfSocio?: string | null },
): ResultadoDocumentos {
  if (tipo === "PF") {
    const cpf = normalizarCpf(d.cpf);
    if (!isValidCPF(cpf)) return { ok: false, campo: "cpf", erro: ERRO_CPF };
    return { ok: true, cpf };
  }
  const cnpj = normalizarCnpj(d.cnpj);
  if (!isValidCNPJ(cnpj)) return { ok: false, campo: "cnpj", erro: ERRO_CNPJ };
  const cpf = normalizarCpf(d.cpfSocio);
  if (!isValidCPF(cpf)) return { ok: false, campo: "cpf_socio", erro: ERRO_CPF };
  return { ok: true, cpf, cnpj };
}
