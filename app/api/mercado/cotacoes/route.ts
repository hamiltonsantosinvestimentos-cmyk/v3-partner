import { NextRequest, NextResponse } from "next/server";
import { cotacaoAvulsa, cotacoesMercado } from "@/lib/mercado/fontes";
import { normalizarSimbolo } from "@/lib/mercado/catalogo";

export const dynamic = "force-dynamic";

// GET /api/mercado/cotacoes            → todos os ativos da aba Mercado
// GET /api/mercado/cotacoes?ativo=X    → um ticker avulso (busca)
export async function GET(req: NextRequest) {
  const ativo = req.nextUrl.searchParams.get("ativo");
  if (ativo) {
    const simbolo = normalizarSimbolo(ativo.slice(0, 20));
    const c = await cotacaoAvulsa(simbolo);
    if (!c) return NextResponse.json({ error: `Não encontramos cotação para ${ativo.toUpperCase()}.` }, { status: 404 });
    return NextResponse.json(c);
  }
  const dados = await cotacoesMercado();
  if (!dados) return NextResponse.json({ error: "Cotações indisponíveis no momento." }, { status: 503 });
  return NextResponse.json(dados);
}
