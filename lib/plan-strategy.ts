export const CADENCES = ["SEMANAL", "MENSAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"] as const;
export type Cadence = typeof CADENCES[number];

export function isValidCadence(v: string): v is Cadence {
  return (CADENCES as readonly string[]).includes(v);
}

export const CADENCE_LABELS: Record<Cadence, string> = {
  SEMANAL: "Semanal",
  MENSAL: "Mensal",
  TRIMESTRAL: "Trimestral",
  SEMESTRAL: "Semestral",
  ANUAL: "Anual",
};

/** Pergunta central de cada cadência — adaptação G4 (docs/estrategia/g4-cadencia-planejamento-estrategico.md) */
export const CADENCE_QUESTION: Record<Cadence, string> = {
  SEMANAL: "O que moveu esta semana? Onde está travado?",
  MENSAL: "Estamos no ritmo da meta do mês? Que rota ajustar?",
  TRIMESTRAL: "O que aprendemos no ciclo? Quais objetivos para o próximo trimestre?",
  SEMESTRAL: "Estamos negligenciando alguma dimensão do BSC (financeira/clientes/processos/aprendizado) nesta vertical?",
  ANUAL: "Diagnóstico → caminhos estratégicos → prioridades/orçamento → desdobramento tático para o próximo ano.",
};

export const CADENCE_FORMAT: Record<Cadence, string> = {
  SEMANAL: "Check-in tático, 30 min, por mesa",
  MENSAL: "Revisão de metas e resultados",
  TRIMESTRAL: "Ciclo de OKR — fechamento + lançamento",
  SEMESTRAL: "Rebalanceamento do mapa estratégico (BSC)",
  ANUAL: "Replanejamento completo (G4 Sprints aplicado à holding)",
};

export const STATUS_OPTIONS = ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDO"] as const;
export type CheckinStatus = typeof STATUS_OPTIONS[number];

export const STATUS_LABELS: Record<CheckinStatus, string> = {
  PENDENTE: "Pendente",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoWeekLabel(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // Segunda=0 .. Domingo=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // Quinta-feira desta semana
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const diff = date.getTime() - firstThursday.getTime();
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return `${date.getUTCFullYear()}-W${pad(week)}`;
}

export function periodLabel(d: Date, cadence: Cadence): string {
  if (cadence === "SEMANAL") return isoWeekLabel(d);
  if (cadence === "MENSAL") return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  if (cadence === "TRIMESTRAL") return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  if (cadence === "SEMESTRAL") return `${d.getFullYear()}-S${d.getMonth() < 6 ? 1 : 2}`;
  return `${d.getFullYear()}`;
}

export function shiftDate(d: Date, cadence: Cadence, dir: 1 | -1): Date {
  const nd = new Date(d);
  if (cadence === "SEMANAL") nd.setDate(nd.getDate() + 7 * dir);
  else if (cadence === "MENSAL") nd.setMonth(nd.getMonth() + dir);
  else if (cadence === "TRIMESTRAL") nd.setMonth(nd.getMonth() + 3 * dir);
  else if (cadence === "SEMESTRAL") nd.setMonth(nd.getMonth() + 6 * dir);
  else nd.setFullYear(nd.getFullYear() + dir);
  return nd;
}
