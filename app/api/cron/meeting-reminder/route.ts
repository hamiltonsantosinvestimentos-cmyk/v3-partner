import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { buildTecEmail3 } from "@/components/propostas/tec-email-templates";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function fmtBRL(v?: number | null) {
  if (!v) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const now = new Date();
  const in60min = new Date(now.getTime() + 60 * 60 * 1000);

  const { data: proposals } = await svc()
    .from("commercial_proposals")
    .select("*")
    .eq("service_type", "mandato_tec")
    .eq("status", "signed")
    .not("meeting_at", "is", null)
    .not("meeting_link", "is", null)
    .gte("meeting_at", now.toISOString())
    .lte("meeting_at", in60min.toISOString());

  if (!proposals?.length) return NextResponse.json({ ok: true, sent: 0 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ ok: true, sent: 0, reason: "no_resend_key" });

  let sent = 0;
  for (const p of proposals) {
    const meta = (p.metadata ?? {}) as Record<string, unknown>;
    if (meta.reminder_sent) continue;

    const feeValue = p.value && p.tec_percentage ? p.value * p.tec_percentage / 100 : null;

    try {
      const emailHtml = buildTecEmail3({
        fund_name: p.fund_name ?? "",
        deal_code: p.deal_code_ref ?? p.code,
        tec_percentage: p.tec_percentage ?? 0,
        fee_value: fmtBRL(feeValue),
        deal_value: fmtBRL(p.value),
        recipient_name: p.recipient_name,
        recipient_email: p.recipient_email,
        meeting_link: p.meeting_link ?? undefined,
        meeting_date_formatted: fmtDate(new Date(p.meeting_at)),
      });

      const recipients = [p.recipient_email];
      if (p.partner_email) recipients.push(p.partner_email);

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "inteligencia@v3partners.com.br",
          to: recipients,
          subject: `Lembrete — Reunião em 30 minutos · ${p.fund_name ?? ""}`,
          html: emailHtml,
        }),
      });

      await svc().from("commercial_proposals").update({
        metadata: { ...meta, reminder_sent: true, reminder_sent_at: new Date().toISOString() },
      }).eq("id", p.id);

      sent++;
    } catch (e) {
      void svc().from("execution_errors").insert({ workflow: "cron/meeting-reminder", error_message: String(e), severity: "medium" });
    }
  }

  return NextResponse.json({ ok: true, sent });
}
