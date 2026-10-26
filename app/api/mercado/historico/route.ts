import { NextRequest, NextResponse } from "next/server";
import { historico } from "@/lib/mercado/fontes";
import { normalizarSimbolo, SERIES_BCB, type PeriodoHistorico } from "@/lib/mercado/catalogo";

export const dynamic = "force-dynamic";

const PERIODOS: PeriodoHistorico[] = ["1mo", "3mo", "6mo", "ytd", "1y", "5y"];

// GET /api/mercado/historico?simbolos=^BVSP,USDBRL=X,CDI&periodo=1y
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const periodo = (PERIODOS.includes(p.get("periodo") as PeriodoHistorico) ? p.get("periodo") : "1y") as PeriodoHistorico;
  const simbolos = (p.get("simbolos") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 6)
    .map((s) => (s in SERIES_BCB ? s : normalizarSimbolo(s)));
  if (!simbolos.length) return NextResponse.json({ error: "Informe ao menos um ativo." }, { status: 400 });
  const series = await Promise.all(simbolos.map((s) => historico(s, periodo)));
  return NextResponse.json({ periodo, series });
}
