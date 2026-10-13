// Simulador CASH HOME / CASH AGRO (13/10/2026, pedido do Hamilton). Reproduz o
// "Demonstrativo da Liquidez do Fundo" (Lance Consórcio, 06/10/2026):
//   Crédito R$ 13.666.029,00 · Entrada 48% · 188 meses · Parcela R$ 86.989,37
//   IOF R$ 64.180,31 · Emissão CCB R$ 33.428,00 · Transferência isenta
//   Juros de fundo R$ 735.399,38 · Crédito Líquido R$ 6.273.327,39
// Na V3 o "Crédito" é a média das avaliações do imóvel e o "Crédito Líquido" é
// o valor liberado ao cliente. Os percentuais abaixo saem desse demonstrativo:
//   - IOF = 0,9784% da entrada (o demonstrativo arredonda para 0,98%)
//   - Emissão CCB = 0,2446% do crédito (R$ 33.428 no exemplo)
//   - Juros de fundo = 11,2109% da entrada
//   - Taxa média 1,29% a.m. + INCC (definida pelo Hamilton em 13/10/2026; a
//     do demonstrativo, valor liberado × prazo × parcela, dava 1,2533% a.m.);
//     a parcela é PRICE sobre o valor liberado a essa taxa
//   - A taxa é mensal + INCC: parcela e saldo são corrigidos pelo INCC, então os
//     valores do simulador são em moeda de hoje (sem a correção)
// Só há um ponto de taxa (188 meses), então a taxa média é a mesma em toda a
// faixa de 110 a 190 meses até a Mesa passar a tabela por prazo (TAXAS_POR_PRAZO).

export const PRAZO_MIN = 110;
export const PRAZO_MAX = 190;

export type LinhaCash = "CASH_HOME" | "CASH_AGRO";
export const LINHAS_CASH: Record<LinhaCash, { nome: string; garantia: string }> = {
  CASH_HOME: { nome: "CASH HOME", garantia: "Imóvel urbano" },
  CASH_AGRO: { nome: "CASH AGRO", garantia: "Imóvel rural" },
};

export const PARAMETROS_CASH = {
  entradaPct: 0.48,
  iofPctEntrada: 0.00978404,
  ccbPctCredito: 0.00244607,
  jurosFundoPctEntrada: 0.1121088,
  // Taxa de transferência: no demonstrativo era isenta; na V3 é 1% da média de
  // avaliação, descontada do valor liberado (Hamilton, 13/10/2026).
  transferenciaPctCredito: 0.01,
  // Comprometimento máximo de renda: a parcela pode ser até 30% da renda
  // (renda de R$ 100 mil → parcela máxima de R$ 30 mil). Renda necessária =
  // parcela / 30%, ou seja, parcela × 3,33.
  comprometimentoRenda: 0.30,
  taxaMensalPadrao: 0.0129,
};

// Taxa média a.m. por prazo (meses). Prazos sem entrada usam a faixa anterior
// mais próxima; vazio = taxa padrão do demonstrativo.
export const TAXAS_POR_PRAZO: { aPartirDe: number; taxaMensal: number }[] = [];

export function taxaMediaDoPrazo(prazo: number): number {
  const faixa = [...TAXAS_POR_PRAZO]
    .sort((a, b) => b.aPartirDe - a.aPartirDe)
    .find((f) => prazo >= f.aPartirDe);
  return faixa?.taxaMensal ?? PARAMETROS_CASH.taxaMensalPadrao;
}

export function parcelaPrice(pv: number, taxa: number, n: number): number {
  if (pv <= 0 || n <= 0) return 0;
  if (taxa <= 0) return pv / n;
  return (pv * taxa) / (1 - Math.pow(1 + taxa, -n));
}

// Taxa mensal que iguala o valor recebido às parcelas (CET a.m. do cliente).
export function taxaImplicita(pv: number, parcela: number, n: number): number {
  if (pv <= 0 || parcela <= 0 || parcela * n <= pv) return 0;
  let lo = 0, hi = 0.2;
  for (let k = 0; k < 200; k++) {
    const m = (lo + hi) / 2;
    if (parcelaPrice(pv, m, n) > parcela) hi = m; else lo = m;
  }
  return (lo + hi) / 2;
}

export function mediaAvaliacoes(valores: number[]): number {
  const v = valores.filter((x) => Number.isFinite(x) && x > 0);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export type SimulacaoCash = {
  credito: number;
  entrada: number;
  prazo: number;
  taxaMensal: number;
  parcela: number;
  iof: number;
  emissaoCcb: number;
  jurosFundo: number;
  taxaTransferencia: number;
  valorLiberado: number;
  taxaAnual: number;
  rendaNecessaria: number;
};

export function simularCash(credito: number, prazo: number, taxaMensal = taxaMediaDoPrazo(prazo)): SimulacaoCash | null {
  if (!(credito > 0) || !(prazo > 0)) return null;
  const p = PARAMETROS_CASH;
  const entrada = r2(credito * p.entradaPct);
  const iof = r2(entrada * p.iofPctEntrada);
  const emissaoCcb = r2(credito * p.ccbPctCredito);
  const jurosFundo = r2(entrada * p.jurosFundoPctEntrada);
  const taxaTransferencia = r2(credito * p.transferenciaPctCredito);
  const valorLiberado = r2(credito - entrada - iof - emissaoCcb - jurosFundo - taxaTransferencia);
  const parcela = r2(parcelaPrice(valorLiberado, taxaMensal, prazo));
  return {
    credito, entrada, prazo, taxaMensal, parcela, iof, emissaoCcb, jurosFundo, taxaTransferencia, valorLiberado,
    taxaAnual: Math.pow(1 + taxaMensal, 12) - 1,
    rendaNecessaria: r2(parcela / p.comprometimentoRenda),
  };
}

/** Maior parcela que a renda mensal do cliente comporta (30% da renda). */
export function parcelaMaxima(renda: number): number {
  return renda > 0 ? r2(renda * PARAMETROS_CASH.comprometimentoRenda) : 0;
}

/** Menor prazo (110 a 190 meses) cuja parcela cabe na renda; null se nenhum cabe. */
export function prazoMinimoQueCabe(credito: number, renda: number): number | null {
  const max = parcelaMaxima(renda);
  if (!(max > 0)) return null;
  for (let n = PRAZO_MIN; n <= PRAZO_MAX; n++) {
    const s = simularCash(credito, n);
    if (s && s.parcela <= max) return n;
  }
  return null;
}

/** Fração da avaliação que chega ao cliente como valor liberado (≈ 44,9%). */
export function fatorValorLiberado(): number {
  const p = PARAMETROS_CASH;
  const e = p.entradaPct;
  return 1 - e - e * p.iofPctEntrada - p.ccbPctCredito - e * p.jurosFundoPctEntrada - p.transferenciaPctCredito;
}

/**
 * A partir da renda: maior valor liberado cuja parcela cabe em 30% da renda no
 * prazo dado, e a média de avaliação do imóvel necessária para liberá-lo.
 */
export function creditoPelaRenda(renda: number, prazo: number, taxaMensal = taxaMediaDoPrazo(prazo)) {
  const parcela = parcelaMaxima(renda);
  if (!(parcela > 0) || !(prazo > 0)) return null;
  const valorLiberado = taxaMensal > 0
    ? (parcela * (1 - Math.pow(1 + taxaMensal, -prazo))) / taxaMensal
    : parcela * prazo;
  return {
    prazo,
    parcela,
    valorLiberado: r2(valorLiberado),
    avaliacaoNecessaria: r2(valorLiberado / fatorValorLiberado()),
  };
}
