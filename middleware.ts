import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_ROUTES = ["/login", "/auth/callback", "/auth/update-password", "/unauthorized", "/api/demo-login", "/api/auth/login", "/c/", "/api/captacao/", "/mf/", "/api/ma-captacao/", "/api/migrate-ma-captacao", "/assinar/", "/api/contratos/", "/api/cpf-validate"];

const IS_DEMO = false;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Demo mode — cookie only
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

  // Production: refresh session cookies so they stay valid
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

  // Verify session — redirects unauthenticated users to login
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    // Forward any refreshed cookies to the redirect response
    supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
      redirect.cookies.set(name, value);
    });
    return redirect;
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
