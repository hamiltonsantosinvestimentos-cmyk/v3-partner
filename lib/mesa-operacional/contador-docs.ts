/**
 * CONTADOR DE DOCUMENTOS DO CARD DA MESA OPERACIONAL (BRIEF 09/11/2026: docs/briefs/2026-11-09_mesa-op-contador-docs-card.md)
 *
 * Reproduz a contagem "X/Y enviados" da aba Documentos do modal da proposta
 * (components/mesa-credito/proposta-detail-modal.tsx: mapa do portfólio no useEffect de /api/portfolio,
 * marcados no useEffect de /api/credit-proposals/documents, checklist em modalTab === "documentos").
 * Se a regra mudar lá, mude aqui também (e vice-versa).
 *
 * Função pura, sem I/O: quem chama busca portfolio_linhas (ativo = true, ordem por ordem e nome).
 */
import { CHECKLISTS, DEFAULT_CHECKLIST } from "@/lib/credit-checklists";
import { filtrarChecklistPorImovel, imovelGarantiaDaProposta } from "@/lib/checklist-imovel";

type ItemChecklist = { id: string; aplica?: string | null };
export type MapaPortfolioDocs = Record<string, { PF: ItemChecklist[]; PJ: ItemChecklist[] }>;

type DocPortfolio = { id: string; aplica?: string | null };
export type LinhaPortfolioDocs = { nome: string | null; documentos_pf?: unknown; documentos_pj?: unknown };

/** Mesmo mapa que o modal monta: chave = nome da linha em minúsculas; linha repetida, a última vence. */
export function montarMapaPortfolio(linhas: LinhaPortfolioDocs[] | null | undefined): MapaPortfolioDocs {
  const mapa: MapaPortfolioDocs = {};
  for (const linha of linhas ?? []) {
    if (typeof linha?.nome !== "string") continue;
    const itens = (arr: unknown): ItemChecklist[] | null =>
      Array.isArray(arr) && arr.length > 0 ? (arr as DocPortfolio[]).map((d) => ({ id: d.id, aplica: d.aplica })) : null;
    const pf = itens(linha.documentos_pf);
    const pj = itens(linha.documentos_pj);
    if (pf || pj) mapa[linha.nome.toLowerCase()] = { PF: pf ?? [], PJ: pj ?? [] };
  }
  return mapa;
}

export type PropostaParaContagem = {
  credit_line?: string | null;
  client_type?: string | null;
  metadata?: unknown;
  checklist?: unknown;
  documents?: unknown;
};

/** Devolve { enviados, total } como a aba Documentos do modal. */
export function contarDocsChecklist(p: PropostaParaContagem, mapa: MapaPortfolioDocs): { enviados: number; total: number } {
  const meta = (p.metadata && typeof p.metadata === "object" ? p.metadata : {}) as { client_type?: string };
  const clientType: "PF" | "PJ" = (meta.client_type ?? p.client_type) === "PJ" ? "PJ" : "PF";
  const linha = typeof p.credit_line === "string" ? p.credit_line : "";
  const base: ItemChecklist[] =
    mapa[linha.toLowerCase()]?.[clientType] ?? CHECKLISTS[linha]?.[clientType] ?? DEFAULT_CHECKLIST[clientType];
  const docs = filtrarChecklistPorImovel(base, imovelGarantiaDaProposta(p.metadata));

  const marcados: Record<string, unknown> =
    p.checklist && typeof p.checklist === "object" && !Array.isArray(p.checklist) ? { ...(p.checklist as Record<string, unknown>) } : {};
  if (Array.isArray(p.documents)) {
    for (const d of p.documents as { doc_id?: unknown }[]) {
      if (d && typeof d.doc_id === "string") marcados[d.doc_id] = true;
    }
  }
  return { enviados: docs.filter((d) => marcados[d.id]).length, total: docs.length };
}
