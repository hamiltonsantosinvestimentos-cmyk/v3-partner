import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Rotas públicas que NÃO precisam de autenticação
const PUBLIC_API_ROUTES = [
  "/api/captacao/",
  "/api/market-data",
  "/api/pipefy/webhook",
  "/api/ma/clicksign-webhook",
  "/api/ma/clicksign-status",
];

const PUBLIC_PAGE_ROUTES = [
  "/login",
  "/auth/callback",
  "/unauthorized",
  "/captacao/",
  "/_next/",
  "/favicon",
  "/logo",
  "/public/",
];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PAGE_ROUTES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_API_ROUTES.some((p) => pathname.startsWith(p))
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permite rotas públicas sem autenticação
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Só protege rotas de API e plataforma
  if (!pathname.startsWith("/api/") && !pathname.startsWith("/(platform)") && pathname !== "/") {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return NextResponse.next();

  const response = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  // API routes: retorna 401 se não autenticado
  if (pathname.startsWith("/api/") && !user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  return response;
}

export const config = {
  matcher: [
    "/api/((?!captacao/|market-data|pipefy/webhook|ma/clicksign).*)$",
    "/(platform)/:path*",
  ],
};
