// Kanban de Consórcio › Projetos (cotas novas e ofertas de cota contemplada): regras puras e testáveis.
// BRIEF docs/briefs/2026-11-27_kanban-consorcio-projetos.md
// Sem import de servidor: a tela usa as mesmas regras, rótulos e ordem.

export type AlvoTipo = "CONTRATACAO" | "OFERTA";
export type EtapaOferta = "NOVA" | "EM_CONTATO" | "NEGOCIANDO" | "DOCUMENTACAO" | "CONCLUIDA" | "PERDIDA";

export const ETAPAS_OFERTA: EtapaOferta[] = ["NOVA", "EM_CONTATO", "NEGOCIANDO", "DOCUMENTACAO", "CONCLUIDA", "PERDIDA"];
export const ROTULO_ETAPA_OFERTA: Record<EtapaOferta, string> = {
  NOVA: "Nova",
  EM_CONTATO: "Em contato",
  NEGOCIANDO: "Negociando",
  DOCUMENTACAO: "Documentação",
  CONCLUIDA: "Concluída",
  PERDIDA: "Perdida",
};

export const TEXTO_MAX = 2000;
export const LIMITE_POR_MINUTO = 30;

/** Etapa exibida: null ou valor desconhecido cai em "Nova". */
export function etapaDaOferta(v: unknown): EtapaOferta {
  return typeof v === "string" && (ETAPAS_OFERTA as string[]).includes(v) ? (v as EtapaOferta) : "NOVA";
}
export function ehEtapaOferta(v: unknown): v is EtapaOferta {
  return typeof v === "string" && (ETAPAS_OFERTA as string[]).includes(v);
}

/** Só ADMIN e GESTÃO movem cards (cota nova e oferta). */
export function podeMover(papel: string | null | undefined): boolean {
  return papel === "ADMIN" || papel === "GESTAO";
}

export interface ViewerKanban {
  id: string;
  papel: string | null;
  /** ADMIN, GESTAO ou MESA_OPERACIONAL. */
  interno: boolean;
  /** idsDaEquipe: o próprio id; para o master, também os usuários dele. */
  equipe: string[];
}

/**
 * Comenta: ADMIN e GESTAO sempre; quem enviou; o master da equipe de quem enviou.
 * MESA_OPERACIONAL lê tudo e não comenta.
 */
export function podeComentar(viewer: ViewerKanban, item: { created_by?: string | null }): boolean {
  if (podeMover(viewer.papel)) return true;
  if (viewer.interno) return false;
  return !!item.created_by && viewer.equipe.includes(item.created_by);
}

/** Pode marcar nota interna: só ADMIN e GESTAO. */
export function podeNotaInterna(viewer: ViewerKanban): boolean {
  return podeMover(viewer.papel);
}

/** Interno vê todos; demais só os visíveis ao partner. */
export function comentariosVisiveis<T extends { visivel_partner: boolean }>(viewer: { interno: boolean }, lista: T[]): T[] {
  return viewer.interno ? lista : lista.filter((c) => c.visivel_partner === true);
}

/** Visibilidade gravada: quem não pode fazer nota interna grava sempre visível (o campo enviado é ignorado). */
export function visibilidadeGravada(viewer: ViewerKanban, pedido: unknown): boolean {
  if (!podeNotaInterna(viewer)) return true;
  return pedido !== false;
}

export function validarTexto(texto: unknown): { ok: true; texto: string } | { ok: false; erro: string } {
  const t = typeof texto === "string" ? texto.trim() : "";
  if (!t) return { ok: false, erro: "Escreva o comentário." };
  if (t.length > TEXTO_MAX) return { ok: false, erro: `O comentário pode ter até ${TEXTO_MAX.toLocaleString("pt-BR")} caracteres.` };
  return { ok: true, texto: t };
}

export function textoEvento(de: string, para: string): string {
  return `Etapa: ${de} → ${para}`;
}

/** Dentro da coluna: mais recente em cima; desempate por código. */
export function ordenarCardsDaColuna<T extends { created_at: string | null; code?: string | null }>(lista: T[]): T[] {
  return [...lista].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || String(a.code ?? "").localeCompare(String(b.code ?? "")));
}

/** Aviso no card da oferta quando o status não combina com a etapa. */
export function divergenciaStatusEtapa(status: string | null | undefined, etapa: string | null | undefined): string | null {
  const e = etapaDaOferta(etapa);
  const s = (status ?? "pendente").toLowerCase();
  const final = e === "CONCLUIDA" || e === "PERDIDA";
  if (s === "aceita" && e !== "CONCLUIDA") return "Status da oferta: Aceita";
  if ((s === "recusada" || s === "cancelada") && !final) return `Status da oferta: ${s === "recusada" ? "Recusada" : "Cancelada"}`;
  return null;
}

/** Agrupa itens por coluna, na ordem das colunas, com a ordem de cards aplicada. */
export function agruparPorColuna<T extends { created_at: string | null; code?: string | null }>(
  colunas: string[], itens: T[], colunaDe: (i: T) => string,
): Record<string, T[]> {
  const out: Record<string, T[]> = Object.fromEntries(colunas.map((c) => [c, [] as T[]]));
  for (const i of itens) {
    const c = colunaDe(i);
    (out[c] ?? out[colunas[0]]).push(i);
  }
  for (const c of colunas) out[c] = ordenarCardsDaColuna(out[c]);
  return out;
}
