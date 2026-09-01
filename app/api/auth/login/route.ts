import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();

  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const response = NextResponse.json({ success: true });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() { return []; },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options ?? {});
        });
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: "Email ou senha inválidos." }, { status: 401 });
  }

  // Registra o acesso — é o que alimenta "quantos acessos" no histórico de
  // atividade por usuário (tela Usuários). Não bloqueia o login se falhar
  // (logAudit já engole erro internamente).
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

  return response;
}
