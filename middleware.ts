import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/auth/callback", "/unauthorized", "/api/demo-login"];

const ROLE_ROUTES: Record<string, string[]> = {
  "/usuarios": ["ADMIN"],
  "/ma": ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO"],
  "/split-fiscal": ["ADMIN", "PARTNER", "PARTNER_PRO", "GESTAO"],
  "/mesa-credito/nivel-3": ["ADMIN", "GESTAO", "PARTNER_PRO"],
  "/mesa-operacional": ["ADMIN", "MESA_OPERACIONAL", "GESTAO"],
  "/financeiro": ["ADMIN", "FINANCEIRO"],
  "/comissoes": ["ADMIN", "PARTNER", "PARTNER_PRO", "FINANCEIRO"],
};

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    const demoSession = request.cookies.get("v3_demo_session");
    if (demoSession && pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // ---- DEMO MODE (no Supabase) ----
  if (IS_DEMO) {
    const demoSession = request.cookies.get("v3_demo_session");
    if (!demoSession) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    try {
      const session = JSON.parse(demoSession.value);
      const role = session.role as string;

      for (const [route, allowedRoles] of Object.entries(ROLE_ROUTES)) {
        if (pathname.startsWith(route) && !allowedRoles.includes(role)) {
          return NextResponse.redirect(new URL("/unauthorized", request.url));
        }
      }

      if (pathname === "/") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    } catch {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // ---- PRODUCTION MODE (Supabase) ----
  const { createServerClient } = await import("@supabase/ssr");

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

  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  const profile = data as { role: string; is_active: boolean } | null;

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  for (const [route, allowedRoles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route) && !allowedRoles.includes(profile.role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
  }

  if (pathname === "/") return NextResponse.redirect(new URL("/dashboard", request.url));

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
