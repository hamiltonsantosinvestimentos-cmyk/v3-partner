// Campos de encerramento (Ganho/Perdido) de uma linha de ma_deals para o card do Kanban
// da Mesa M&A. Usado pela página server-side e pelo recarregamento no cliente, para os
// dois caminhos montarem o card do mesmo jeito (BRIEF 28/10/2026, bloco B).

export type DealClosure = {
  closedDate?: string;
  closedAt?: string;
  closedFromStage?: string;
  closedReasonCategory?: string;
  closedReason?: string;
  closedNote?: string;
  closedByName?: string;
};

export function closureFromRow(d: Record<string, unknown>): DealClosure {
  const closer = d.closer as { full_name?: string } | { full_name?: string }[] | null | undefined;
  const closerName = Array.isArray(closer) ? closer[0]?.full_name : closer?.full_name;
  return {
    closedDate:           (d.closed_date as string | null) ?? undefined,
    closedAt:             (d.closed_at as string | null) ?? undefined,
    closedFromStage:      (d.closed_from_stage as string | null) ?? undefined,
    closedReasonCategory: (d.closed_reason_category as string | null) ?? undefined,
    closedReason:         (d.closed_reason as string | null) ?? undefined,
    closedNote:           (d.closed_note as string | null) ?? undefined,
    closedByName:         closerName ?? undefined,
  };
}
