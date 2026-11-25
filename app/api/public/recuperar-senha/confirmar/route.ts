// Confirmação do link de recuperação (POST do botão "Continuar" em /auth/confirm): troca o
// token_hash por sessão e segue para a nova senha. O GET da página não usa o token (SafeLinks).
// BRIEF docs/briefs/2026-11-25_recuperar-senha-marca-enterprise.md
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit, getClientIp } from "@/lib/audit";

function destino(req: NextRequest, caminho: string): URL {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  const proto = process.env.NODE_ENV === "development" ? "http" : "https";
  return new URL(caminho, `${proto}://${host}`);
}

export async function POST(req: NextRequest) {
  const erro = () => NextResponse.redirect(destino(req, "/esqueci-senha?erro=link"), 303);

  // CSRF: só aceita o formulário do próprio domínio.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = req.headers.get("origin");
  try {
    if (!origin || !host || new URL(origin).host.toLowerCase() !== host.toLowerCase()) return erro();
  } catch {
    return erro();
  }

  let tokenHash = "";
  try {
    const form = await req.formData();
    tokenHash = String(form.get("token_hash") ?? "").trim();
  } catch { /* sem formulário */ }
  if (!tokenHash || tokenHash.length > 512) return erro();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
  if (error || !data.user) return erro();

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle();
  await logAudit({
    userId: data.user.id,
    userName: profile?.full_name ?? data.user.email ?? null,
    action: "LOGIN",
    entity: "profiles",
    entityId: data.user.id,
    ipAddress: getClientIp(req),
  });
  return NextResponse.redirect(destino(req, "/auth/update-password"), 303);
}
