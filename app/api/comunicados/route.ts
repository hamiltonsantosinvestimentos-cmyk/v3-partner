import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const svc = () => sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function buildEmailHtml(assunto: string, mensagem: string, nomePartner: string) {
  const mensagemHtml = mensagem
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${assunto}</title>
</head>
<body style="margin:0;padding:0;background:#09081A;font-family:'DM Sans','Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#09081A 0%,#111F35 100%);border-radius:16px 16px 0 0;padding:32px 40px;border-bottom:1px solid #C9A84C33;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:22px;font-weight:800;color:#C9A84C;letter-spacing:-0.5px;">V3 PARTNERS</span>
                    <br/>
                    <span style="font-size:11px;color:#7A8FA8;letter-spacing:0.15em;text-transform:uppercase;font-weight:600;">Soluções Financeiras Estruturadas</span>
                  </td>
                  <td align="right">
                    <span style="font-size:10px;color:#C9A84C;background:#C9A84C15;border:1px solid #C9A84C33;padding:4px 10px;border-radius:20px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">Comunicado Oficial</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#111F35;padding:40px;">

              <!-- Saudação -->
              <p style="margin:0 0 8px 0;font-size:13px;color:#7A8FA8;font-weight:500;">Olá, <strong style="color:#C9A84C;">${nomePartner}</strong></p>

              <!-- Assunto -->
              <h1 style="margin:0 0 24px 0;font-size:24px;font-weight:700;color:#F0ECE4;line-height:1.3;">${assunto}</h1>

              <!-- Divisor dourado -->
              <div style="width:40px;height:2px;background:#C9A84C;margin-bottom:28px;border-radius:2px;"></div>

              <!-- Mensagem -->
              <div style="font-size:14px;color:#7A8FA8;line-height:1.8;background:#09081A;border-left:3px solid #C9A84C;padding:20px 24px;border-radius:0 8px 8px 0;margin-bottom:32px;">
                ${mensagemHtml}
              </div>

              <!-- CTA -->
              <div style="text-align:center;margin-bottom:32px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/dashboard"
                   style="display:inline-block;background:linear-gradient(135deg,#C9A84C,#E8C97A);color:#09081A;font-weight:700;font-size:13px;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.05em;">
                  Acessar Plataforma →
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#09081A;border-radius:0 0 16px 16px;padding:24px 40px;border-top:1px solid #C9A84C22;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:11px;color:#7A8FA8;line-height:1.6;">
                      <strong style="color:#C9A84C;">V3 Partners Soluções Ltda</strong><br/>
                      CNPJ 14.219.287/0001-50 · v3partners.com.br
                    </p>
                  </td>
                  <td align="right">
                    <p style="margin:0;font-size:10px;color:#7A8FA8;">
                      Este é um comunicado oficial da V3 Partners.<br/>
                      Enviado exclusivamente para parceiros ativos.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// POST — envia comunicado para partners
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Apenas ADMIN" }, { status: 403 });

  const body = await req.json();
  const { assunto, mensagem, filtro = "TODOS" } = body as {
    assunto: string;
    mensagem: string;
    filtro: "TODOS" | "PRO" | "BASE" | "TRIAL";
  };

  if (!assunto?.trim() || !mensagem?.trim()) {
    return NextResponse.json({ error: "Assunto e mensagem são obrigatórios" }, { status: 400 });
  }

  // Busca destinatários conforme filtro
  let query = svc()
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("is_active", true)
    .not("email", "is", null);

  if (filtro === "PRO") {
    query = query.eq("role", "PARTNER_PRO");
  } else if (filtro === "BASE") {
    query = query.eq("role", "PARTNER");
  } else if (filtro === "TRIAL") {
    query = query.eq("role", "TRIAL");
  } else {
    query = query.in("role", ["PARTNER", "PARTNER_PRO", "TRIAL"]);
  }

  const { data: partners, error: dbErr } = await query;
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  if (!partners || partners.length === 0) {
    return NextResponse.json({ error: "Nenhum partner encontrado para o filtro selecionado" }, { status: 404 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "RESEND_API_KEY não configurada" }, { status: 500 });

  const from = process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>";

  // Envia em lotes de 10 para não sobrecarregar a API
  let enviados = 0;
  const erros: string[] = [];

  for (const partner of partners) {
    const nome = partner.full_name ?? partner.email?.split("@")[0] ?? "Partner";
    const html = buildEmailHtml(assunto, mensagem, nome);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [partner.email],
        subject: assunto,
        html,
      }),
    });

    if (res.ok) {
      enviados++;
    } else {
      const err = await res.json();
      erros.push(`${partner.email}: ${err?.message ?? "erro desconhecido"}`);
    }
  }

  // Salva histórico no Supabase
  await svc().from("comunicados").insert({
    assunto,
    mensagem,
    filtro,
    total_destinatarios: partners.length,
    total_enviados: enviados,
    enviado_por: user.id,
  });

  return NextResponse.json({
    ok: true,
    total: partners.length,
    enviados,
    erros: erros.length > 0 ? erros : undefined,
  });
}

// GET — histórico de comunicados
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Apenas ADMIN" }, { status: 403 });

  const { data, error } = await svc()
    .from("comunicados")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comunicados: data ?? [] });
}
