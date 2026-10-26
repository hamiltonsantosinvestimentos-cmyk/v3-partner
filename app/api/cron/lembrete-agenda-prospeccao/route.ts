import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient as sc } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { numerosAlertaQuiz } from "@/lib/quiz-lead-unico";
import { lembretesDevidos } from "@/lib/prospeccao-lembrete";
import { recuperarCheckoutsWebinar } from "@/lib/webinar";
import { verificarSlaChat } from "@/lib/chat-partners";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET /api/cron/lembrete-agenda-prospeccao — chamado a cada minuto pelo pg_cron do Supabase
// (supabase/migrations/20261012a_prospeccao_lembrete_cron.sql). Não fica no vercel.json porque o
// plano da Vercel só aceita cron diário (um cron por minuto nem gera o deploy).
// Kanban de Prospecção Partners: 10 minutos antes de cada horário marcado (data e hora
// agendada com o lead, metadata.agendado_em, e reunião da etapa Agenda de Reunião,
// metadata.reuniao_em), manda um lembrete no WhatsApp dos números do time
// (QUIZ_LEAD_ALERT_WHATSAPP, os mesmos dos alertas de lead). Um lembrete por horário:
// metadata.lembretes_enviados guarda o horário já lembrado; se reagendar, lembra de novo.
// Auth: Bearer CRON_SECRET (padrão dos /api/cron/*) ou o header x-lembrete-token, que é um
// HMAC da service role do Supabase (assim o SQL do pg_cron não precisa do CRON_SECRET da Vercel).
function tokenLembrete(): string {
  return createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update("lembrete-agenda-prospeccao").digest("hex");
}
function autorizado(req: NextRequest): boolean {
  if (process.env.CRON_SECRET && req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`) return true;
  const t = req.headers.get("x-lembrete-token") ?? "";
  const esperado = tokenLembrete();
  return t.length === esperado.length && !!process.env.SUPABASE_SERVICE_ROLE_KEY && timingSafeEqual(Buffer.from(t), Buffer.from(esperado));
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = svc();
  const { data: leads, error } = await db
    .from("prospeccao_leads")
    .select("id, nome, telefone, etapa, responsavel_nome, metadata")
    .not("etapa", "in", "(perdido,convertido)")
    .or("metadata->>agendado_em.not.is.null,metadata->>reuniao_em.not.is.null");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const numeros = numerosAlertaQuiz();
  const enviados: string[] = [];
  for (const lead of leads ?? []) {
    const meta = (lead.metadata as Record<string, unknown> | null) ?? {};
    const devidos = lembretesDevidos(meta, Date.now());
    if (!devidos.length) continue;

    // Marca antes de enviar: duas execuções sobrepostas não mandam em dobro.
    const jaEnviados = { ...((meta.lembretes_enviados as Record<string, string> | undefined) ?? {}) };
    for (const l of devidos) jaEnviados[l.campo] = l.iso;
    await db.from("prospeccao_leads").update({ metadata: { ...meta, lembretes_enviados: jaEnviados } }).eq("id", lead.id);

    for (const l of devidos) {
      const msg =
        `⏰ Lembrete: ${l.titulo} em ${l.minutos} min\n\n` +
        `${lead.nome}\n🕒 ${l.quando}` +
        (lead.telefone ? `\n📱 ${lead.telefone}` : "") +
        (lead.responsavel_nome ? `\nResponsável: ${lead.responsavel_nome}` : "") +
        `\n\nVer: app.v3partners.com.br/prospeccao`;
      await Promise.allSettled(numeros.map((n) => sendText(n, msg).catch(() => false)));
      enviados.push(`${lead.id}:${l.campo}`);
    }
  }

  // Mesmo pg_cron por minuto: recuperação do checkout do webinar (WhatsApp para quem não pagou).
  const webinar = await recuperarCheckoutsWebinar(db).catch((e) => { console.error("Recuperação webinar:", e); return 0; });

  // Mesmo pg_cron: alerta de SLA do Chat Partners (partner sem resposta da Mesa há CHAT_SLA_HORAS).
  const slaChat = await verificarSlaChat(db, (texto) => Promise.allSettled(numeros.map((n) => sendText(n, texto).catch(() => false))))
    .catch((e) => { console.error("SLA chat:", e); return 0; });

  return NextResponse.json({ ok: true, enviados: enviados.length, webinar, slaChat });
}
