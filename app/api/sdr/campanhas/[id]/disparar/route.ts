import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { Resend } from "resend";

export const maxDuration = 300;

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Busca campanha
  const { data: campanha } = await svc().from("sdr_campanhas").select("*").eq("id", id).single();
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });
  if (campanha.status === "enviada") return NextResponse.json({ error: "Campanha já enviada" }, { status: 400 });

  // Marca como enviando
  await svc().from("sdr_campanhas").update({ status: "enviando" }).eq("id", id);

  // Busca contatos pendentes (excluindo opt-outs)
  const { data: optouts } = await svc().from("sdr_optouts").select("email");
  const optoutSet = new Set((optouts ?? []).map((o: { email: string }) => o.email.toLowerCase()));

  const { data: contatos } = await svc()
    .from("sdr_campanha_contatos")
    .select("*")
    .eq("campanha_id", id)
    .eq("status", "pendente");

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const FROM = process.env.EMAIL_FROM ?? "V3 Partners <onboarding@resend.dev>";

  let enviados = 0;
  let erros = 0;

  for (const contato of contatos ?? []) {
    // Pula opt-outs
    if (optoutSet.has(contato.email.toLowerCase())) {
      await svc().from("sdr_campanha_contatos").update({ status: "optout" }).eq("id", contato.id);
      continue;
    }

    // Injeta pixel de tracking e link de opt-out no HTML
    const trackPixel = `<img src="${APP_URL}/api/sdr/track/${contato.track_token}" width="1" height="1" style="display:none" alt="" />`;
    const optoutLink = `${APP_URL}/api/sdr/optout?token=${contato.track_token}`;
    const optoutFooter = `
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #1B3050;text-align:center;">
        <p style="font-size:11px;color:#7A96AF;margin:0;">
          Você está recebendo este e-mail por ter demonstrado interesse na V3 Partners.<br>
          Para não receber mais e-mails, <a href="${optoutLink}" style="color:#C9A84C;">clique aqui para descadastrar</a>.
        </p>
      </div>`;

    const htmlFinal = campanha.template_html
      .replace(/\{\{nome\}\}/g, contato.nome ?? "")
      .replace(/\{\{email\}\}/g, contato.email)
      .replace("</body>", `${trackPixel}${optoutFooter}</body>`);

    try {
      await resend.emails.send({
        from: FROM,
        to: contato.email,
        subject: campanha.assunto,
        html: htmlFinal,
      });

      await svc().from("sdr_campanha_contatos").update({
        status: "enviado",
        enviado_at: new Date().toISOString(),
      }).eq("id", contato.id);

      enviados++;
    } catch (e) {
      await svc().from("sdr_campanha_contatos").update({
        status: "erro",
        erro: e instanceof Error ? e.message : "Erro ao enviar",
      }).eq("id", contato.id);
      erros++;
    }

    // Pequena pausa para respeitar rate limit do Resend (10 req/s)
    await new Promise(r => setTimeout(r, 120));
  }

  // Atualiza campanha como enviada
  await svc().from("sdr_campanhas").update({
    status: "enviada",
    total_enviados: enviados,
    enviada_at: new Date().toISOString(),
  }).eq("id", id);

  return NextResponse.json({ ok: true, enviados, erros });
}
