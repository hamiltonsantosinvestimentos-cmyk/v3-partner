import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { numerosAlertaQuiz } from "@/lib/quiz-lead-unico";
import { lembretesDevidos } from "@/lib/prospeccao-lembrete";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET /api/cron/lembrete-agenda-prospeccao — cron a cada minuto (ver vercel.json).
// Kanban de Prospecção Partners: 10 minutos antes de cada horário marcado (data e hora
// agendada com o lead, metadata.agendado_em, e reunião da etapa Agenda de Reunião,
// metadata.reuniao_em), manda um lembrete no WhatsApp dos números do time
// (QUIZ_LEAD_ALERT_WHATSAPP, os mesmos dos alertas de lead). Um lembrete por horário:
// metadata.lembretes_enviados guarda o horário já lembrado; se reagendar, lembra de novo.
// Mesmo padrão de auth Bearer CRON_SECRET dos demais /api/cron/*.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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

  return NextResponse.json({ ok: true, enviados });
}
