// Manifesto do app instalado conforme o host: marca do Enterprise no domínio dele, V3 nos demais.
// BRIEF docs/briefs/2026-11-26_app-instalado-marca-enterprise.md
import { NextRequest, NextResponse } from "next/server";
import { manifestoDaMarca, manifestoV3 } from "@/lib/manifest-marca";
import { ehMarca, hostDoPedido, marcaDoAppPorHost } from "@/lib/manifest-marca-server";

export async function GET(req: NextRequest) {
  // Forma canônica: qualquer query vai para o manifesto puro, sem consultar o banco.
  if (req.nextUrl.search) {
    return NextResponse.redirect(new URL("/api/public/manifest", req.url), 308);
  }
  const m = await marcaDoAppPorHost(hostDoPedido(req.headers));
  const corpo = ehMarca(m) ? manifestoDaMarca(m) : manifestoV3();
  // Falha de consulta: responde a V3 sem cache, para não prender a V3 no domínio da marca.
  const cacheCtl = m && "erro" in m ? "no-store" : "public, max-age=300, s-maxage=300";
  return new NextResponse(JSON.stringify(corpo), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": cacheCtl },
  });
}
