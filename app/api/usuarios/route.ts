import { NextResponse } from "next/server";

const IS_DEMO = false;

export async function GET() {
  if (IS_DEMO) {
    return NextResponse.json([]);
  }

  // Verifica autenticação e role ADMIN antes de expor todos os perfis
  const { createClient, createServiceClient } = await import("@/lib/supabase/server");
  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = await createServiceClient();
  const { data: caller } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "ADMIN") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const { data, error } = await svc
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar usuários" }, { status: 500 });
  }

  // Busca quem assinou contrato de parceria
  const { data: contracts } = await svc
    .from("partner_contracts")
    .select("user_id");

  const signedIds = new Set((contracts ?? []).map((c: { user_id: string }) => c.user_id));

  const usersWithContract = (data ?? []).map((u: Record<string, unknown>) => ({
    ...u,
    contract_signed: signedIds.has(u.id as string),
  }));

  return NextResponse.json(usersWithContract);
}

export async function POST(request: Request) {
  const { email, password, full_name, role, phone, document_cpf } = await request.json();

  if (IS_DEMO) {
    const fakeUser = {
      id: `demo-${Date.now()}`,
      email,
      full_name,
      role,
      phone: phone || null,
      document_cpf: document_cpf || null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    return NextResponse.json({ user: fakeUser }, { status: 201 });
  }

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const { data: newProfile, error: profileError } = await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ role, phone, full_name, document_cpf: document_cpf || null } as any)
    .eq("id", authData.user.id)
    .select()
    .single();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Onboarding automático para novos partners
  let emailStatus: { ok: boolean; erro?: string } = { ok: false, erro: "não é partner" };

  if (["PARTNER", "PARTNER_PRO"].includes(role)) {
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://v3-partner.vercel.app";
    const resendKey = process.env.RESEND_API_KEY;
    const planoLabel = role === "PARTNER_PRO" ? "V3 Partner PRO" : "V3 Partner";
    const comissao   = role === "PARTNER_PRO" ? "50%" : "30%";
    const nome       = full_name ?? "Parceiro";

    // Notificações internas (fire-and-forget)
    supabase.from("notifications").insert({
      user_id: authData.user.id,
      title: "Bem-vindo à V3 Partners!",
      message: `Olá ${nome}! Seu acesso foi criado. Assine o contrato de parceria para começar.`,
      type: "ONBOARDING",
      action_url: "/contrato-parceria",
      read: false,
    }).then(
      () => {},
      (err: unknown) => console.error("[usuarios] notif onboarding:", err)
    );

    supabase.from("profiles").select("id").eq("role", "ADMIN").eq("is_active", true)
      .then(({ data: admins }) => {
        if (admins && admins.length > 0) {
          supabase.from("notifications").insert(
            admins.map((a: { id: string }) => ({
              user_id: a.id,
              title: "Novo Partner cadastrado",
              message: `${nome} foi cadastrado como ${planoLabel}. Email: ${email}`,
              type: "NEW_PARTNER",
              action_url: "/usuarios",
              read: false,
            }))
          ).then(
            () => {},
            (err: unknown) => console.error("[usuarios] notif admin:", err)
          );
        }
      }, (err: unknown) => console.error("[usuarios] fetch admins:", err));

    // E-mail de boas-vindas — mesmo padrão do reenviar-email que já funciona
    if (!resendKey) {
      emailStatus = { ok: false, erro: "RESEND_API_KEY não configurada" };
    } else {
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
      <p style="font-size:11px;font-weight:700;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 12px;">Bem-vindo(a)!</p>
      <h1 style="font-size:22px;font-weight:700;color:#F0ECE4;margin:0 0 8px;">Olá, ${nome}!</h1>
      <p style="font-size:14px;color:#7A8FA8;margin:0 0 28px;line-height:1.6;">
        Sua conta <strong style="color:#C9A84C;">${planoLabel}</strong> foi criada com sucesso.
        Com ela você acessa operações com até <strong style="color:#C9A84C;">${comissao}</strong> de comissionamento.
      </p>
      <div style="background:#0A1628;border:1px solid #243A66;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="font-size:10px;font-weight:700;letter-spacing:2px;color:#7A8FA8;text-transform:uppercase;margin:0 0 16px;">Seus dados de acesso</p>
        <div style="margin-bottom:12px;">
          <p style="font-size:11px;color:#7A8FA8;margin:0 0 4px;">E-mail</p>
          <p style="font-size:15px;color:#F0ECE4;font-weight:600;margin:0;">${email}</p>
        </div>
        <div>
          <p style="font-size:11px;color:#7A8FA8;margin:0 0 4px;">Senha temporária</p>
          <p style="font-size:20px;color:#C9A84C;font-weight:700;font-family:monospace;letter-spacing:4px;margin:0;">${password}</p>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:20px;">
        <a href="${APP_URL}/login"
           style="display:inline-block;background:#C9A84C;color:#09081A;font-size:14px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">
          Acessar Plataforma →
        </a>
      </div>
      <div style="background:#C9A84C10;border:1px solid #C9A84C35;border-radius:8px;padding:14px;margin-bottom:16px;">
        <p style="font-size:13px;color:#C9A84C;margin:0;line-height:1.5;">
          <strong>Próximo passo:</strong> Assine o contrato de parceria para liberar todas as funcionalidades.
        </p>
      </div>
      <div style="text-align:center;">
        <a href="${APP_URL}/contrato-parceria"
           style="display:inline-block;border:1px solid #C9A84C;color:#C9A84C;font-size:13px;font-weight:600;padding:10px 28px;border-radius:10px;text-decoration:none;">
          Assinar Contrato de Parceria
        </a>
      </div>
    </div>
    <p style="font-size:11px;color:#3A5070;text-align:center;margin:0;">
      © 2026 V3 Partners · E-mail automático, não responda.
    </p>
  </div>
</body>
</html>`;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>",
          to: [email],
          subject: `Seus dados de acesso — V3 Partners`,
          html,
        }),
      });

      const resendBody = await resendRes.json().catch(() => ({}));
      emailStatus = resendRes.ok
        ? { ok: true }
        : { ok: false, erro: resendBody?.message ?? resendBody?.name ?? `HTTP ${resendRes.status}` };
    }
  }

  return NextResponse.json({ user: newProfile, emailStatus }, { status: 201 });
}
