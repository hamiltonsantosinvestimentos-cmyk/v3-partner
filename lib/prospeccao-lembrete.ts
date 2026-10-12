// Lembrete de agenda do Kanban de Prospecção Partners (ver app/api/cron/lembrete-agenda-prospeccao).
// Lógica pura, testada em tests/unit/prospeccao-lembrete.test.ts.

export const ANTECEDENCIA_LEMBRETE_MS = 10 * 60_000;

const CAMPOS = [
  { campo: "reuniao_em", titulo: "reunião com o lead" },
  { campo: "agendado_em", titulo: "horário agendado com o lead" },
] as const;

export type LembreteDevido = { campo: string; iso: string; titulo: string; minutos: number; quando: string };

function fmtQuando(iso: string) {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}

/**
 * Horários do lead que entram agora na janela de 10 minutos e ainda não foram lembrados.
 * Horário já passado não gera lembrete. Se reunião e agendamento forem o mesmo horário, lembra uma vez só.
 */
export function lembretesDevidos(meta: Record<string, unknown>, agoraMs: number): LembreteDevido[] {
  const enviados = (meta.lembretes_enviados as Record<string, string> | undefined) ?? {};
  const out: LembreteDevido[] = [];
  for (const { campo, titulo } of CAMPOS) {
    const v = meta[campo];
    if (typeof v !== "string") continue;
    const t = new Date(v).getTime();
    if (Number.isNaN(t)) continue;
    const falta = t - agoraMs;
    if (falta <= 0 || falta > ANTECEDENCIA_LEMBRETE_MS) continue;
    if (enviados[campo] && new Date(enviados[campo]).getTime() === t) continue;
    if (out.some((o) => new Date(o.iso).getTime() === t)) continue;
    out.push({ campo, iso: v, titulo, minutos: Math.max(1, Math.round(falta / 60_000)), quando: fmtQuando(v) });
  }
  return out;
}
