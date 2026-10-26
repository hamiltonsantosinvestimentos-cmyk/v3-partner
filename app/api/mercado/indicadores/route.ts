import { NextResponse } from "next/server";
import { indicadoresMercado } from "@/lib/mercado/fontes";

export const dynamic = "force-dynamic";

// GET /api/mercado/indicadores → Selic, CDI, inflação, Focus (Banco Central)
export async function GET() {
  const dados = await indicadoresMercado();
  if (!dados) return NextResponse.json({ error: "Indicadores indisponíveis no momento." }, { status: 503 });
  return NextResponse.json(dados);
}
