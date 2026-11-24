// Pedido de commodity na Mesa M&A (BRIEF docs/briefs/2026-11-24_mesa-ma-pedido-de-commodity-bloco-A.md).
// Fonte única de validação, cálculo, sigilo e trava. Funções puras: as rotas só leem o banco e chamam aqui.
// Gravação em ma_deals.asset_data.commodity. Os nomes de campo seguem o formato do V3 Cargas
// (peso_saca_g, preco_saca_centavos, modo_pagamento) para o bloco C.
import { z } from "zod";

// ── Listas (alfabéticas; "Outro" sempre no fim; documentos em ordem de processo) ──────────────
export const LADOS = [
  { value: "COMPRA", label: "Compra" },
  { value: "VENDA", label: "Venda" },
] as const;

export const PRODUTOS = [
  { value: "CAFE", label: "Café" },
  { value: "MILHO", label: "Milho" },
  { value: "SOJA", label: "Soja" },
  { value: "OUTRO", label: "Outro" },
] as const;

export const INCOTERMS = [
  { value: "CIF", label: "CIF" },
  { value: "FOB", label: "FOB" },
] as const;

export const MODOS_PAGAMENTO = [
  { value: "DIRETO", label: "Direto" },
  { value: "ESCROW", label: "Escrow" },
] as const;

export const PESOS_SACA = [
  { value: 50000, label: "50 kg" },
  { value: 60000, label: "60 kg" },
] as const;

export const TIPOS_DOCUMENTO = [
  { value: "LOI", label: "LOI" },
  { value: "ICPO", label: "ICPO" },
  { value: "SCO", label: "SCO" },
  { value: "FCO", label: "FCO" },
  { value: "PROVA_FUNDOS", label: "Prova de fundos" },
  { value: "LASTRO", label: "Lastro" },
  { value: "LAUDO_CLASSIFICACAO", label: "Laudo de classificação" },
  { value: "ESPECIFICACAO_TECNICA", label: "Especificação técnica" },
] as const;

export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number]["value"];

// ── Limites ─────────────────────────────────────────────────────────────────────────────────────
export const QUANTIDADE_MAX = 10_000_000;
export const PRECO_SACA_MAX_CENTAVOS = 100_000_000; // 1.000.000,00 por saca
export const TOTAL_MAX_CENTAVOS = 100_000_000_000_000; // 1 trilhão na moeda do campo
export const CARGAS_DIA_MAX = 1000;
export const ARQUIVO_MAX_BYTES = 20 * 1024 * 1024;
export const ARQUIVO_EXTENSOES = ["pdf", "jpg", "jpeg", "png", "docx"] as const;
export const ARQUIVO_TIPOS_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export const MSG_ARQUIVO_INVALIDO = "Envie PDF, JPG, PNG ou DOCX de até 20 MB.";

// ── Datas: só texto, nunca new Date("AAAA-MM-DD") (fuso desloca o dia) ───────────────────────────
const RE_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_BR = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function dataValida(a: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const dias = [31, (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return d <= dias[m - 1];
}

export function isoValida(iso: string): boolean {
  const m = RE_ISO.exec(iso);
  return !!m && dataValida(+m[1], +m[2], +m[3]);
}

export function brParaIso(br: string): string | null {
  const m = RE_BR.exec(br.trim());
  if (!m || !dataValida(+m[3], +m[2], +m[1])) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function isoParaBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = RE_ISO.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// ── Texto livre do produto "Outro": recusa CPF ou CNPJ ─────────────────────────────────────────
export function contemDocumento(texto: string): boolean {
  const digitos = texto.replace(/[.\-/\s]/g, "");
  return /\d{14}/.test(digitos) || /(^|\D)\d{11}(\D|$)/.test(digitos);
}

// ── Esquema ─────────────────────────────────────────────────────────────────────────────────────
const pct = z.number().min(0).max(100).refine(v => Math.round(v * 10) === v * 10, "Use no máximo 1 casa decimal").nullable().optional();
const texto120 = z.string().trim().max(120).nullable().optional();
const dataIso = z.string().refine(isoValida, "Data inválida (AAAA-MM-DD)").nullable().optional();

export const pedidoSchema = z.object({
  lado: z.enum(["COMPRA", "VENDA"]),
  produto: z.enum(["CAFE", "MILHO", "SOJA", "OUTRO"]),
  produto_outro: z.string().trim().max(60).nullable().optional(),
  quantidade_sacas: z.number().int().min(1).max(QUANTIDADE_MAX),
  peso_saca_g: z.union([z.literal(50000), z.literal(60000)]).default(60000),
  preco_saca_centavos: z.number().int().min(1).max(PRECO_SACA_MAX_CENTAVOS),
  moeda: z.enum(["BRL", "USD"]),
  incoterm: z.enum(["CIF", "FOB"]).nullable().optional(),
  local_embarque: texto120,
  local_entrega: texto120,
  entrega_inicio: dataIso,
  entrega_fim: dataIso,
  cargas_por_dia: z.number().int().min(1).max(CARGAS_DIA_MAX).nullable().optional(),
  modo_pagamento: z.enum(["DIRETO", "ESCROW"]).nullable().optional(),
  umidade_pct: pct,
  impureza_pct: pct,
  avariados_pct: pct,
}).superRefine((p, ctx) => {
  if (p.produto === "OUTRO") {
    if (!p.produto_outro) ctx.addIssue({ code: "custom", path: ["produto_outro"], message: "Informe o produto" });
    else if (contemDocumento(p.produto_outro)) ctx.addIssue({ code: "custom", path: ["produto_outro"], message: "Não informe CPF ou CNPJ neste campo" });
  }
  if (p.entrega_inicio && p.entrega_fim && p.entrega_fim < p.entrega_inicio) {
    ctx.addIssue({ code: "custom", path: ["entrega_fim"], message: "O fim da entrega não pode ser antes do início" });
  }
  if (calcularTotalCentavos(p.quantidade_sacas, p.preco_saca_centavos) > TOTAL_MAX_CENTAVOS) {
    ctx.addIssue({ code: "custom", path: ["quantidade_sacas"], message: "O valor total passa de 1 trilhão" });
  }
});

export type PedidoEntrada = z.input<typeof pedidoSchema>;
export type Pedido = z.output<typeof pedidoSchema>;

export interface DocumentoComercial {
  id: string;
  tipo: TipoDocumento;
  nome: string;
  caminho: string;
  enviado_por: string;
  enviado_por_nome?: string | null;
  enviado_em: string;
  excluido_em?: string | null;
  excluido_por?: string | null;
  excluido_motivo?: string | null;
}

export interface CommodityGravada extends Pedido {
  valor_total_centavos: number;
  documentos?: DocumentoComercial[];
  atualizado_em?: string;
  atualizado_por?: string;
}

const CAMPOS_PEDIDO = [
  "lado", "produto", "produto_outro", "quantidade_sacas", "peso_saca_g", "preco_saca_centavos", "moeda",
  "incoterm", "local_embarque", "local_entrega", "entrega_inicio", "entrega_fim", "cargas_por_dia",
  "modo_pagamento", "umidade_pct", "impureza_pct", "avariados_pct",
] as const;

// Campos econômicos: travados quando há contrato V3C-ICM ou V3C-CVC enviado ou assinado.
export const CAMPOS_TRAVADOS = [
  "lado", "produto", "produto_outro", "quantidade_sacas", "peso_saca_g", "preco_saca_centavos", "moeda",
  "incoterm", "modo_pagamento",
] as const;

// ── Cálculo ─────────────────────────────────────────────────────────────────────────────────────
export function calcularTotalCentavos(quantidade: number, precoCentavos: number): number {
  return quantidade * precoCentavos;
}

/** Valor do deal em unidades da moeda (ma_deals.deal_value é numeric em reais/dólares). */
export function totalEmUnidades(totalCentavos: number): number {
  return totalCentavos / 100;
}

/** Valida o pedido vindo do cliente e devolve a versão gravável, com o total calculado aqui. */
export function montarPedido(
  entrada: unknown,
  anterior?: Partial<CommodityGravada> | null,
): { ok: true; pedido: CommodityGravada } | { ok: false; erro: string; campos?: Record<string, string[]> } {
  const base: Record<string, unknown> = {};
  if (anterior) for (const k of CAMPOS_PEDIDO) if (anterior[k] !== undefined) base[k] = anterior[k];
  if (entrada && typeof entrada === "object") {
    for (const k of CAMPOS_PEDIDO) {
      if (k in (entrada as Record<string, unknown>)) base[k] = (entrada as Record<string, unknown>)[k];
    }
  }
  const r = pedidoSchema.safeParse(base);
  if (!r.success) {
    const campos = r.error.flatten().fieldErrors as Record<string, string[]>;
    const primeira = Object.values(campos).flat()[0] ?? "Pedido inválido";
    return { ok: false, erro: primeira, campos };
  }
  const p = r.data;
  return {
    ok: true,
    pedido: {
      ...p,
      produto_outro: p.produto === "OUTRO" ? p.produto_outro ?? null : null,
      valor_total_centavos: calcularTotalCentavos(p.quantidade_sacas, p.preco_saca_centavos),
      documentos: anterior?.documentos ?? [],
    },
  };
}

// ── Trava pós-contrato ──────────────────────────────────────────────────────────────────────────
export interface ContratoResumo {
  contract_code: string | null;
  status_signature: string | null;
  deletion_status?: string | null;
}

export function pedidoTravado(contratos: ContratoResumo[]): boolean {
  return contratos.some(c =>
    !!c.contract_code &&
    /^V3C-(ICM|CVC)-/.test(c.contract_code) &&
    (c.status_signature === "enviado_assinatura" || c.status_signature === "assinado") &&
    // "approved" = exclusão aprovada pela governança. Pedido de exclusão pendente ainda trava (dúvida vai para a trava).
    c.deletion_status !== "approved",
  );
}

export function camposTravadosAlterados(anterior: Partial<CommodityGravada> | null | undefined, novo: Partial<Pedido>): string[] {
  if (!anterior) return [];
  return CAMPOS_TRAVADOS.filter(k => (anterior[k] ?? null) !== (novo[k] ?? null));
}

// ── Documentos ──────────────────────────────────────────────────────────────────────────────────
export function extensao(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i >= 0 ? nome.slice(i + 1).toLowerCase() : "";
}

export function validarArquivo(nome: string, tamanho: number): string | null {
  const ext = extensao(nome);
  if (!(ARQUIVO_EXTENSOES as readonly string[]).includes(ext)) return MSG_ARQUIVO_INVALIDO;
  if (!Number.isFinite(tamanho) || tamanho <= 0 || tamanho > ARQUIVO_MAX_BYTES) return MSG_ARQUIVO_INVALIDO;
  return null;
}

export function nomeSeguro(nome: string): string {
  const ext = extensao(nome);
  const base = nome.slice(0, nome.length - (ext ? ext.length + 1 : 0))
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 80) || "documento";
  return ext ? `${base}.${ext}` : base;
}

export function caminhoDocumento(dealId: string, uuid: string, nome: string): string {
  return `${dealId}/comercial/${uuid}-${nomeSeguro(nome)}`;
}

/** O caminho confirmado precisa ser o mesmo prefixo do deal: nunca aceitar caminho de outro deal. */
export function caminhoPertenceAoDeal(dealId: string, caminho: string): boolean {
  return caminho.startsWith(`${dealId}/comercial/`) && !caminho.includes("..") && caminho.split("/").length === 3;
}

export function documentosAtivos(docs: DocumentoComercial[] | null | undefined): DocumentoComercial[] {
  return (docs ?? []).filter(d => !d.excluido_em);
}

export interface SituacaoDocumento {
  tipo: TipoDocumento;
  label: string;
  recebido: boolean;
  enviado_em: string | null;
}

export function situacaoDocumentos(docs: DocumentoComercial[] | null | undefined): SituacaoDocumento[] {
  const ativos = documentosAtivos(docs);
  return TIPOS_DOCUMENTO.map(t => {
    const doTipo = ativos.filter(d => d.tipo === t.value).sort((a, b) => b.enviado_em.localeCompare(a.enviado_em));
    return { tipo: t.value, label: t.label, recebido: doTipo.length > 0, enviado_em: doTipo[0]?.enviado_em ?? null };
  });
}

// ── Sigilo: o que cada perfil recebe ────────────────────────────────────────────────────────────
export type AcessoCommodity = "gravar" | "ler" | null;

/** Rota nova do pedido. MESA grava nos deals que a listagem já mostra a ela (assigned_to ou created_by). */
export function acessoCommodity(
  papel: string | null | undefined,
  deal: { assigned_to?: string | null; created_by?: string | null },
  userId: string,
): AcessoCommodity {
  if (papel === "ADMIN" || papel === "GESTAO") return "gravar";
  if (papel === "MESA") return deal.assigned_to === userId || deal.created_by === userId ? "gravar" : null;
  if (papel === "MESA_OPERACIONAL") return "ler";
  return null;
}

export function podeExcluirDocumento(papel: string | null | undefined): boolean {
  return papel === "ADMIN" || papel === "GESTAO";
}

/** Partner originador: originator_profile_id do deal; se nulo, quem criou (desde que não seja equipe). */
export function ehOriginador(
  deal: { originator_profile_id?: string | null; created_by?: string | null },
  userId: string,
): boolean {
  if (deal.originator_profile_id) return deal.originator_profile_id === userId;
  return deal.created_by === userId;
}

export type ModoVisao = "completo" | "recorte" | "nenhum";

const PAPEIS_EQUIPE_COMPLETA = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "MESA"];

export function modoVisao(
  papel: string | null | undefined,
  deal: { originator_profile_id?: string | null; created_by?: string | null },
  userId: string,
): ModoVisao {
  if (PAPEIS_EQUIPE_COMPLETA.includes(papel ?? "")) return "completo";
  return ehOriginador(deal, userId) ? "recorte" : "nenhum";
}

/** Recorte do partner originador: campos do pedido e situação dos documentos; nunca nome, caminho ou link. */
export function recorteCommodity(c: Partial<CommodityGravada>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const k of CAMPOS_PEDIDO) if (c[k] !== undefined) r[k] = c[k];
  if (c.valor_total_centavos !== undefined) r.valor_total_centavos = c.valor_total_centavos;
  r.situacao_documentos = situacaoDocumentos(c.documentos).map(s => ({ tipo: s.tipo, label: s.label, recebido: s.recebido }));
  return r;
}

/** Aplica o modo de visão ao asset_data de um deal (sem mutar o original). */
export function filtrarAssetData(
  assetData: unknown,
  modo: ModoVisao,
): Record<string, unknown> | null {
  if (!assetData || typeof assetData !== "object") return (assetData as null) ?? null;
  const ad = { ...(assetData as Record<string, unknown>) };
  if (!("commodity" in ad)) return ad;
  if (modo === "completo") return ad;
  if (modo === "nenhum") { delete ad.commodity; return ad; }
  ad.commodity = recorteCommodity((ad.commodity ?? {}) as Partial<CommodityGravada>);
  return ad;
}

/** Aplica o filtro a uma linha de ma_deals e remove o originator_profile_id (só usado para decidir). */
export function filtrarDealParaPerfil<T extends Record<string, unknown>>(
  deal: T,
  papel: string | null | undefined,
  userId: string,
  manterOriginador: boolean,
): T {
  const modo = modoVisao(papel, deal as { originator_profile_id?: string | null; created_by?: string | null }, userId);
  const out: Record<string, unknown> = { ...deal };
  if ("asset_data" in out) out.asset_data = filtrarAssetData(out.asset_data, modo);
  if (!manterOriginador) delete out.originator_profile_id;
  return out as T;
}

/** Mantém no asset_data a commodity que está no banco, ignorando a enviada pelo cliente. */
export function preservarCommodity(
  assetDataCliente: Record<string, unknown>,
  assetDataBanco: unknown,
): Record<string, unknown> {
  const out = { ...assetDataCliente };
  delete out.commodity;
  const banco = assetDataBanco && typeof assetDataBanco === "object" ? (assetDataBanco as Record<string, unknown>) : {};
  if (banco.commodity !== undefined) out.commodity = banco.commodity;
  return out;
}
