import { NextResponse } from "next/server";

export interface MarketData {
  selic: { value: string; date: string };
  cdi: { value: string; date: string };
  usd: { value: string; change: string; positive: boolean };
  eur: { value: string; change: string; positive: boolean };
  updatedAt: string;
}

async function fetchWithTimeout(url: string, ms = 4000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 300 } });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

export async function GET() {
  try {
    // Fetch all in parallel
    const [selicRes, cdiRes, fxRes] = await Promise.allSettled([
      // BCB Série 432 = Meta SELIC definida pelo COPOM (% a.a.)
      fetchWithTimeout(
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json"
      ),
      // BCB Série 4389 = CDI acumulado no mês anualizado (% a.a.)
      fetchWithTimeout(
        "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados/ultimos/1?formato=json"
      ),
      // AwesomeAPI cambio USD e EUR
      fetchWithTimeout(
        "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL"
      ),
    ]);

    // SELIC
    let selicValue = "—";
    let selicDate = "";
    if (selicRes.status === "fulfilled" && selicRes.value.ok) {
      const data = await selicRes.value.json();
      if (data[0]) {
        selicValue = parseFloat(data[0].valor).toFixed(2).replace(".", ",") + "%";
        selicDate = data[0].data;
      }
    }

    // CDI
    let cdiValue = "—";
    let cdiDate = "";
    if (cdiRes.status === "fulfilled" && cdiRes.value.ok) {
      const data = await cdiRes.value.json();
      if (data[0]) {
        cdiValue = parseFloat(data[0].valor).toFixed(2).replace(".", ",") + "%";
        cdiDate = data[0].data;
      }
    }

    // FX
    let usdValue = "—";
    let usdChange = "0,00";
    let usdPositive = true;
    let eurValue = "—";
    let eurChange = "0,00";
    let eurPositive = true;

    if (fxRes.status === "fulfilled" && fxRes.value.ok) {
      const fx = await fxRes.value.json();
      if (fx.USDBRL) {
        const bid = parseFloat(fx.USDBRL.bid);
        const pctChange = parseFloat(fx.USDBRL.pctChange);
        usdValue = bid.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        usdChange = Math.abs(pctChange).toFixed(2).replace(".", ",") + "%";
        usdPositive = pctChange >= 0;
      }
      if (fx.EURBRL) {
        const bid = parseFloat(fx.EURBRL.bid);
        const pctChange = parseFloat(fx.EURBRL.pctChange);
        eurValue = bid.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        eurChange = Math.abs(pctChange).toFixed(2).replace(".", ",") + "%";
        eurPositive = pctChange >= 0;
      }
    }

    const data: MarketData = {
      selic: { value: selicValue, date: selicDate },
      cdi: { value: cdiValue, date: cdiDate },
      usd: { value: usdValue, change: usdChange, positive: usdPositive },
      eur: { value: eurValue, change: eurChange, positive: eurPositive },
      updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    return NextResponse.json(data);
  } catch {
    // Fallback com dados indicativos
    return NextResponse.json({
      selic: { value: "—", date: "" },
      cdi: { value: "—", date: "" },
      usd: { value: "—", change: "0,00%", positive: true },
      eur: { value: "—", change: "0,00%", positive: true },
      updatedAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    } as MarketData);
  }
}
