import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.v3partners.com.br";

// ─── E-mail de boas-vindas via Resend ─────────────────────────────────────────
async function enviarBoasVindas(email: string, nome: string, plano: string, cartaoRecorrenteLink?: string | null) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return; // sem chave, ignora silenciosamente

  const planoLabel = plano === "ENTERPRISE" ? "V3 Enterprise" : plano === "PARTNER_PRO" ? "V3 Partner PRO" : plano === "STARTER" ? "V3 Starter" : "V3 Partner";
  const comissao   = plano === "ENTERPRISE" ? "negociável" : plano === "PARTNER_PRO" ? "50%" : plano === "STARTER" ? "20%" : "30%";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09081A;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <p style="font-size:22px;font-weight:800;letter-spacing:4px;color:#C9A84C;margin:0;">V3 PARTNERS</p>
      <p style="font-size:11px;color:#7A8FA8;margin:4px 0 0;letter-spacing:1px;">PLATAFORMA FINANCEIRA</p>
    </div>

    <!-- Card principal -->
    <div style="background:#111F35;border:1px solid #243A66;border-radius:16px;padding:32px;margin-bottom:16px;">
      <p style="font-size:11px;font-weight:700;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 12px;">Cadastro Aprovado</p>
      <h1 style="font-size:22px;font-weight:700;color:#F0ECE4;margin:0 0 8px;">Bem-vindo, ${nome}!</h1>
      <p style="font-size:14px;color:#7A8FA8;margin:0 0 28px;line-height:1.6;">
        Seu cadastro como <strong style="color:#C9A84C;">${planoLabel}</strong> foi aprovado.
        Você já pode acessar a plataforma e começar a gerar operações com até <strong style="color:#C9A84C;">${comissao}</strong> de comissionamento.
      </p>

      <!-- Credenciais -->
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

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:20px;">
        <a href="${SITE_URL}/login"
           style="display:inline-block;background:#C9A84C;color:#09081A;font-size:14px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">
          Acessar Plataforma →
        </a>
      </div>

      ${cartaoRecorrenteLink ? `
      <!-- Assinatura recorrente no cartão -->
      <div style="background:#0A1628;border:1px solid #C9A84C55;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="font-size:13px;color:#C9A84C;margin:0 0 8px;font-weight:700;">Finalize sua assinatura recorrente</p>
        <p style="font-size:13px;color:#7A8FA8;margin:0 0 16px;line-height:1.6;">
          Você escolheu pagar a mensalidade com cartão recorrente (fidelidade de 12 meses). Clique no botão abaixo para cadastrar seu cartão e ativar a cobrança automática mensal.
        </p>
        <div style="text-align:center;">
          <a href="${cartaoRecorrenteLink}"
             style="display:inline-block;background:#C9A84C;color:#09081A;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">
            Ativar assinatura recorrente →
          </a>
        </div>
      </div>` : ""}

      <!-- Alerta senha -->
      <div style="background:#C9A84C10;border:1px solid #C9A84C35;border-radius:8px;padding:14px;">
        <p style="font-size:13px;color:#C9A84C;margin:0;line-height:1.5;">
          <strong>Importante:</strong> No primeiro acesso você será solicitado a definir sua senha pessoal. A senha temporária acima é apenas para o primeiro login.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <p style="font-size:11px;color:#3A5070;text-align:center;margin:0;">
      © 2026 V3 Partners · <a href="${SITE_URL}" style="color:#C9A84C;text-decoration:none;">v3partners.com.br</a>
    </p>
  </div>
</body>
</html>`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>",
        to: [email],
        subject: `Bem-vindo à V3 Partners — Cadastro Aprovado!`,
        html,
      }),
    });
  } catch {
    // silencioso — não bloqueia a aprovação
  }
}

export async function POST(req: NextRequest) {
  // Verifica que é ADMIN
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id, acao, observacao, cartao_recorrente_link } = await req.json() as {
    id: string; acao: "APROVAR" | "REPROVAR" | "EM_ANALISE"; observacao?: string; cartao_recorrente_link?: string;
  };

  if (!id || !acao) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const svc = serviceClient();

  // Busca o cadastro
  const { data: reg } = await svc
    .from("partner_registrations")
    .select("*, referred_by_partner_id")
    .eq("id", id)
    .single();

  if (!reg) return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 });

  // Cartão recorrente: exige o link da assinatura InfinitePay (criada manualmente
  // no painel deles) antes de aprovar, já que é enviado no e-mail de boas-vindas.
  const linkCartaoFinal = cartao_recorrente_link ?? reg.cartao_recorrente_link ?? null;
  if (acao === "APROVAR" && reg.plano_recorrencia === "ANUAL_CARTAO" && !linkCartaoFinal) {
    return NextResponse.json({ error: "Informe o link de assinatura recorrente da InfinitePay antes de aprovar." }, { status: 400 });
  }

  const novoStatus = acao === "APROVAR" ? "APROVADO" : acao === "REPROVAR" ? "REPROVADO" : "EM_ANALISE";

  // Se REPROVAR ou EM_ANALISE, só atualiza o status
  if (acao !== "APROVAR") {
    await svc.from("partner_registrations").update({
      status: novoStatus,
      observacao: observacao ?? null,
      revisado_por: user.id,
      revisado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    return NextResponse.json({ ok: true, status: novoStatus });
  }

  // ─── APROVAR: criar usuário no Supabase Auth + profile ───────────────────
  const planoRole = reg.plano === "ENTERPRISE" ? "ENTERPRISE" : reg.plano === "PARTNER_PRO" ? "PARTNER_PRO" : reg.plano === "STARTER" ? "STARTER" : "PARTNER";
  const email     = reg.email;
  const nome      = reg.nome_completo ?? reg.razao_social ?? "Parceiro";

  // Verifica se já existe
  const { data: existing } = await svc.auth.admin.listUsers();
  const jaExiste = existing?.users?.some((u) => u.email === email);

  if (!jaExiste) {
    // Cria o usuário com senha padrão + flag para trocar no primeiro acesso
    const { data: newUser, error: createErr } = await svc.auth.admin.createUser({
      email,
      password: "12345678",
      email_confirm: true,
      user_metadata: { full_name: nome },
      app_metadata: { must_change_password: true },
    });

    if (createErr) {
      return NextResponse.json({ error: `Erro ao criar usuário: ${createErr.message}` }, { status: 500 });
    }

    // Cria o profile na tabela
    if (newUser?.user) {
      await svc.from("profiles").upsert({
        id:         newUser.user.id,
        full_name:  nome,
        role:       planoRole,
        email,
        kyc_status: "APROVADO",
        updated_at: new Date().toISOString(),
        ...(reg.referred_by_partner_id ? { referred_by_partner_id: reg.referred_by_partner_id } : {}),
      }, { onConflict: "id" });
    }

    // Envia e-mail de boas-vindas (async, não bloqueia)
    enviarBoasVindas(email, nome, reg.plano, linkCartaoFinal).catch(() => {});
  }

  // Atualiza o cadastro
  await svc.from("partner_registrations").update({
    status:       "APROVADO",
    observacao:   observacao ?? null,
    revisado_por: user.id,
    revisado_em:  new Date().toISOString(),
    updated_at:   new Date().toISOString(),
    ...(cartao_recorrente_link ? { cartao_recorrente_link } : {}),
  }).eq("id", id);

  return NextResponse.json({ ok: true, status: "APROVADO", email, role: planoRole });
}
