import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/login", "/auth/callback", "/auth/update-password", "/unauthorized", "/api/demo-login", "/api/auth/login", "/c/", "/api/captacao/", "/mf/", "/api/ma-captacao/", "/api/migrate-ma-captacao", "/assinar/", "/api/contratos/", "/api/cpf-validate", "/cadastro-partner", "/api/cadastro-partner", "/api/setup/check", "/status-cadastro", "/api/cadastro-partner/status", "/p/", "/vdr/", "/api/investor/", "/api/ma/preview-criativo", "/api/ma/cim-pdf", "/api/ma/meetings/ingest", "/api/sdr/webhook", "/upload/", "/api/public/upload/", "/api/ma/upload-notify"];

const IS_DEMO = false;

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Rotas VDR — captura parâmetros de rastreamento de grupo antes de liberar
  if (pathname.startsWith("/vdr/") || pathname.startsWith("/api/investor/")) {
    const response = NextResponse.next();
    response.headers.set("x-vdr-group", searchParams.get("grp") ?? "direct");
    response.headers.set("x-vdr-side",  searchParams.get("side") ?? "buyer");
    return response;
  }

  // Rotas públicas — sem verificação de sessão
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Demo mode
  if (IS_DEMO) {
    const demoSession = request.cookies.get("v3_demo_session");
    if (!demoSession) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Produção: renova cookies de sessão e verifica autenticação
  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const redirect = NextResponse.redirect(new URL("/login", request.url));
      supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
        redirect.cookies.set(name, value);
      });
      return redirect;
    }

    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return supabaseResponse;
  } catch {
    // QW-2: fail-closed — nunca liberar rotas protegidas quando Supabase indisponível
    return NextResponse.redirect(new URL("/login?error=auth_unavailable", request.url));
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
