import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface MarketData {
  selic: { value: string; date: string };
  cdi:   { value: string; date: string };
  usd:   { value: string; change: string; positive: boolean };
  eur:   { value: string; change: string; positive: boolean };
  gold:  { value: string; unit: string };
  updatedAt: string;
}

async function fetchJson<T>(url: string, ms = 6000): Promise<T | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    clearTimeout(id);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    clearTimeout(id);
    return null;
  }
}

// Formata data para BCB PTAX: MM-DD-YYYY
function ptaxDate(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getFullYear()}`;
}

type PtaxRow = { cotacaoCompra: number; cotacaoVenda: number; dataHoraCotacao: string };

// BCB PTAX USD — últimos 7 dias garante ter o último dado disponível
async function fetchUsdPtax(): Promise<{ bid: number; prev: number } | null> {
  const data = await fetchJson<{ value: PtaxRow[] }>(
    `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` +
    `CotacaoDolarPeriodo(dataInicial=@di,dataFinalCotacao=@df)` +
    `?@di='${ptaxDate(7)}'&@df='${ptaxDate(0)}'` +
    `&$top=2&$orderby=dataHoraCotacao%20desc&$format=json&$select=cotacaoCompra,cotacaoVenda`
  );
  const rows = data?.value ?? [];
  if (!rows.length) return null;
  return { bid: rows[0].cotacaoVenda, prev: rows[1]?.cotacaoVenda ?? rows[0].cotacaoVenda };
}

// BCB PTAX moeda genérica (EUR, GBP …)
async function fetchCurrencyPtax(moeda: string): Promise<{ bid: number; prev: number } | null> {
  const data = await fetchJson<{ value: PtaxRow[] }>(
    `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/` +
    `CotacaoMoedaPeriodo(moeda=@m,dataInicial=@di,dataFinalCotacao=@df)` +
    `?@m='${moeda}'&@di='${ptaxDate(7)}'&@df='${ptaxDate(0)}'` +
    `&$top=2&$orderby=dataHoraCotacao%20desc&$format=json&$select=cotacaoCompra,cotacaoVenda`
  );
  const rows = data?.value ?? [];
  if (!rows.length) return null;
  return { bid: rows[0].cotacaoVenda, prev: rows[1]?.cotacaoVenda ?? rows[0].cotacaoVenda };
}

function fmtPct(pct: number) {
  return Math.abs(pct).toFixed(2).replace(".", ",") + "%";
}

function fmtBrl(v: number) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET() {
  // ── Busca tudo em paralelo ────────────────────────────────────────────────
  const [selicData, cdiData, awesomeFx, goldData, ptaxUsd, ptaxEur] =
    await Promise.all([
      // SELIC Meta
      fetchJson<{ valor: string; data: string }[]>(
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json"
      ),
      // CDI anualizado
      fetchJson<{ valor: string; data: string }[]>(
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json"
      ),
      // AwesomeAPI USD + EUR (tentativa primária)
      fetchJson<Record<string, { bid: string; pctChange: string }>>(
        "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL"
      ),
      // BCB SGS 4 = Ouro BM&F/B3 (R$/grama)
      fetchJson<{ valor: string; data: string }[]>(
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4/dados/ultimos/2?formato=json"
      ),
      // BCB PTAX USD (fallback confiável)
      fetchUsdPtax(),
      // BCB PTAX EUR
      fetchCurrencyPtax("EUR"),
    ]);

  // ── SELIC ─────────────────────────────────────────────────────────────────
  const selicRow = selicData?.[0];
  const selicValue = selicRow
    ? parseFloat(selicRow.valor).toFixed(2).replace(".", ",") + "%"
    : "—";
  const selicDate = selicRow?.data ?? "";

  // ── CDI ───────────────────────────────────────────────────────────────────
  const cdiRow = cdiData?.[0];
  const cdiValue = cdiRow
    ? parseFloat(cdiRow.valor).toFixed(2).replace(".", ",") + "%"
    : "—";
  const cdiDate = cdiRow?.data ?? "";

  // ── USD ───────────────────────────────────────────────────────────────────
  let usdValue = "—";
  let usdChange = "0,00%";
  let usdPositive = true;

  const awUsd = awesomeFx?.USDBRL;
  if (awUsd?.bid) {
    const bid = parseFloat(awUsd.bid);
    const pct = parseFloat(awUsd.pctChange ?? "0");
    usdValue   = fmtBrl(bid);
    usdChange  = fmtPct(pct);
    usdPositive = pct >= 0;
  } else if (ptaxUsd) {
    const pct = ptaxUsd.prev ? ((ptaxUsd.bid - ptaxUsd.prev) / ptaxUsd.prev) * 100 : 0;
    usdValue   = fmtBrl(ptaxUsd.bid);
    usdChange  = fmtPct(pct);
    usdPositive = pct >= 0;
  }

  // ── EUR ───────────────────────────────────────────────────────────────────
  let eurValue = "—";
  let eurChange = "0,00%";
  let eurPositive = true;

  const awEur = awesomeFx?.EURBRL;
  if (awEur?.bid) {
    const bid = parseFloat(awEur.bid);
    const pct = parseFloat(awEur.pctChange ?? "0");
    eurValue   = fmtBrl(bid);
    eurChange  = fmtPct(pct);
    eurPositive = pct >= 0;
  } else if (ptaxEur) {
    const pct = ptaxEur.prev ? ((ptaxEur.bid - ptaxEur.prev) / ptaxEur.prev) * 100 : 0;
    eurValue   = fmtBrl(ptaxEur.bid);
    eurChange  = fmtPct(pct);
    eurPositive = pct >= 0;
  }

  // ── OURO B3/BM&F ─────────────────────────────────────────────────────────
  let goldValue = "—";
  if (goldData?.[0]) {
    const grama = parseFloat(goldData[0].valor);
    if (!isNaN(grama) && grama > 0) {
      goldValue = fmtBrl(grama);
    }
  }

  return NextResponse.json({
    selic:     { value: selicValue, date: selicDate },
    cdi:       { value: cdiValue,   date: cdiDate   },
    usd:       { value: usdValue,   change: usdChange,  positive: usdPositive  },
    eur:       { value: eurValue,   change: eurChange,  positive: eurPositive  },
    gold:      { value: goldValue,  unit: "R$/g"        },
    updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  } satisfies MarketData);
}
