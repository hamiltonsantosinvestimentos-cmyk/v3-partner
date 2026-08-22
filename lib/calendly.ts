// Cliente fino sobre a API do Calendly -- consulta disponibilidade real do
// evento "Agenda / Ecossistema" e monta links de agendamento rastreáveis.
//
// Importante: o Calendly não permite criar um agendamento via API em nome de
// alguém -- só o próprio convidado confirma, clicando no link dele. O fluxo
// aqui é sempre: consultamos horários reais -> a IA sugere -> manda o link
// certo -> quando a pessoa de fato agenda, o Calendly avisa via webhook
// (invitee.created, ver app/api/calendly/webhook/route.ts) e só então
// confirmamos na conversa. Nunca inventar horário ou fingir que já agendou.

const CALENDLY_BASE = "https://api.calendly.com";

function apiToken(): string {
  const v = process.env.CALENDLY_API_TOKEN;
  if (!v) throw new Error("CALENDLY_API_TOKEN não configurado.");
  return v;
}

function eventTypeUri(): string {
  const v = process.env.CALENDLY_EVENT_TYPE_URI;
  if (!v) throw new Error("CALENDLY_EVENT_TYPE_URI não configurado.");
  return v;
}

export class CalendlyError extends Error {}

export type CalendlySlot = {
  startTimeISO: string;
  schedulingUrl: string;
  /** ex: "seg 25/08 às 09:00", já em horário de Brasília */
  labelPtBR: string;
};

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const TZ = "America/Sao_Paulo";

function formatarLabelPtBR(iso: string): string {
  const d = new Date(iso);
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(d).reduce((acc, p) => ({ ...acc, [p.type]: p.value }), {} as Record<string, string>);

  const diaSemana = DIAS_SEMANA.find((s) => partes.weekday?.toLowerCase().startsWith(s)) ?? partes.weekday ?? "";
  return `${diaSemana} ${partes.day}/${partes.month} às ${partes.hour}:${partes.minute}`;
}

// Lista horários realmente livres nos próximos `days` dias. Nunca lança pra
// fora sem necessidade -- quem chama decide como degradar (ex: não oferecer
// agendamento nesta resposta) se a consulta falhar.
export async function listAvailableSlots(days = 6): Promise<CalendlySlot[]> {
  const start = new Date(Date.now() + 60 * 60 * 1000); // +1h de folga sobre agora
  const end = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    event_type: eventTypeUri(),
    start_time: start.toISOString().replace(/\.\d{3}Z$/, ".000000Z"),
    end_time: end.toISOString().replace(/\.\d{3}Z$/, ".000000Z"),
  });

  const res = await fetch(`${CALENDLY_BASE}/event_type_available_times?${params}`, {
    headers: { Authorization: `Bearer ${apiToken()}` },
  });
  const json = await res.json() as { collection?: { start_time: string; scheduling_url: string; status: string }[]; message?: string };

  if (!res.ok) {
    throw new CalendlyError(json.message ?? `Erro HTTP ${res.status} ao consultar disponibilidade do Calendly`);
  }

  return (json.collection ?? [])
    .filter((s) => s.status === "available")
    .map((s) => ({
      startTimeISO: s.start_time,
      schedulingUrl: s.scheduling_url,
      labelPtBR: formatarLabelPtBR(s.start_time),
    }));
}

// Anexa um tracking_id nosso (uuid da linha em sdr_agendamentos) como
// parâmetro UTM invisível ao convidado -- é como casamos, no webhook
// invitee.created, qual conversa corresponde a esse agendamento (o Calendly
// não conhece IGSID nem telefone).
export function withTracking(schedulingUrl: string, trackingId: string): string {
  const url = new URL(schedulingUrl);
  url.searchParams.set("utm_source", "v3-sdr");
  url.searchParams.set("utm_content", trackingId);
  return url.toString();
}
