import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware V3 Partners
 *
 * Responsabilidades:
 * 1. Rotas /vdr/* — captura parâmetros UTM (grp, side) e injeta como headers
 *    para rastreamento automático de grupo de investidores sem expor lógica no cliente.
 *
 * 2. Rotas /investor/* — mesma lógica de captura de parâmetros.
 *
 * Auth de usuários internos (/platform) é gerida pelo Supabase SSR via
 * createClient() nas próprias rotas — não pelo middleware.
 */

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // ── VDR público: /vdr/[v3_code]/[token] ──────────────────────────────────
  if (pathname.startsWith("/vdr/")) {
    const response = NextResponse.next();

    // Captura parâmetros de rastreamento de grupo
    const grp  = searchParams.get("grp")  ?? "direct";
    const side = searchParams.get("side") ?? "buyer";

    // Injeta como headers para consumo nas API routes sem expor no cliente
    response.headers.set("x-vdr-group", grp);
    response.headers.set("x-vdr-side",  side);

    // Log do path para debug (apenas em dev)
    if (process.env.NODE_ENV === "development") {
      console.log(`[VDR] ${pathname} | grp=${grp} side=${side}`);
    }

    return response;
  }

  // ── Investor portal: /investor/* ─────────────────────────────────────────
  if (pathname.startsWith("/investor/")) {
    const response = NextResponse.next();
    response.headers.set("x-vdr-group", searchParams.get("grp")  ?? "direct");
    response.headers.set("x-vdr-side",  searchParams.get("side") ?? "buyer");
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/vdr/:path*",
    "/investor/:path*",
  ],
};
