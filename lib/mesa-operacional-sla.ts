// Cálculo de SLA da Mesa Operacional (propostas de crédito + tickets) —
// extraído de components/mesa-operacional/mesa-op-client.tsx pra ser
// compartilhado entre a tela (client) e o cron de alerta (server, sem DOM).
// Qualquer mudança na regra de cálculo tem que ser feita AQUI, não duplicada.

export const SLA_STAGES = ["RECEBIDO", "TRIAGEM", "ANALISE", "PENDENCIA", "AVALIACAO_IMOVEL", "APROVACAO", "CONTRATO_ASSINADO", "REGISTRO_IMOVEL", "LIBERADO"] as const;
export type SlaStage = typeof SLA_STAGES[number];
export type SlaConfig = Record<SlaStage, number>;

export const SLA_STAGE_LABELS: Record<SlaStage, string> = {
  RECEBIDO: "Recebido",
  TRIAGEM: "Triagem",
  ANALISE: "Análise",
  PENDENCIA: "Pendência",
  AVALIACAO_IMOVEL: "Avaliação de Imóvel",
  APROVACAO: "Aprovação",
  CONTRATO_ASSINADO: "Contrato Assinado",
  REGISTRO_IMOVEL: "Registro de Imóveis",
  LIBERADO: "Recurso Liberado",
};

export const DEFAULT_SLA: SlaConfig = {
  RECEBIDO: 1, TRIAGEM: 2, ANALISE: 5, PENDENCIA: 3,
  AVALIACAO_IMOVEL: 15, APROVACAO: 2, CONTRATO_ASSINADO: 5, REGISTRO_IMOVEL: 30, LIBERADO: 3,
};

// Estágios terminais do pipeline de propostas — não contam prazo (sem
// "próxima etapa" esperando). Duplicado de TERMINAL_STAGES em
// mesa-op-client.tsx (que também é usado pra colunas do kanban/filtros,
// não só SLA — por isso não foi movido pra cá).
export const PROPOSAL_TERMINAL_STAGES = ["LIBERADO", "REPROVADO", "DECLINADO", "FINALIZADO"] as const;

export type SlaStatusLevel = "ok" | "warning" | "danger";

export interface SlaStatusResult {
  status: SlaStatusLevel;
  daysLeft: number; // positivo = dias restantes, negativo = dias vencidos
  targetDate: string | null; // ISO date se definido por calendário (sla_override)
  daysElapsed: number;
  slaLimit: number;
}

/** Parseia "YYYY-MM-DD" como horário local (evita UTC shift). */
export function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export interface ProposalForSla {
  stage: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
}

/** Retorna sla_override do deal: valores são ISO date strings (ex: "2026-05-25") */
function getDealSlaOverride(proposal: ProposalForSla): Record<string, string> {
  try {
    const raw = proposal.metadata?.sla_override;
    if (raw && typeof raw === "object") return raw as Record<string, string>;
  } catch { /* ignora */ }
  return {};
}

export function getSlaStatus(proposal: ProposalForSla, slaConfig: SlaConfig): SlaStatusResult | null {
  if (!proposal.stage || (PROPOSAL_TERMINAL_STAGES as readonly string[]).includes(proposal.stage)) return null;
  const stage = proposal.stage as SlaStage;
  if (!(SLA_STAGES as readonly string[]).includes(stage)) return null;

  const override = getDealSlaOverride(proposal);
  const targetDateStr = override[stage];

  if (targetDateStr && typeof targetDateStr === "string" && targetDateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    // SLA por calendário: compara data alvo vs hoje
    const target = parseLocalDate(targetDateStr);
    target.setHours(23, 59, 59, 999);
    const diffMs = target.getTime() - Date.now();
    const daysLeft = Math.ceil(diffMs / 86400000);
    let status: SlaStatusLevel;
    if (daysLeft < 0) status = "danger";
    else if (daysLeft <= 1) status = "warning";
    else status = "ok";
    return { status, daysLeft, targetDate: targetDateStr, daysElapsed: -daysLeft, slaLimit: 0 };
  }

  // Fallback: SLA global em dias
  const stageChangedAt = proposal.metadata?.stage_changed_at as string | undefined;
  const referenceDate = stageChangedAt ?? proposal.created_at;
  if (!referenceDate) return null;
  const elapsed = (Date.now() - new Date(referenceDate).getTime()) / 86400000;
  const limit = slaConfig[stage] ?? DEFAULT_SLA[stage];
  const ratio = elapsed / limit;
  let status: SlaStatusLevel;
  if (ratio >= 1) status = "danger";
  else if (ratio >= 0.7) status = "warning";
  else status = "ok";
  return { status, daysLeft: Math.ceil(limit - elapsed), targetDate: null, daysElapsed: Math.floor(elapsed), slaLimit: limit };
}

export interface TicketForSla {
  due_date: string | null;
  status: string;
}

const TICKET_SLA_TERMINAL_STATUSES = ["COMPLETED", "CANCELLED"];

/** Verde = dentro do prazo · Amarelo = vence hoje · Vermelho = atrasado. */
export function getTicketSlaStatus(ticket: TicketForSla): SlaStatusLevel | null {
  if (!ticket.due_date || TICKET_SLA_TERMINAL_STATUSES.includes(ticket.status)) return null;
  const due = new Date(ticket.due_date);
  const isToday = due.toDateString() === new Date().toDateString();
  due.setHours(23, 59, 59, 999);
  if (due.getTime() < Date.now()) return "danger";
  if (isToday) return "warning";
  return "ok";
}
