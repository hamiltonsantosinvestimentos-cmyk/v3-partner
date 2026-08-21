import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const svc = serviceClient();

  const { data: order, error: orderErr } = await svc
    .from("partner_service_orders")
    .select("id, client_name, client_email, report_public_token")
    .eq("id", id)
    .single();
  if (orderErr || !order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (!order.report_public_token) {
    return NextResponse.json({ error: "Relatório ainda não foi gerado para este pedido" }, { status: 409 });
  }

  const reportUrl = `https://app.v3partners.com.br/relatorio-credito/${order.report_public_token}`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "V3 Partners <inteligencia@v3partners.com.br>",
        to: [order.client_email],
        subject: "Seu relatório de Análise de Crédito está pronto",
        html: `
          <div style="background:#09081A;color:#F5F1E8;font-family:sans-serif;padding:40px;border-radius:8px;max-width:560px;margin:0 auto">
            <div style="color:#C9A84C;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:20px">V3 PARTNERS</div>
            <h2 style="font-size:20px;margin-bottom:12px">Relatório disponível</h2>
            <p style="color:#9BAFC5;font-size:13px;line-height:1.7;margin-bottom:24px">
              Olá, <strong style="color:#F5F1E8">${order.client_name}</strong>.<br>
              A compilação de dados da sua Análise de Crédito está pronta. Clique no botão abaixo para acessar.
            </p>
            <a href="${reportUrl}"
               style="display:inline-block;background:#C9A84C;color:#09081A;font-weight:700;font-size:13px;padding:12px 28px;border-radius:6px;text-decoration:none">
              Ver meu relatório
            </a>
            <p style="color:#9BAFC5;font-size:11px;margin-top:24px;line-height:1.6">
              O link fica disponível por 30 dias a partir da emissão.<br>
              Dúvidas: <a href="mailto:financeiro@v3partners.com.br" style="color:#C9A84C">financeiro@v3partners.com.br</a>
            </p>
          </div>
        `,
      }),
    });
  } catch (e) {
    return NextResponse.json({ error: `Falha ao enviar email: ${(e as Error).message}` }, { status: 500 });
  }

  const { error: updateErr } = await svc
    .from("partner_service_orders")
    .update({ report_delivered_at: new Date().toISOString() })
    .eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ success: true, report_url: reportUrl });
}
