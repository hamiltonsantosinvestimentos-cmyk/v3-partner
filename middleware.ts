import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas totalmente públicas — sem verificação de sessão
const PUBLIC_PREFIXES = [
  "/c/",              // formulários de captação dos partners
  "/login",
  "/unauthorized",
  "/auth/",
  "/api/captacao/",   // endpoints públicos de captação
  "/_next/",
  "/favicon",
  "/logo",
  "/manifest",
  "/icon-",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Libera rotas públicas imediatamente, sem tocar na sessão
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Para as demais rotas, apenas atualiza o cookie de sessão do Supabase
  // (não redireciona — o redirecionamento fica a cargo dos layouts)
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresca a sessão (necessário para SSR correta dos layouts)
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
