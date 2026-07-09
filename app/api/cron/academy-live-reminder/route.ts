import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyAulaAoVivoLembrete } from "@/lib/email";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Roda 1x/dia — lembra por e-mail quem está inscrito em aulas que acontecem
// entre 23h e 25h a partir de agora (janela de 2h pra cobrir o horário do cron)
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = svc();
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data: classes } = await db
    .from("academy_live_classes")
    .select("*")
    .gte("date", windowStart.toISOString())
    .lte("date", windowEnd.toISOString());

  if (!classes?.length) return NextResponse.json({ ok: true, sent: 0 });

  let sent = 0;
  for (const liveClass of classes) {
    if (!liveClass.zoom_link) continue;

    const { data: regs } = await db
      .from("academy_live_registrations")
      .select("id, partner_id, reminder_sent_at")
      .eq("live_class_id", liveClass.id)
      .is("reminder_sent_at", null);

    if (!regs?.length) continue;

    const dataHora = new Date(liveClass.date).toLocaleString("pt-BR", {
      day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit",
    });

    for (const reg of regs) {
      try {
        const { data: partner } = await db.from("profiles").select("full_name, email").eq("id", reg.partner_id).single();
        if (partner?.email) {
          await notifyAulaAoVivoLembrete({
            partnerEmail: partner.email,
            partnerName: partner.full_name ?? "Partner",
            titulo: liveClass.title,
            instrutor: liveClass.instructor ?? "V3 Partners",
            dataHora,
            zoomLink: liveClass.zoom_link,
          });
        }
        await db.from("academy_live_registrations").update({ reminder_sent_at: new Date().toISOString() }).eq("id", reg.id);
        sent++;
      } catch (e) {
        void db.from("execution_errors").insert({ workflow: "cron/academy-live-reminder", error_message: String(e), severity: "medium" });
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
