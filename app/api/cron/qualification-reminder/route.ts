import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendWhatsApp } from "@/lib/whatsapp/subscription-messages";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

// GET /api/cron/qualification-reminder — Fast-Track de Contratos Simples
// (BRIEF 30/08/2026, Fase A). Cobrança automática de qualificação de
// partes pendente: hoje o link de qualificação (Seção 8 do manual,
// rev.42) já existe, mas nada cobra automaticamente quem não preencheu.
// Acionado por n8n a cada 24h (Bearer CRON_SECRET, mesmo padrão de
// /api/cron/clicksign-sync — decisão já registrada de não usar cron da
// Vercel, plano Hobby).
export const maxDuration = 60;

const REMINDER_INTERVAL_HOURS = 24;
const MAX_REMINDERS = 5; // depois disso a Mesa é quem decide, não mais automático

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface PendingParty {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  qualification_token: string;
  status: string;
}

interface Batch {
  id: string;
  reminder_count: number;
  last_reminder_sent_at: string | null;
  cm_party_qualifications: PendingParty[];
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = svc();
  const cutoff = new Date(Date.now() - REMINDER_INTERVAL_HOURS * 3600 * 1000).toISOString();

  const { data: batches, error } = await db
    .from("cm_qualification_batches")
    .select("id, reminder_count, last_reminder_sent_at, cm_party_qualifications(id, full_name, email, phone, qualification_token, status)")
    .eq("status", "coletando")
    .lt("reminder_count", MAX_REMINDERS)
    .or(`last_reminder_sent_at.is.null,last_reminder_sent_at.lt.${cutoff}`);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const results: Array<{ batch_id: string; notified: string[]; errors: string[] }> = [];

  for (const batch of (batches ?? []) as unknown as Batch[]) {
    const pending = (batch.cm_party_qualifications ?? []).filter((p) => p.status === "pendente");
    if (pending.length === 0) continue; // fechamento automático (rota de qualificação) já deveria ter marcado completo, mas nunca cobra à toa

    const notified: string[] = [];
    const errors: string[] = [];

    for (const party of pending) {
      const link = `https://app.v3partners.com.br/intake/qualificacao/${party.qualification_token}`;
      const firstName = party.full_name.split(" ")[0];

      try {
        const subjectGate = auditText("Lembrete: qualificação pendente, V3 Partners");
        const htmlGate = auditHtml(
          `<p>Olá ${party.full_name},</p>
           <p>Notamos que sua qualificação para a operação ainda não foi concluída. Complete seus dados para que possamos prosseguir: ${link}</p>
           <p>V3 Partners</p>`
        );
        if (process.env.RESEND_API_KEY) {
          const { Resend } = await import("resend");
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from: "V3 Partners <noreply@v3partners.com.br>",
            to: party.email,
            subject: subjectGate.corrected,
            html: htmlGate.corrected,
          });
        }
        if (party.phone) {
          const msg = auditText(
            `Ola ${firstName}, tudo bem? Notamos que sua qualificacao para a operacao ainda nao foi concluida. Complete seus dados aqui: ${link}`
          );
          await sendWhatsApp(party.phone, msg.corrected);
        }
        notified.push(party.id);
      } catch (e) {
        errors.push(`${party.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await db.from("cm_qualification_batches").update({
      last_reminder_sent_at: new Date().toISOString(),
      reminder_count: (batch.reminder_count ?? 0) + 1,
    }).eq("id", batch.id);

    results.push({ batch_id: batch.id, notified, errors });
  }

  return NextResponse.json({ ok: true, batches_checked: (batches ?? []).length, results });
}
