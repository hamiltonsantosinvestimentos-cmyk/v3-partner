/**
 * NOME DE EXIBIÇÃO DOS ANEXOS DAS PROPOSTAS (BRIEF 09/11/2026: docs/briefs/2026-11-09_nomear-documentos-propostas.md)
 *
 * Funções puras, sem I/O. Padrão "Tipo Período - Titular.ext" (ex.: "Faturamento 2026 - Empresa XYZ Ltda.pdf").
 * O desempate " (2)" é calculado SÓ na exibição, sempre por `nomesDeExibicao`, usada no GET, no download e no
 * ZIP, para o mesmo arquivo ter o mesmo nome nos três lugares.
 */

export const TIPOS_DOCUMENTO = [
  "CNH", "RG", "CPF", "Certidão de Casamento", "Certidão de Nascimento", "Comprovante de Residência",
  "Comprovante de Renda", "Holerite", "Imposto de Renda", "Recibo do Imposto de Renda", "Extrato Bancário",
  "Cartão CNPJ", "Contrato Social", "Alteração Contratual", "Faturamento", "DRE", "Balanço Patrimonial",
  "Balancete", "Certidão Negativa", "Matrícula", "IPTU", "Escritura", "Laudo de Avaliação", "Contrato",
  "Procuração", "Outro",
] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export const CONFIANCA_MINIMA = 0.7;
export const NOME_MAX = 120;
const TITULAR_MAX = 100;

export type LeituraDocumento = {
  tipo: string | null;
  periodo: string | null;
  titular: string | null;
  confianca: number | null;
};

/** Tipo fora da lista fechada vira "Outro". */
export function normalizarTipo(tipo: string | null | undefined): TipoDocumento {
  const t = String(tipo ?? "").trim();
  const achado = TIPOS_DOCUMENTO.find((x) => x.toLowerCase() === t.toLowerCase());
  return achado ?? "Outro";
}

/** "2026" ou "2025-2026"; qualquer outra coisa vira null. */
export function normalizarPeriodo(p: string | null | undefined): string | null {
  const s = String(p ?? "").trim().replace(/\s*[/–—-]\s*/g, "-");
  return /^[0-9]{4}(-[0-9]{4})?$/.test(s) ? s : null;
}

/** Tira caracteres proibidos em nome de arquivo (Windows/macOS) e espaços repetidos. */
export function limparTrecho(s: string | null | undefined): string {
  return String(s ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .trim();
}

export function extensaoDe(nomeArquivo: string): string {
  const base = nomeArquivo.split(/[\\/]/).pop() ?? nomeArquivo;
  const i = base.lastIndexOf(".");
  if (i <= 0 || i === base.length - 1) return "";
  const ext = base.slice(i);
  return /^\.[A-Za-z0-9]{1,6}$/.test(ext) ? ext : "";
}

/**
 * Nome BASE (sem desempate) a partir da leitura, ou null quando o original deve ser mantido
 * (confiança baixa, "Outro" sem titular, leitura vazia).
 */
export function montarNomeBase(leitura: LeituraDocumento, nomeOriginal: string): string | null {
  const conf = typeof leitura.confianca === "number" ? leitura.confianca : 0;
  if (!(conf >= CONFIANCA_MINIMA)) return null;
  const tipo = normalizarTipo(leitura.tipo);
  const periodo = normalizarPeriodo(leitura.periodo);
  const titular = limparTrecho(leitura.titular).slice(0, TITULAR_MAX).trim();
  if (tipo === "Outro" && !titular) return null;

  const rotulo = tipo === "Outro" ? "Documento" : tipo;
  const cabeca = periodo ? `${rotulo} ${periodo}` : rotulo;
  const ext = extensaoDe(nomeOriginal);
  let corpo = titular ? `${cabeca} - ${titular}` : cabeca;
  const maxCorpo = NOME_MAX - ext.length;
  if (corpo.length > maxCorpo) corpo = corpo.slice(0, maxCorpo).trim();
  return `${corpo}${ext}`;
}

/** Chave de comparação do desempate: sem acento e sem diferença de maiúsculas. */
export function chaveComparacao(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type ItemExibicao = { storage_path: string; file_name: string; uploaded_at?: string | null };

/** Ordem fixa do BRIEF: uploaded_at ascendente, depois storage_path ascendente. */
export function ordenarParaExibicao<T extends ItemExibicao>(docs: T[]): T[] {
  return [...docs].sort((a, b) => {
    const ta = Date.parse(a.uploaded_at ?? "");
    const tb = Date.parse(b.uploaded_at ?? "");
    const va = Number.isNaN(ta) ? Number.POSITIVE_INFINITY : ta;
    const vb = Number.isNaN(tb) ? Number.POSITIVE_INFINITY : tb;
    if (va !== vb) return va < vb ? -1 : 1;
    return a.storage_path < b.storage_path ? -1 : a.storage_path > b.storage_path ? 1 : 0;
  });
}

/**
 * Nome final de cada arquivo (storage_path -> nome), já desempatado. `bases` traz o nome base gravado
 * (storage_path -> nome_exibicao); sem base, usa o nome original. O primeiro de cada nome fica limpo, os
 * seguintes recebem " (2)", " (3)", sem diferenciar acento nem maiúsculas.
 */
export function nomesDeExibicao(docs: ItemExibicao[], bases: Map<string, string | null | undefined>): Map<string, string> {
  const usados = new Set<string>();
  const out = new Map<string, string>();
  for (const d of ordenarParaExibicao(docs)) {
    const desejado = limparTrecho(bases.get(d.storage_path) || d.file_name) || "documento";
    let nome = desejado;
    if (usados.has(chaveComparacao(nome))) {
      const ext = extensaoDe(desejado);
      const raiz = ext ? desejado.slice(0, -ext.length) : desejado;
      let i = 2;
      do { nome = `${raiz} (${i})${ext}`; i++; } while (usados.has(chaveComparacao(nome)));
    }
    usados.add(chaveComparacao(nome));
    out.set(d.storage_path, nome);
  }
  return out;
}

export type LinhaNome = { storage_path: string; status: string; tentativas: number };
export const TENTATIVAS_MAX = 3;

/**
 * Itens de `documents` que precisam de leitura: enviados a partir do corte (comparação como data) e sem
 * linha na tabela, ou com linha em `erro` e menos de 3 tentativas. Sem `uploaded_at` válido: fica de fora.
 */
export function selecionarPendentes<T extends { storage_path?: string; uploaded_at?: string | null }>(
  docs: T[], linhas: LinhaNome[], corteIso: string,
): { doc: T; nova: boolean }[] {
  const corte = Date.parse(corteIso);
  if (Number.isNaN(corte)) return [];
  const porPath = new Map(linhas.map((l) => [l.storage_path, l]));
  const out: { doc: T; nova: boolean }[] = [];
  for (const d of docs) {
    if (!d.storage_path) continue;
    const t = Date.parse(d.uploaded_at ?? "");
    if (Number.isNaN(t) || t < corte) continue;
    const l = porPath.get(d.storage_path);
    if (!l) out.push({ doc: d, nova: true });
    else if (l.status === "erro" && l.tentativas < TENTATIVAS_MAX) out.push({ doc: d, nova: false });
  }
  return out;
}

/** Data DD/MM/AAAA no fuso de São Paulo, para o tooltip. */
export function dataLeituraBR(iso: string | null | undefined): string | null {
  const t = Date.parse(iso ?? "");
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(t));
}
