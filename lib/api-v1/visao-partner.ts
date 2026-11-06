// O que a API devolve sobre uma proposta: só o que o partner vê na Mesa de Crédito
// (decisão do Hamilton em 06/11/2026). A resposta é montada campo a campo a partir de uma
// lista fechada: campo novo na proposta não sai pela API sem ser incluído aqui de propósito.
import {
  CHECKLISTS, DEFAULT_CHECKLIST, LEVEL_LINES, normalizeChecklistStr, type PortfolioLinhaDocs,
} from "@/lib/credit-checklists";
import { filtrarChecklistPorImovel, imovelGarantiaDaProposta } from "@/lib/checklist-imovel";
import { isoBrasilia } from "@/lib/api-v1/http";

export type DocumentoExigido = { id: string; nome: string; obrigatorio: boolean; dica?: string; aplica?: string };

/** Documentos da linha, na ordem da tela, com obrigatoriedade. Mesma resolução do detalhe da proposta. */
export function documentosDaLinha(linha: string, tipo: "PF" | "PJ", portfolio: PortfolioLinhaDocs[], meta?: unknown): DocumentoExigido[] {
  const garantia = meta === undefined ? null : imovelGarantiaDaProposta(meta);
  const cl = normalizeChecklistStr(linha || "");
  const casa = (nome: string) => { const n = normalizeChecklistStr(nome); return n === cl || n.startsWith(cl) || cl.startsWith(n); };

  const doPortfolio = portfolio.find((l) => casa(l.nome));
  const docsPortfolio = doPortfolio ? (tipo === "PJ" ? doPortfolio.documentos_pj : doPortfolio.documentos_pf) : undefined;
  if (docsPortfolio && docsPortfolio.length > 0) {
    return filtrarChecklistPorImovel(
      docsPortfolio.map((d) => ({ id: d.id, nome: d.nome, obrigatorio: !!d.obrigatorio, ...(d.aplica ? { aplica: d.aplica } : {}) })),
      garantia,
    );
  }
  const chave = Object.keys(CHECKLISTS).find(casa);
  const lista = chave ? CHECKLISTS[chave][tipo] : DEFAULT_CHECKLIST[tipo];
  return lista.map((d: { id: string; label: string; required: boolean; hint?: string }) => ({
    id: d.id, nome: d.label, obrigatorio: d.required, ...(d.hint ? { dica: d.hint } : {}),
  }));
}

/** Todas as linhas, ordenadas por nível (escala) e, dentro do nível, por nome em pt-BR. */
export function linhasOrdenadas(): { nome: string; nivel: "NIVEL_1" | "NIVEL_2" | "NIVEL_3" }[] {
  const out: { nome: string; nivel: "NIVEL_1" | "NIVEL_2" | "NIVEL_3" }[] = [];
  for (const nivel of ["NIVEL_1", "NIVEL_2", "NIVEL_3"] as const) {
    const nomes = [...(LEVEL_LINES[nivel] ?? [])].sort((a, b) => a.localeCompare(b, "pt-BR"));
    for (const nome of nomes) out.push({ nome, nivel });
  }
  return out;
}

/** Comentário do chat do partner como sai na API: sem link de anexo, sem id de quem enviou. */
export function comentarioPublico(m: Record<string, unknown>) {
  const anexos = Array.isArray(m.anexos) ? (m.anexos as { nome?: string }[]).map((a) => String(a?.nome ?? "")).filter(Boolean) : [];
  return {
    em: isoBrasilia(m.created_at as string),
    autor: String(m.sender_name ?? ""),
    texto: String(m.content ?? ""),
    anexos,
  };
}

/** CPF ***.456.789-** ; CNPJ XX.XXX.XXX/****-** (letras do CNPJ alfanumérico aparecem fora do trecho mascarado). */
export function mascararDocumento(doc: string | null | undefined): string | null {
  if (!doc) return null;
  const n = doc.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  if (n.length === 11) return `***.${n.slice(3, 6)}.${n.slice(6, 9)}-**`;
  if (n.length === 14) return `${n.slice(0, 2)}.${n.slice(2, 5)}.${n.slice(5, 8)}/****-**`;
  return "***";
}

export function linkAnaliseCredito(code: string, partnerId: string, access: boolean): string {
  const params = new URLSearchParams({ prop: code, ref: partnerId });
  return access
    ? `https://app.v3partners.com.br/analise/checkout?pacote=access&${params.toString()}`
    : `https://app.v3partners.com.br/analise-v2?${params.toString()}#configurador`;
}

/** Colunas lidas do banco para montar a visão. Nada além disso é selecionado. */
export const COLUNAS_VISAO = [
  "id", "code", "referencia_externa", "partner_id", "credit_line", "current_level", "stage", "status",
  "requested_value", "approved_value", "client_name", "client_cpf_cnpj", "documents", "metadata",
  "pending_reason", "pending_responsible", "pending_at", "pending_resolved_at", "created_at", "updated_at",
].join(", ");

type Linha = Record<string, unknown>;

/** Chaves que podem aparecer na resposta. O teste de paridade confere contra esta lista. */
export const CAMPOS_PERMITIDOS = [
  "id", "codigo", "referencia_externa", "linha", "nivel", "etapa", "status", "valor_solicitado", "valor_aprovado",
  "prazo", "finalidade", "cliente", "pendencia", "pendencias_documentos", "documentos_recebidos",
  "documentos_pendentes", "link_analise_credito", "criada_em", "atualizado_em",
] as const;

export function visaoDoPartner(p: Linha, opts: { portfolio: PortfolioLinhaDocs[]; access: boolean }) {
  const meta = (p.metadata && typeof p.metadata === "object" ? p.metadata : {}) as Linha;
  const tipo: "PF" | "PJ" = meta.client_type === "PJ" ? "PJ" : "PF";
  const docs = Array.isArray(p.documents) ? (p.documents as Linha[]) : [];
  const recebidos = docs
    .filter((d) => typeof d.doc_id === "string")
    .map((d) => ({
      tipo_documento: String(d.doc_id),
      nome_arquivo: String(d.file_name ?? ""),
      recebido_em: isoBrasilia(d.uploaded_at as string | undefined),
    }))
    .sort((a, b) => String(a.recebido_em).localeCompare(String(b.recebido_em)));
  const idsRecebidos = new Set(recebidos.map((d) => d.tipo_documento));
  const exigidos = documentosDaLinha(String(p.credit_line ?? ""), tipo, opts.portfolio, meta);
  const pendentes = exigidos.filter((d) => d.obrigatorio && !idsRecebidos.has(d.id)).map((d) => d.id);

  const pendOcr = meta.pendencias_ocr && typeof meta.pendencias_ocr === "object" ? (meta.pendencias_ocr as Record<string, Linha>) : {};
  const pendenciasDocumentos = Object.entries(pendOcr)
    .filter(([, v]) => v && v.status !== "corrigido")
    .map(([k, v]) => ({ tipo_documento: k, documento: String(v.doc_label ?? k), motivo: String(v.motivo ?? ""), desde: isoBrasilia(v.created_at as string | undefined) }))
    .sort((a, b) => String(a.desde).localeCompare(String(b.desde)));

  const pendenciaAberta = p.pending_reason && !p.pending_resolved_at
    ? { motivo: String(p.pending_reason), responsavel: p.pending_responsible ? String(p.pending_responsible) : null, desde: isoBrasilia(p.pending_at as string | undefined) }
    : null;

  return {
    id: String(p.id),
    codigo: String(p.code ?? ""),
    referencia_externa: (p.referencia_externa as string | null) ?? null,
    linha: String(p.credit_line ?? ""),
    nivel: String(p.current_level ?? ""),
    etapa: String(p.stage ?? ""),
    status: String(p.status ?? ""),
    valor_solicitado: p.requested_value != null ? Number(p.requested_value) : null,
    valor_aprovado: p.approved_value != null ? Number(p.approved_value) : null,
    prazo: (meta.prazo as string | undefined) ?? null,
    finalidade: (meta.finalidade as string | undefined) ?? null,
    cliente: { tipo, nome: String(p.client_name ?? ""), cpf_cnpj: mascararDocumento(p.client_cpf_cnpj as string | null) },
    pendencia: pendenciaAberta,
    pendencias_documentos: pendenciasDocumentos,
    documentos_recebidos: recebidos,
    documentos_pendentes: pendentes,
    link_analise_credito: p.code && p.partner_id ? linkAnaliseCredito(String(p.code), String(p.partner_id), opts.access) : null,
    criada_em: isoBrasilia(p.created_at as string | undefined),
    atualizado_em: isoBrasilia((p.updated_at ?? meta.stage_changed_at ?? p.created_at) as string | undefined),
  };
}
