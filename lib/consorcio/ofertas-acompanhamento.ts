// Acompanhamento das ofertas de cota contemplada em Consórcio › Projetos: regras puras e testáveis.
// BRIEF docs/briefs/2026-11-27_ofertas-cota-contemplada-em-projetos.md
// A resposta é montada campo a campo a partir de uma lista fechada por papel. Campo novo em
// consorcio_ofertas não sai por aqui sem ser incluído de propósito (teste de paridade).
import { detectDocumentType, normalizeDocument } from "@/lib/v3-clients-pure";
import { etapaDaOferta } from "@/lib/consorcio/kanban";

export type StatusOferta = "pendente" | "aceita" | "recusada" | "cancelada";
export const ORDEM_STATUS: StatusOferta[] = ["pendente", "aceita", "recusada", "cancelada"];

export const ROTULO_STATUS: Record<StatusOferta, string> = {
  pendente: "Em análise",
  aceita: "Aceita",
  recusada: "Recusada",
  cancelada: "Cancelada (outra oferta aceita)",
};

export function rotuloStatusOferta(s: string | null | undefined): string {
  return ROTULO_STATUS[(s ?? "") as StatusOferta] ?? "Em análise";
}

export interface Viewer { id: string; interno: boolean; equipe: string[] }

/** Interno vê tudo; os demais, só as criadas por alguém de idsDaEquipe (o próprio id; o master, também a equipe). */
export function podeVerOferta(viewer: Viewer, oferta: { created_by?: string | null }): boolean {
  if (viewer.interno) return true;
  return !!oferta.created_by && viewer.equipe.includes(oferta.created_by);
}

/** Nunca devolve o valor cru: decide pelo tamanho normalizado (11 = CPF, 14 = CNPJ, inclusive alfanumérico). */
export function mascararDocumentoOferta(valor: string | null | undefined): string {
  const n = normalizeDocument(valor);
  if (!n) return "Não informado";
  const tipo = detectDocumentType(n);
  if (tipo === "CPF") return `***.${n.slice(3, 6)}.${n.slice(6, 9)}-**`;
  if (tipo === "CNPJ") return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/****-**`;
  return "Documento informado";
}

/**
 * Origem para a equipe V3. `marcas` vem de marcasDosPartners: a chave existe para todo perfil lido
 * (null = partner sem Enterprise); chave ausente = falha da leitura.
 */
export function origemDaOferta(marcas: Map<string, { nome: string } | null>, createdBy: string | null | undefined, criadorInterno: boolean): string {
  if (criadorInterno) return "Equipe V3";
  if (!createdBy || !marcas.has(createdBy)) return "Não identificada";
  const m = marcas.get(createdBy);
  return m ? m.nome : "Rede V3";
}

export const COLUNAS_OFERTA = "id, carta_id, carta_code, carta_credit_value, valor_oferta, interessado_nome, interessado_cpf_cnpj, status, created_at, created_by";

export const CAMPOS_INTERNO = [
  "id", "carta_id", "carta_code", "carta_credit_value", "valor_oferta", "interessado_nome", "status", "created_at",
  "ofertado_por", "origem", "etapa", "comentarios",
] as const;

export const CAMPOS_PARTNER = [
  "id", "carta_code", "carta_credit_value", "valor_oferta", "interessado_nome", "interessado_documento", "status",
  "created_at", "ofertado_por", "etapa", "comentarios",
] as const;

type Linha = Record<string, unknown>;
const num = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export function ofertaParaAcompanhamento(o: Linha, papel: "interno" | "partner", extras: { ofertadoPor: string; origem?: string; comentarios?: number }) {
  const base = {
    id: String(o.id),
    carta_code: String(o.carta_code ?? ""),
    carta_credit_value: num(o.carta_credit_value),
    valor_oferta: num(o.valor_oferta),
    interessado_nome: String(o.interessado_nome ?? ""),
    status: String(o.status ?? "pendente"),
    created_at: (o.created_at as string | null) ?? null,
    ofertado_por: extras.ofertadoPor,
    // Kanban (BRIEF 2026-11-27 kanban): etapa de acompanhamento (null = Nova) e comentários visíveis ao viewer.
    etapa: etapaDaOferta(o.etapa),
    comentarios: extras.comentarios ?? 0,
  };
  if (papel === "interno") {
    return { ...base, carta_id: String(o.carta_id ?? ""), origem: extras.origem ?? "Não identificada" };
  }
  return { ...base, interessado_documento: mascararDocumentoOferta(o.interessado_cpf_cnpj as string | null) };
}

export type OfertaAcompanhamento = ReturnType<typeof ofertaParaAcompanhamento> & { carta_id?: string; origem?: string; interessado_documento?: string };

/** Pendentes primeiro; ordem dos grupos Pendente, Aceita, Recusada, Cancelada; dentro do grupo, mais recente primeiro. */
export function ordenarOfertas<T extends { status: string; created_at: string | null }>(lista: T[]): T[] {
  const pos = (s: string) => { const i = ORDEM_STATUS.indexOf(s as StatusOferta); return i < 0 ? ORDEM_STATUS.length : i; };
  return [...lista].sort((a, b) => pos(a.status) - pos(b.status) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
}
