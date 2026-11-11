/**
 * ANÁLISE JURÍDICA DO CADASTRO DE PARTNER (BRIEF docs/briefs/2026-11-10_analise-juridica-cadastro-partner.md)
 *
 * Funções puras, sem rede: quais documentos consultar no CheckTudo (Dossiê Jurídico Resumido), a
 * máscara de exibição e o resumo para a tela. CPF/CNPJ pelas funções canônicas do cadastro: nunca
 * replace(/\D/g, "") no CNPJ (apaga a letra do CNPJ alfanumérico).
 */
import { mascaraCnpj, normalizarCnpj, normalizarCpf } from "@/lib/cadastro-partner/documento";
import { isValidCNPJ, isValidCPF } from "@/lib/validators/cpf-cnpj";

export type EscopoJuridico = "PJ_PF" | "PF" | "PJ";

export type CadastroJuridico = {
  tipo_pessoa: "PF" | "PJ" | string;
  cpf?: string | null;
  cnpj?: string | null;
  nome_completo?: string | null;
  razao_social?: string | null;
};

export type DocumentoConsulta = {
  tipo: "cpf" | "cnpj";
  /** Valor normalizado enviado ao CheckTudo (CPF 11 dígitos; CNPJ 14 caracteres maiúsculos). */
  valor: string;
  /** Exibição: CPF mascarado, CNPJ completo formatado. */
  exibicao: string;
  nome: string;
};

export type PlanoConsulta =
  | { ok: true; escopo: EscopoJuridico; documentos: DocumentoConsulta[] }
  | { ok: false; erro: string };

export function mascararCpf(cpf: string): string {
  const d = normalizarCpf(cpf);
  if (d.length !== 11) return "***";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

export function mascararDocumento(tipo: "cpf" | "cnpj", valor: string): string {
  return tipo === "cpf" ? mascararCpf(valor) : mascaraCnpj(valor);
}

/** O cadastro tem CPF (do titular PF ou do representante PJ)? */
export function temCpf(c: CadastroJuridico): boolean {
  return normalizarCpf(c.cpf).length > 0;
}

/**
 * Documentos a consultar para o escopo pedido. "PJ_PF" num PJ sem CPF do sócio vira "PJ" (só CNPJ).
 * Documento inválido não é consultado (não gera custo).
 */
export function documentosDoEscopo(c: CadastroJuridico, pedido: "PJ_PF" | "PF"): PlanoConsulta {
  const isPJ = c.tipo_pessoa === "PJ";
  const cpf = normalizarCpf(c.cpf);
  const cnpj = normalizarCnpj(c.cnpj);
  const nomePF = (c.nome_completo ?? "").trim() || "Titular";
  const nomePJ = (c.razao_social ?? "").trim() || "Empresa";

  const docCpf = (): DocumentoConsulta | string => {
    if (!cpf) return isPJ ? "Este cadastro não tem CPF do representante" : "Este cadastro não tem CPF";
    if (!isValidCPF(cpf)) return "CPF do cadastro inválido: corrija o cadastro antes de consultar";
    return { tipo: "cpf", valor: cpf, exibicao: mascararCpf(cpf), nome: nomePF };
  };
  const docCnpj = (): DocumentoConsulta | string => {
    if (!cnpj) return "Este cadastro não tem CNPJ";
    if (!isValidCNPJ(cnpj)) return "CNPJ do cadastro inválido: corrija o cadastro antes de consultar";
    return { tipo: "cnpj", valor: cnpj, exibicao: mascaraCnpj(cnpj), nome: nomePJ };
  };

  if (!isPJ || pedido === "PF") {
    const d = docCpf();
    return typeof d === "string" ? { ok: false, erro: d } : { ok: true, escopo: "PF", documentos: [d] };
  }
  const dj = docCnpj();
  if (typeof dj === "string") return { ok: false, erro: dj };
  if (!cpf) return { ok: true, escopo: "PJ", documentos: [dj] };
  const dp = docCpf();
  if (typeof dp === "string") return { ok: false, erro: dp };
  return { ok: true, escopo: "PJ_PF", documentos: [dj, dp] };
}

/** Só os 5 totais são guardados (o dossiê bruto do CheckTudo não é gravado nem devolvido). */
export type TotaisJuridico = {
  total_processos: unknown;
  reu_quantidade: unknown;
  reu_valor: unknown;
  autor_quantidade: unknown;
  autor_valor: unknown;
  consultado_em: string;
};

export function apenasTotais(d: { total_processos: unknown; reu_quantidade: unknown; reu_valor: unknown; autor_quantidade: unknown; autor_valor: unknown; consultado_em: string }): TotaisJuridico {
  return {
    total_processos: d.total_processos ?? null,
    reu_quantidade: d.reu_quantidade ?? null,
    reu_valor: d.reu_valor ?? null,
    autor_quantidade: d.autor_quantidade ?? null,
    autor_valor: d.autor_valor ?? null,
    consultado_em: d.consultado_em,
  };
}

function numero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const s = v.trim();
    // "1.234,56" (BR) ou "1234.56"
    const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Linhas de exibição. Campo ausente vira "não informado", nunca "null". */
export function resumoJuridico(t: Partial<TotaisJuridico> | null | undefined): { processos: string; reu: string; autor: string } {
  const qtd = (v: unknown) => { const n = numero(v); return n == null ? "não informado" : String(Math.round(n)); };
  const val = (v: unknown) => { const n = numero(v); return n == null ? "não informado" : BRL.format(n).replace(/\s/g, " "); };
  return {
    processos: qtd(t?.total_processos),
    reu: `${qtd(t?.reu_quantidade)} · ${val(t?.reu_valor)}`,
    autor: `${qtd(t?.autor_quantidade)} · ${val(t?.autor_valor)}`,
  };
}

/** "dd/mm/aaaa hh:mm" em Brasília. */
export function dataHoraBR(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d).replace(",", "");
}

export const TRAVA_RECONSULTA_MS = 5 * 60 * 1000;
export const AVISO_RECONSULTA_MS = 24 * 60 * 60 * 1000;
