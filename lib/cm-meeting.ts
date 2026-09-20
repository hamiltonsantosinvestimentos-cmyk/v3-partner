import { createClient as sc } from "@supabase/supabase-js";

// Link unico de agendamento da reuniao inicial com o Head (Etapa 2). Fonte unica: antes
// estava colado em 2 rotas de intake. Usado pelo gatilho automatico (quando a chave
// meeting_autotrigger esta ligada) e pelo botao manual "Agendar Reuniao".
export const CM_MEETING_URL =
  "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1T51okURKuhE_zw_MiCC68TkFZHk8tgNaJQauB9ha6LymoTSSovxkijrv3BfDYW1VipSAXokAi";

/** Notificacao in-app (sem push) ao criador do link com o link de agendamento.
 *  Sempre aguardada: no supabase-js um insert sem await nunca envia a requisicao. */
export async function notifyMeetingLink(opts: {
  userId: string | null | undefined;
  title: string;
  intro: string;
  actionUrl: string;
}): Promise<void> {
  if (!opts.userId) return;
  try {
    const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { error } = await db.from("notifications").insert({
      user_id: opts.userId,
      title: opts.title,
      message: `${opts.intro} Agende a reunião de apresentação com o Head: ${CM_MEETING_URL}`,
      type: "reuniao_agendada",
      action_url: opts.actionUrl,
      read: false,
    });
    if (error) console.error("[cm-meeting] falha ao notificar o link de reuniao:", error.message);
  } catch (e) {
    console.error("[cm-meeting] erro inesperado:", e);
  }
}
