import {
  ATIVOS, type Cotacao, type CotacoesResposta, type FocusLinha, type IndicadorMacro,
  type IndicadoresResposta, type PeriodoHistorico, type SerieHistorica, SERIES_BCB,
} from "@/lib/mercado/catalogo";

// Aba Mercado: fontes públicas, sem chave. Yahoo Finance (cotações; B3 com ~15 min de atraso)
// e Banco Central (SGS + Focus). Cache em memória por instância: protege as fontes de limite de
// requisição e, se uma delas cair, devolve o último dado bom (stale) em vez de tela vazia.

const UA = "Mozilla/5.0 (compatible; V3Partners/1.0)";
const cache = new Map<string, { expira: number; dado: unknown }>();

async function comCache<T>(chave: string, ttlMs: number, buscar: () => Promise<T | null>): Promise<T | null> {
  const hit = cache.get(chave);
  if (hit && hit.expira > Date.now()) return hit.dado as T;
  const novo = await buscar().catch(() => null);
  if (novo !== null) {
    cache.set(chave, { expira: Date.now() + ttlMs, dado: novo });
    return novo;
  }
  return (hit?.dado as T) ?? null;
}

async function getJson<T>(url: string, ms = 8000, tentativas = 2): Promise<T | null> {
  for (let i = 0; i < tentativas; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal, cache: "no-store", headers: { "User-Agent": UA, Accept: "application/json" } });
      if (r.ok && (r.headers.get("content-type") ?? "").includes("json")) return (await r.json()) as T;
    } catch { /* tenta de novo */ } finally {
      clearTimeout(t);
    }
  }
  return null;
}

// ─── Cotações (Yahoo spark: até 20 símbolos por chamada) ─────────────────────

interface SparkMeta {
  symbol: string; regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number;
  regularMarketChangePercent?: number; regularMarketDayHigh?: number; regularMarketDayLow?: number;
  regularMarketVolume?: number; fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number; regularMarketTime?: number;
  shortName?: string; longName?: string;
  currentTradingPeriod?: { regular?: { start: number; end: number } };
}
interface SparkResp {
  spark?: { result?: { symbol: string; response?: { meta: SparkMeta; timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[] } }[] }[] };
}

function paraCotacao(meta: SparkMeta, fechamentos: (number | null)[] | undefined): Cotacao | null {
  const preco = meta.regularMarketPrice;
  if (preco == null || !Number.isFinite(preco)) return null;
  const anterior = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const variacao = meta.regularMarketChangePercent ?? (anterior ? ((preco - anterior) / anterior) * 100 : null);
  return {
    simbolo: meta.symbol, preco, anterior, variacao,
    maxima: meta.regularMarketDayHigh ?? null, minima: meta.regularMarketDayLow ?? null,
    volume: meta.regularMarketVolume ?? null, max52: meta.fiftyTwoWeekHigh ?? null, min52: meta.fiftyTwoWeekLow ?? null,
    horario: meta.regularMarketTime ?? null,
    intraday: (fechamentos ?? []).filter((v): v is number => v != null && Number.isFinite(v)),
    nome: meta.shortName?.replace(/\s{2,}.*/, "") || meta.longName,
  };
}

async function buscarSpark(simbolos: string[]): Promise<{ cotacoes: Cotacao[]; metas: SparkMeta[] }> {
  const lotes: string[][] = [];
  for (let i = 0; i < simbolos.length; i += 20) lotes.push(simbolos.slice(i, i + 20));
  const respostas = await Promise.all(lotes.map((l) =>
    getJson<SparkResp>(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(l.join(","))}&range=1d&interval=15m`)));
  const cotacoes: Cotacao[] = [];
  const metas: SparkMeta[] = [];
  for (const r of respostas) {
    for (const item of r?.spark?.result ?? []) {
      const resp = item.response?.[0];
      if (!resp?.meta) continue;
      metas.push(resp.meta);
      const c = paraCotacao(resp.meta, resp.indicators?.quote?.[0]?.close);
      if (c) cotacoes.push(c);
    }
  }
  return { cotacoes, metas };
}

export async function cotacoesMercado(): Promise<CotacoesResposta | null> {
  return comCache("cotacoes", 15_000, async () => {
    const { cotacoes, metas } = await buscarSpark(ATIVOS.map((a) => a.simbolo));
    if (!cotacoes.length) return null;
    const ibov = metas.find((m) => m.symbol === "^BVSP")?.currentTradingPeriod?.regular;
    const agora = Date.now() / 1000;
    return {
      cotacoes: Object.fromEntries(cotacoes.map((c) => [c.simbolo, c])),
      atualizadoEm: new Date().toISOString(),
      pregaoAberto: !!ibov && agora >= ibov.start && agora <= ibov.end,
    };
  });
}

/** Busca avulsa (qualquer ticker digitado pelo usuário). */
export async function cotacaoAvulsa(simbolo: string): Promise<Cotacao | null> {
  return comCache(`avulsa:${simbolo}`, 15_000, async () => {
    const { cotacoes } = await buscarSpark([simbolo]);
    return cotacoes[0] ?? null;
  });
}

// ─── Histórico (comparativo) ─────────────────────────────────────────────────

interface ChartResp {
  chart?: { result?: { timestamp?: number[]; indicators?: { quote?: { close?: (number | null)[] }[]; adjclose?: { adjclose?: (number | null)[] }[] } }[] };
}

const INTERVALO: Record<PeriodoHistorico, string> = { "1mo": "1d", "3mo": "1d", "6mo": "1d", ytd: "1d", "1y": "1d", "5y": "1wk" };

function inicioPeriodo(p: PeriodoHistorico): Date {
  const d = new Date();
  if (p === "ytd") return new Date(d.getFullYear(), 0, 1);
  const meses = { "1mo": 1, "3mo": 3, "6mo": 6, "1y": 12, "5y": 60 }[p];
  d.setMonth(d.getMonth() - meses);
  return d;
}

const bcbData = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
const deBcb = (s: string) => { const [dd, mm, aa] = s.split("/").map(Number); return Date.UTC(aa, mm - 1, dd, 12) / 1000; };

type SgsLinha = { data: string; valor: string };

async function sgsPeriodo(serie: number, inicio: Date): Promise<SgsLinha[] | null> {
  return getJson<SgsLinha[]>(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados?formato=json&dataInicial=${bcbData(inicio)}&dataFinal=${bcbData(new Date())}`, 12000, 3);
}

async function serieBcb(id: string, periodo: PeriodoHistorico): Promise<SerieHistorica> {
  const inicio = inicioPeriodo(periodo);
  if (id === SERIES_BCB.CDI) {
    // SGS 12: CDI diário (% a.d.) → índice acumulado
    const linhas = await sgsPeriodo(12, inicio);
    if (!linhas?.length) return { simbolo: id, pontos: [], erro: "CDI indisponível" };
    let acc = 100;
    const pontos = linhas.map((l) => { acc *= 1 + Number(l.valor) / 100; return { t: deBcb(l.data), v: acc }; });
    return { simbolo: id, pontos: [{ t: Math.floor(inicio.getTime() / 1000), v: 100 }, ...pontos] };
  }
  // SGS 433: IPCA mensal → índice acumulado (pontos no fim de cada mês)
  const ini = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const linhas = await sgsPeriodo(433, ini);
  if (!linhas?.length) return { simbolo: id, pontos: [], erro: "IPCA indisponível" };
  let acc = 100;
  const pontos = linhas.map((l) => {
    acc *= 1 + Number(l.valor) / 100;
    const [, mm, aa] = l.data.split("/").map(Number);
    return { t: Date.UTC(aa, mm, 0, 12) / 1000, v: acc };
  });
  return { simbolo: id, pontos: [{ t: Math.floor(inicio.getTime() / 1000), v: 100 }, ...pontos] };
}

export async function historico(simbolo: string, periodo: PeriodoHistorico): Promise<SerieHistorica> {
  const dado = await comCache(`hist:${simbolo}:${periodo}`, simbolo in SERIES_BCB ? 3_600_000 : 300_000, async () => {
    if (simbolo === SERIES_BCB.CDI || simbolo === SERIES_BCB.IPCA) {
      const s = await serieBcb(simbolo, periodo);
      return s.pontos.length ? s : null;
    }
    const r = await getJson<ChartResp>(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(simbolo)}?range=${periodo}&interval=${INTERVALO[periodo]}`);
    const res = r?.chart?.result?.[0];
    const ts = res?.timestamp ?? [];
    const closes = res?.indicators?.adjclose?.[0]?.adjclose ?? res?.indicators?.quote?.[0]?.close ?? [];
    const pontos = ts.map((t, i) => ({ t, v: closes[i] })).filter((p): p is { t: number; v: number } => p.v != null && Number.isFinite(p.v));
    return pontos.length ? { simbolo, pontos } : null;
  });
  return dado ?? { simbolo, pontos: [], erro: "Sem dados para o período" };
}

// ─── Indicadores (Banco Central) ─────────────────────────────────────────────

// O "/ultimos/N" do SGS devolve página HTML de erro para algumas séries de vez em quando (IGP-M,
// TR, em 26/10/2026); a consulta por período segue respondendo, então serve de reserva.
async function sgsUltimos(serie: number, n: number): Promise<SgsLinha[] | null> {
  const r = await getJson<SgsLinha[]>(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/${n}?formato=json`, 10000, 2);
  if (Array.isArray(r) && r.length) return r;
  const inicio = new Date();
  inicio.setDate(inicio.getDate() - Math.max(45, n * 35));
  const p = await sgsPeriodo(serie, inicio);
  return Array.isArray(p) && p.length ? p.slice(-n) : null;
}

const acumula12 = (linhas: SgsLinha[] | null) =>
  linhas && linhas.length >= 12 ? (linhas.slice(-12).reduce((acc, l) => acc * (1 + Number(l.valor) / 100), 1) - 1) * 100 : null;
const mesRef = (data?: string) => {
  if (!data) return "";
  const [, mm, aa] = data.split("/");
  return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(mm) - 1]}/${aa}`;
};

interface FocusResp { value?: { Indicador: string; Data: string; DataReferencia: string; Mediana: number | null; baseCalculo: number }[] }

async function focus(): Promise<IndicadoresResposta["focus"]> {
  const filtro = "(Indicador eq 'IPCA' or Indicador eq 'Selic' or Indicador eq 'PIB Total' or Indicador eq 'Câmbio') and baseCalculo eq 0";
  const r = await getJson<FocusResp>(
    "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/ExpectativasMercadoAnuais" +
    `?$top=80&$orderby=Data%20desc&$filter=${encodeURIComponent(filtro)}&$format=json&$select=Indicador,Data,DataReferencia,Mediana,baseCalculo`, 15000, 3);
  const linhas = r?.value ?? [];
  if (!linhas.length) return { data: null, linhas: [] };
  const ano = new Date().getFullYear();
  const anos = [String(ano), String(ano + 1), String(ano + 2)];
  const saida: FocusLinha[] = [];
  for (const ind of ["IPCA", "Selic", "PIB Total", "Câmbio"]) {
    const doInd = linhas.filter((l) => l.Indicador === ind);
    const ultima = doInd[0]?.Data;
    for (const a of anos) {
      const l = doInd.find((x) => x.Data === ultima && x.DataReferencia === a);
      saida.push({ indicador: ind, ano: a, mediana: l?.Mediana ?? null });
    }
  }
  return { data: linhas[0].Data, linhas: saida };
}

export async function indicadoresMercado(): Promise<IndicadoresResposta | null> {
  return comCache("indicadores", 30 * 60_000, async () => {
    const [selic, cdiAa, cdiDia, ipca12, ipcaMes, igpm, incc, tr, desemprego, foc] = await Promise.all([
      sgsUltimos(432, 1), sgsUltimos(4389, 1), sgsUltimos(12, 1), sgsUltimos(13522, 1), sgsUltimos(433, 12),
      sgsUltimos(189, 12), sgsUltimos(192, 12), sgsUltimos(226, 1), sgsUltimos(24369, 1), focus(),
    ]);
    const num = (l: SgsLinha[] | null) => (l?.length ? Number(l[l.length - 1].valor) : null);

    const selicV = num(selic);
    // CDI a.a.: série 4389; se cair, anualiza o diário (base 252)
    const cdiV = num(cdiAa) ?? (num(cdiDia) != null ? (Math.pow(1 + num(cdiDia)! / 100, 252) - 1) * 100 : null);
    const ipca12V = num(ipca12) ?? acumula12(ipcaMes);
    const trV = num(tr);
    // Poupança (regra com Selic > 8,5%): 0,5% a.m. + TR
    const poupancaV = selicV != null ? (Math.pow(1.005 + (selicV > 8.5 ? (trV ?? 0) / 100 : 0), 12) - 1) * 100 : null;

    const indicadores: IndicadorMacro[] = [
      { id: "selic", rotulo: "Selic meta", valor: selicV, unidade: "% a.a.", referencia: "Copom", descricao: "Taxa básica de juros definida pelo Copom" },
      { id: "cdi", rotulo: "CDI", valor: cdiV, unidade: "% a.a.", referencia: cdiAa?.[0]?.data ?? cdiDia?.[0]?.data ?? "", descricao: "Referência da renda fixa pós-fixada" },
      { id: "ipca12", rotulo: "IPCA 12 meses", valor: ipca12V, unidade: "%", referencia: mesRef(ipca12?.[0]?.data ?? ipcaMes?.at(-1)?.data), descricao: "Inflação oficial acumulada em 12 meses" },
      { id: "ipcames", rotulo: "IPCA do mês", valor: num(ipcaMes), unidade: "%", referencia: mesRef(ipcaMes?.at(-1)?.data), descricao: "Última variação mensal divulgada pelo IBGE" },
      { id: "igpm", rotulo: "IGP-M 12 meses", valor: acumula12(igpm), unidade: "%", referencia: mesRef(igpm?.at(-1)?.data), descricao: "Índice dos aluguéis e contratos (FGV)" },
      { id: "incc", rotulo: "INCC 12 meses", valor: acumula12(incc), unidade: "%", referencia: mesRef(incc?.at(-1)?.data), descricao: "Custo da construção civil (FGV)" },
      { id: "poupanca", rotulo: "Poupança", valor: poupancaV, unidade: "% a.a.", referencia: "estimada", descricao: "0,5% a.m. + TR (Selic acima de 8,5%)" },
      { id: "tr", rotulo: "TR", valor: trV, unidade: "% a.m.", referencia: tr?.[0]?.data ?? "", descricao: "Taxa Referencial" },
      { id: "desemprego", rotulo: "Desemprego", valor: num(desemprego), unidade: "%", referencia: mesRef(desemprego?.[0]?.data), descricao: "Taxa de desocupação (PNAD Contínua)" },
    ];
    if (indicadores.every((i) => i.valor == null) && !foc.linhas.length) return null;

    const juroReal = selicV != null && ipca12V != null ? ((1 + selicV / 100) / (1 + ipca12V / 100) - 1) * 100 : null;
    return { indicadores, focus: foc, juroReal, atualizadoEm: new Date().toISOString() };
  });
}
