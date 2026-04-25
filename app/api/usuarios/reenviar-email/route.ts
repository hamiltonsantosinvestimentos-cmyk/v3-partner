import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://v3-partner.vercel.app";

async function enviarBoasVindas(email: string, nome: string, role: string) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, motivo: "RESEND_API_KEY não configurada" };

  const planoLabel = role === "PARTNER_PRO" ? "V3 Partner PRO" : "V3 Partner";
  const comissao   = role === "PARTNER_PRO" ? "50%" : "30%";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09081A;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <p style="font-size:22px;font-weight:800;letter-spacing:4px;color:#C9A84C;margin:0;">V3 PARTNERS</p>
      <p style="font-size:11px;color:#7A8FA8;margin:4px 0 0;letter-spacing:1px;">PLATAFORMA FINANCEIRA</p>
    </div>
    <div style="background:#111F35;border:1px solid #243A66;border-radius:16px;padding:32px;margin-bottom:16px;">
      <p style="font-size:11px;font-weight:700;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 12px;">Acesso à Plataforma</p>
      <h1 style="font-size:22px;font-weight:700;color:#F0ECE4;margin:0 0 8px;">Olá, ${nome}!</h1>
      <p style="font-size:14px;color:#7A8FA8;margin:0 0 28px;line-height:1.6;">
        Seus dados de acesso à plataforma <strong style="color:#C9A84C;">${planoLabel}</strong> foram redefinidos.
        Com sua conta você acessa operações com até <strong style="color:#C9A84C;">${comissao}</strong> de comissionamento.
      </p>
      <div style="background:#0A1628;border:1px solid #243A66;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="font-size:10px;font-weight:700;letter-spacing:2px;color:#7A8FA8;text-transform:uppercase;margin:0 0 16px;">Seus dados de acesso</p>
        <div style="margin-bottom:12px;">
          <p style="font-size:11px;color:#7A8FA8;margin:0 0 4px;">E-mail</p>
          <p style="font-size:15px;color:#F0ECE4;font-weight:600;margin:0;">${email}</p>
        </div>
        <div>
          <p style="font-size:11px;color:#7A8FA8;margin:0 0 4px;">Senha temporária</p>
          <p style="font-size:20px;color:#C9A84C;font-weight:700;font-family:monospace;letter-spacing:4px;margin:0;">12345678</p>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:20px;">
        <a href="${SITE_URL}/login"
           style="display:inline-block;background:#C9A84C;color:#09081A;font-size:14px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">
          Acessar Plataforma →
        </a>
      </div>
      <div style="background:#C9A84C10;border:1px solid #C9A84C35;border-radius:8px;padding:14px;">
        <p style="font-size:13px;color:#C9A84C;margin:0;line-height:1.5;">
          <strong>Importante:</strong> No primeiro acesso você será solicitado a definir sua senha pessoal.
        </p>
      </div>
    </div>
    <p style="font-size:11px;color:#3A5070;text-align:center;margin:0;">
      © 2026 V3 Partners · <a href="${SITE_URL}" style="color:#C9A84C;text-decoration:none;">v3partners.com.br</a>
    </p>
  </div>
</body>
</html>`;

  const FROM = process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: "Seus dados de acesso — V3 Partners",
      html,
    }),
  });

  const resBody = await res.json().catch(() => ({}));
  return res.ok
    ? { ok: true }
    : { ok: false, motivo: resBody?.message ?? resBody?.name ?? `HTTP ${res.status}` };
}

export async function POST(req: NextRequest) {
  // Verifica que é ADMIN
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: callerProfile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { userId } = await req.json() as { userId: string };
  if (!userId) return NextResponse.json({ error: "userId obrigatório" }, { status: 400 });

  const svc = serviceClient();

  // Busca e-mail direto do auth.users (profiles.email pode estar null)
  const { data: authData, error: authErr } = await svc.auth.admin.getUserById(userId);
  if (authErr || !authData?.user) return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404 });

  const email = authData.user.email;
  if (!email) return NextResponse.json({ error: "Usuário sem e-mail cadastrado" }, { status: 400 });

  // Busca nome e role do perfil
  const { data: profile } = await svc
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .single();

  // Redefine senha para 12345678 via REST API diretamente (mais confiável que o SDK)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const resetRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": serviceKey,
    },
    body: JSON.stringify({ password: "12345678" }),
  });

  if (!resetRes.ok) {
    const resetErr = await resetRes.json().catch(() => ({}));
    console.error("[reenviar-email] Erro REST ao redefinir senha:", resetErr);
    return NextResponse.json(
      { error: `Erro ao redefinir senha: ${resetErr?.message ?? `HTTP ${resetRes.status}`}` },
      { status: 500 }
    );
  }

  // Ativa flag de troca obrigatória
  await svc.auth.admin.updateUserById(userId, {
    app_metadata: { must_change_password: true },
  });

  // Envia e-mail de boas-vindas
  const emailResult = await enviarBoasVindas(email, profile?.full_name ?? "Parceiro", profile?.role ?? "PARTNER");

  return NextResponse.json({ ok: true, emailEnviado: email, email: emailResult });
}
