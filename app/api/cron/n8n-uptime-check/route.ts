import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 15;

const N8N_HEALTH_URL = "https://n8n-514n.onrender.com/healthz";

// Monitor externo de uptime do n8n/Render — item 3a do hardening pos W-GUARDIAN.
// Roda no Vercel (infraestrutura separada do Render) porque um monitor hospedado
// no proprio n8n/Render nao detecta o Render cair (W5 Keep-Alive Ping ja existe,
// mas vive dentro do mesmo Render que estaria monitorando).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let healthy = false;
  let detail = "";

  try {
    const resp = await fetch(N8N_HEALTH_URL, { signal: AbortSignal.timeout(10000) });
    healthy = resp.ok;
    detail = `HTTP ${resp.status}`;
  } catch (err) {
    detail = err instanceof Error ? err.message : "Erro desconhecido";
  }

  if (healthy) {
    return NextResponse.json({ ok: true, detail });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "inteligencia@v3partners.com.br",
        to: ["joao.lemos@v3partners.com.br"],
        subject: "[ALERTA UPTIME] n8n/Render indisponível",
        text: `Monitor externo (Vercel) detectou falha ao acessar o n8n em ${N8N_HEALTH_URL}.\n\nDetalhe: ${detail}\n\nIsso afeta TODOS os workflows n8n (W0-W14, crons, W-GUARDIAN, intake de deals) ate o Render voltar. Verificar https://dashboard.render.com`,
      });
    } catch (e) {
      console.error("[n8n-uptime-check] Falha ao enviar alerta:", e);
    }
  }

  return NextResponse.json({ ok: false, detail }, { status: 503 });
}
