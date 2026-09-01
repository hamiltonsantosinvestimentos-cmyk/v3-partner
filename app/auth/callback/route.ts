import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Cobre login via magic link / recuperação de senha (o outro ponto de
      // entrada, POST /api/auth/login, cobre login com email+senha).
      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
        await logAudit({
          userId: data.user.id,
          userName: profile?.full_name ?? data.user.email ?? null,
          action: "LOGIN",
          entity: "profiles",
          entityId: data.user.id,
          ipAddress: getClientIp(request),
          userAgent: request.headers.get("user-agent"),
        });
      }
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
