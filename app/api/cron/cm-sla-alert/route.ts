import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const SLA_THRESHOLD_HOURS = 48;

// GET /api/cron/cm-sla-alert — cron diário (n8n W-CM-SLA-Alert): varre
// operation_contracts (vertical capital_markets) pendentes de assinatura há
// >=48h e alerta a Mesa (notificação in-app + e-mail Resend). Mesmo padrão
// de auth Bearer CRON_SECRET dos demais /api/cron/*.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = svc();

  const { data: contracts, error } = await db
    .from("operation_contracts")
    .select("id, contract_title, parties, listing_id, sent_to_signature_at, updated_at, cm_asset_listings(anonymous_id)")
    .eq("vertical", "capital_markets")
    .not("status_signature", "in", "(assinado,cancelado,rascunho)");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const estourados = (contracts ?? [])
    .map((c: any) => {
      const baseTime = c.sent_to_signature_at ?? c.updated_at;
      const hours = Math.floor((now - new Date(baseTime).getTime()) / 3_600_000);
      return { ...c, hours };
    })
    .filter((c: any) => c.hours >= SLA_THRESHOLD_HOURS);

  if (estourados.length === 0) {
    return NextResponse.json({ ok: true, alertas: 0 });
  }

  const { data: mesaUsers } = await db
    .from("profiles")
    .select("id, email")
    .in("role", ["ADMIN", "GESTAO", "MESA_OPERACIONAL"])
    .eq("is_active", true);

  await db.from("notifications").insert(
    (mesaUsers ?? []).map((u: { id: string }) => ({
      user_id: u.id,
      title: `⚠️ ${estourados.length} assinatura(s) da Bolsa de Capitais com SLA estourado`,
      message: estourados
        .map((c: any) => `${c.cm_asset_listings?.anonymous_id ?? c.contract_title} (${c.hours}h)`)
        .join("; "),
      type: "cm_sla_estourado",
      action_url: "/bolsa/mesa",
      read: false,
    }))
  );

  if (process.env.RESEND_API_KEY) {
    const rows = estourados
      .map((c: any) => {
        const parties = (c.parties as Array<{ role: string; name: string | null }> | null) ?? [];
        const signatario = parties.find((p) => p.role === "mandatario") ?? parties[0];
        return `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#F5F1E8">${c.cm_asset_listings?.anonymous_id ?? "N/D"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#9BAFC5">${c.contract_title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#9BAFC5">${signatario?.name ?? "N/D"}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #243A66;color:#ef4444;font-weight:700">${c.hours}h</td>
        </tr>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" /></head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#09081A;color:#F5F1E8;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A;padding:40px 0;">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#13223A;border:1px solid #243A66;border-radius:12px;overflow:hidden;">
<tr><td style="padding:12px 32px;background:#162744;text-align:center;">
<img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" height="32" />
</td></tr>
<tr><td style="background:#162744;padding:24px 32px;border-bottom:1px solid #243A66;">
<p style="margin:0;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#C9A84C;">Bolsa de Capitais, Painel de SLA</p>
<h1 style="margin:8px 0 0;font-size:20px;font-weight:700;color:#F5F1E8;">${estourados.length} Assinatura(s) com SLA Estourado (48h)</h1>
</td></tr>
<tr><td style="padding:32px;">
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:12px;">
<thead><tr style="color:#E8C97A;text-transform:uppercase;font-size:10px;">
<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Ativo</th>
<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Documento</th>
<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">Signatário</th>
<th style="text-align:left;padding:8px 12px;border-bottom:2px solid #C9A84C;">SLA</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="margin:20px 0 0;font-size:12px;color:#9BAFC5;">Acesse a Mesa de Capitais para reenviar a notificação de assinatura de cada pendência.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

    const gate = auditHtml(html);
    if (gate.blocking.length > 0) {
      console.error("[cm-sla-alert] Brand Guardian bloqueou:", gate.blocking);
    } else {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "V3 Partners Bolsa de Ativos <noreply@v3partners.com.br>",
          to: "joao.lemos@v3partners.com.br",
          subject: auditText(`Bolsa de Capitais: ${estourados.length} SLA de assinatura estourado`).corrected,
          html: gate.corrected,
        });
      } catch (err) {
        console.error("[cm-sla-alert] falha ao enviar e-mail:", err);
      }
    }
  }

  return NextResponse.json({ ok: true, alertas: estourados.length });
}
