// Aba Mercado (26/10/2026): catálogo dos ativos acompanhados. Símbolos no padrão do Yahoo
// Finance (ações da B3 com ".SA", ~15 min de atraso; moedas, cripto e bolsas de fora quase ao vivo).
// Tickers conferidos um a um em 26/10/2026 (Embraer é EMBJ3, Natura NATU3, Copel CPLE3).

export type GrupoMercado = "indice_br" | "acao" | "etf" | "indice_global" | "moeda" | "commodity" | "cripto" | "juros_eua";

export interface AtivoMercado {
  simbolo: string;      // símbolo no Yahoo
  codigo: string;       // como aparece na tela (PETR4, Ibovespa, Dólar…)
  nome: string;
  grupo: GrupoMercado;
  setor?: string;       // só ações da B3
  unidade?: "BRL" | "USD" | "pts" | "%" | "USc";
  regiao?: string;      // índices globais
}

const acao = (codigo: string, nome: string, setor: string): AtivoMercado =>
  ({ simbolo: `${codigo}.SA`, codigo, nome, grupo: "acao", setor, unidade: "BRL" });

export const ATIVOS: AtivoMercado[] = [
  // Índices B3
  { simbolo: "^BVSP", codigo: "IBOV", nome: "Ibovespa", grupo: "indice_br", unidade: "pts" },
  { simbolo: "SMLL.SA", codigo: "SMLL", nome: "Small Caps", grupo: "indice_br", unidade: "pts" },
  { simbolo: "IFIX.SA", codigo: "IFIX", nome: "Fundos Imobiliários", grupo: "indice_br", unidade: "pts" },

  // Ações B3 (mais negociadas)
  acao("PETR4", "Petrobras PN", "Petróleo e Gás"),
  acao("PETR3", "Petrobras ON", "Petróleo e Gás"),
  acao("PRIO3", "PRIO", "Petróleo e Gás"),
  acao("VBBR3", "Vibra", "Petróleo e Gás"),
  acao("UGPA3", "Ultrapar", "Petróleo e Gás"),
  acao("CSAN3", "Cosan", "Petróleo e Gás"),
  acao("VALE3", "Vale", "Mineração e Siderurgia"),
  acao("GGBR4", "Gerdau", "Mineração e Siderurgia"),
  acao("CSNA3", "CSN", "Mineração e Siderurgia"),
  acao("ITUB4", "Itaú Unibanco", "Bancos e Financeiro"),
  acao("BBDC4", "Bradesco", "Bancos e Financeiro"),
  acao("BBAS3", "Banco do Brasil", "Bancos e Financeiro"),
  acao("SANB11", "Santander", "Bancos e Financeiro"),
  acao("BPAC11", "BTG Pactual", "Bancos e Financeiro"),
  acao("ITSA4", "Itaúsa", "Bancos e Financeiro"),
  acao("B3SA3", "B3", "Bancos e Financeiro"),
  acao("BBSE3", "BB Seguridade", "Bancos e Financeiro"),
  acao("CXSE3", "Caixa Seguridade", "Bancos e Financeiro"),
  acao("EQTL3", "Equatorial", "Energia e Saneamento"),
  acao("CMIG4", "Cemig", "Energia e Saneamento"),
  acao("CPLE3", "Copel", "Energia e Saneamento"),
  acao("ENEV3", "Eneva", "Energia e Saneamento"),
  acao("SBSP3", "Sabesp", "Energia e Saneamento"),
  acao("WEGE3", "WEG", "Indústria"),
  acao("EMBJ3", "Embraer", "Indústria"),
  acao("SUZB3", "Suzano", "Indústria"),
  acao("KLBN11", "Klabin", "Indústria"),
  acao("RAIL3", "Rumo", "Indústria"),
  acao("ABEV3", "Ambev", "Consumo e Varejo"),
  acao("LREN3", "Lojas Renner", "Consumo e Varejo"),
  acao("MGLU3", "Magazine Luiza", "Consumo e Varejo"),
  acao("AZZA3", "Azzas 2154", "Consumo e Varejo"),
  acao("NATU3", "Natura", "Consumo e Varejo"),
  acao("RENT3", "Localiza", "Consumo e Varejo"),
  acao("RADL3", "Raia Drogasil", "Saúde"),
  acao("RDOR3", "Rede D'Or", "Saúde"),
  acao("HAPV3", "Hapvida", "Saúde"),
  acao("CYRE3", "Cyrela", "Imobiliário"),
  acao("MRVE3", "MRV", "Imobiliário"),
  acao("VIVT3", "Vivo", "Telecom e Tecnologia"),
  acao("TIMS3", "TIM", "Telecom e Tecnologia"),
  acao("TOTS3", "Totvs", "Telecom e Tecnologia"),

  // ETFs
  { simbolo: "BOVA11.SA", codigo: "BOVA11", nome: "ETF Ibovespa", grupo: "etf", unidade: "BRL" },
  { simbolo: "SMAL11.SA", codigo: "SMAL11", nome: "ETF Small Caps", grupo: "etf", unidade: "BRL" },
  { simbolo: "IVVB11.SA", codigo: "IVVB11", nome: "ETF S&P 500 em reais", grupo: "etf", unidade: "BRL" },
  { simbolo: "HASH11.SA", codigo: "HASH11", nome: "ETF Cripto", grupo: "etf", unidade: "BRL" },

  // Bolsas globais
  { simbolo: "^GSPC", codigo: "S&P 500", nome: "S&P 500", grupo: "indice_global", unidade: "pts", regiao: "EUA" },
  { simbolo: "^IXIC", codigo: "Nasdaq", nome: "Nasdaq Composite", grupo: "indice_global", unidade: "pts", regiao: "EUA" },
  { simbolo: "^DJI", codigo: "Dow Jones", nome: "Dow Jones", grupo: "indice_global", unidade: "pts", regiao: "EUA" },
  { simbolo: "^VIX", codigo: "VIX", nome: "Índice do medo (VIX)", grupo: "indice_global", unidade: "pts", regiao: "EUA" },
  { simbolo: "^STOXX50E", codigo: "Euro Stoxx 50", nome: "Euro Stoxx 50", grupo: "indice_global", unidade: "pts", regiao: "Europa" },
  { simbolo: "^GDAXI", codigo: "DAX", nome: "DAX (Alemanha)", grupo: "indice_global", unidade: "pts", regiao: "Europa" },
  { simbolo: "^FTSE", codigo: "FTSE 100", nome: "FTSE 100 (Reino Unido)", grupo: "indice_global", unidade: "pts", regiao: "Europa" },
  { simbolo: "^N225", codigo: "Nikkei", nome: "Nikkei 225 (Japão)", grupo: "indice_global", unidade: "pts", regiao: "Ásia" },
  { simbolo: "^HSI", codigo: "Hang Seng", nome: "Hang Seng (Hong Kong)", grupo: "indice_global", unidade: "pts", regiao: "Ásia" },
  { simbolo: "000001.SS", codigo: "Xangai", nome: "SSE Composite (China)", grupo: "indice_global", unidade: "pts", regiao: "Ásia" },

  // Moedas
  { simbolo: "USDBRL=X", codigo: "Dólar", nome: "Dólar comercial (USD/BRL)", grupo: "moeda", unidade: "BRL" },
  { simbolo: "EURBRL=X", codigo: "Euro", nome: "Euro (EUR/BRL)", grupo: "moeda", unidade: "BRL" },
  { simbolo: "GBPBRL=X", codigo: "Libra", nome: "Libra (GBP/BRL)", grupo: "moeda", unidade: "BRL" },
  { simbolo: "CNYBRL=X", codigo: "Yuan", nome: "Yuan (CNY/BRL)", grupo: "moeda", unidade: "BRL" },
  { simbolo: "JPYBRL=X", codigo: "Iene", nome: "Iene (JPY/BRL)", grupo: "moeda", unidade: "BRL" },
  { simbolo: "EURUSD=X", codigo: "EUR/USD", nome: "Euro x Dólar", grupo: "moeda", unidade: "USD" },
  { simbolo: "DX-Y.NYB", codigo: "DXY", nome: "Índice do dólar (DXY)", grupo: "moeda", unidade: "pts" },

  // Commodities
  { simbolo: "BZ=F", codigo: "Brent", nome: "Petróleo Brent", grupo: "commodity", unidade: "USD" },
  { simbolo: "CL=F", codigo: "WTI", nome: "Petróleo WTI", grupo: "commodity", unidade: "USD" },
  { simbolo: "GC=F", codigo: "Ouro", nome: "Ouro (onça)", grupo: "commodity", unidade: "USD" },
  { simbolo: "SI=F", codigo: "Prata", nome: "Prata (onça)", grupo: "commodity", unidade: "USD" },
  { simbolo: "HG=F", codigo: "Cobre", nome: "Cobre (libra)", grupo: "commodity", unidade: "USD" },
  { simbolo: "ZS=F", codigo: "Soja", nome: "Soja CBOT (bushel)", grupo: "commodity", unidade: "USc" },
  { simbolo: "ZC=F", codigo: "Milho", nome: "Milho CBOT (bushel)", grupo: "commodity", unidade: "USc" },
  { simbolo: "KC=F", codigo: "Café", nome: "Café arábica (libra)", grupo: "commodity", unidade: "USc" },
  { simbolo: "SB=F", codigo: "Açúcar", nome: "Açúcar nº 11 (libra)", grupo: "commodity", unidade: "USc" },
  { simbolo: "LE=F", codigo: "Boi", nome: "Boi gordo CME (libra)", grupo: "commodity", unidade: "USc" },

  // Cripto
  { simbolo: "BTC-USD", codigo: "Bitcoin", nome: "Bitcoin", grupo: "cripto", unidade: "USD" },
  { simbolo: "ETH-USD", codigo: "Ethereum", nome: "Ethereum", grupo: "cripto", unidade: "USD" },
  { simbolo: "SOL-USD", codigo: "Solana", nome: "Solana", grupo: "cripto", unidade: "USD" },

  // Juros EUA (Treasuries)
  { simbolo: "^IRX", codigo: "T-Bill 3M", nome: "Treasury 3 meses", grupo: "juros_eua", unidade: "%" },
  { simbolo: "^FVX", codigo: "Treasury 5A", nome: "Treasury 5 anos", grupo: "juros_eua", unidade: "%" },
  { simbolo: "^TNX", codigo: "Treasury 10A", nome: "Treasury 10 anos", grupo: "juros_eua", unidade: "%" },
];

export const ATIVO_POR_SIMBOLO = new Map(ATIVOS.map((a) => [a.simbolo, a]));

/** Ticker digitado na busca (PETR4, petr4, ^BVSP…) → símbolo Yahoo. */
export function normalizarSimbolo(entrada: string): string {
  const s = entrada.trim().toUpperCase();
  if (!s) return s;
  const doCatalogo = ATIVOS.find((a) => a.codigo.toUpperCase() === s || a.simbolo === s);
  if (doCatalogo) return doCatalogo.simbolo;
  if (/^[A-Z]{4}\d{1,2}$/.test(s)) return `${s}.SA`;
  return s;
}

// Séries sintéticas do comparativo (vêm do Banco Central, não do Yahoo).
export const SERIES_BCB = { CDI: "CDI", IPCA: "IPCA" } as const;

export interface Cotacao {
  simbolo: string;
  preco: number;
  anterior: number | null;   // fechamento do pregão anterior
  variacao: number | null;   // % do dia
  maxima: number | null;
  minima: number | null;
  volume: number | null;
  max52: number | null;
  min52: number | null;
  horario: number | null;    // epoch (s) do último negócio
  intraday: number[];        // fechamentos de 15 em 15 min, para o mini-gráfico
  nome?: string;
}

export interface CotacoesResposta {
  cotacoes: Record<string, Cotacao>;
  atualizadoEm: string;
  pregaoAberto: boolean;
}

export interface IndicadorMacro {
  id: string;
  rotulo: string;
  valor: number | null;
  unidade: string;
  referencia: string;     // data/mês de referência
  descricao: string;
}

export interface FocusLinha { indicador: string; ano: string; mediana: number | null }

export interface IndicadoresResposta {
  indicadores: IndicadorMacro[];
  focus: { data: string | null; linhas: FocusLinha[] };
  juroReal: number | null;   // Selic meta descontada do IPCA 12m (ex-post)
  atualizadoEm: string;
}

export type PeriodoHistorico = "1mo" | "3mo" | "6mo" | "ytd" | "1y" | "5y";

export interface SerieHistorica { simbolo: string; pontos: { t: number; v: number }[]; erro?: string }
