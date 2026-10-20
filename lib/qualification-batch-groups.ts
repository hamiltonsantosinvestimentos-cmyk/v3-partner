// Painel de Lotes de Qualificação da Minuta (BRIEF 20/10/2026,
// 06_Operacional/SOPs/2026-10-20_Operacional_BRIEF-Painel-Lotes-Qualificacao-Central-Contratos_v1.html).
// Caso real que originou: a tela mostrava lotes já consumidos (V3C-NDA-2026-0056/0057)
// com "2/2 qualificados" e "Corrigir", como se fossem pendência, e o único lote
// realmente pendente não dizia quem faltava.
//
// Fonte única do critério de agrupamento. "Pronto" espelha exatamente o filtro de
// app/api/contracts/generate/route.ts (status completo, não consumido, sem
// parent_contract_id), mais todas as partes preenchidas -- a tela nunca oferece
// "Gerar" num lote que o servidor recusaria.

export interface GroupablePartyLike {
  full_name: string;
  role_in_document: string;
  status: string;
}

export interface GroupableBatchLike<P extends GroupablePartyLike = GroupablePartyLike> {
  id: string;
  status: string;
  created_at?: string | null;
  parent_contract_id?: string | null;
  consumido_por_contract_id?: string | null;
  consumido_contrato?: { created_at?: string | null } | null;
  cm_party_qualifications: P[];
}

export function isBatchReady(b: GroupableBatchLike): boolean {
  return (
    !b.consumido_por_contract_id &&
    !b.parent_contract_id &&
    b.status === "completo" &&
    b.cm_party_qualifications.length > 0 &&
    b.cm_party_qualifications.every((p) => p.status === "preenchido")
  );
}

const byNewest = (a?: string | null, b?: string | null) => (b ?? "").localeCompare(a ?? "");

/** Termo de Adesão (parent_contract_id) fica fora dos três grupos, como no servidor:
 *  ele é tratado na seção de adesões do contrato de origem, nunca nesta minuta. */
export function groupQualificationBatches<B extends GroupableBatchLike>(batches: B[]) {
  const own = batches.filter((b) => !b.parent_contract_id);
  const ready = own.filter(isBatchReady).sort((a, b) => byNewest(a.created_at, b.created_at));
  const pending = own
    .filter((b) => !b.consumido_por_contract_id && !isBatchReady(b))
    .sort((a, b) => byNewest(a.created_at, b.created_at));
  const consumed = own
    .filter((b) => !!b.consumido_por_contract_id)
    .sort((a, b) => byNewest(a.consumido_contrato?.created_at ?? a.created_at, b.consumido_contrato?.created_at ?? b.created_at));
  return { ready, pending, consumed };
}

/** "Cristina e Alexandre", "Ana, Bruno e Carla". Recebe as partes já ordenadas
 *  por sortQualificationParties (ordem do instrumento, nunca alfabética). */
export function joinNamesPtBr(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

/** DD/MM/AAAA, HHhMM no fuso de Brasília (created_at é timestamptz). */
export function formatDateTimeBr(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}, ${get("hour")}h${get("minute")}`;
}

export type ConsumedContractTone = "warn" | "pend" | "ok" | "err";

/** Rótulo da situação do contrato que consumiu o lote (BRIEF, seção 4.2). */
export function consumedContractStatus(c?: { status_signature?: string | null; deleted_at?: string | null } | null): { label: string; tone: ConsumedContractTone } {
  if (!c) return { label: "Situação indisponível", tone: "pend" };
  if (c.deleted_at || c.status_signature === "cancelado") return { label: "Cancelado", tone: "err" };
  if (c.status_signature === "assinado") return { label: "Assinado", tone: "ok" };
  if (c.status_signature === "enviado_assinatura" || c.status_signature === "enviado") return { label: "Na assinatura", tone: "pend" };
  if (c.status_signature === "rascunho") return { label: "Rascunho, não enviado", tone: "warn" };
  return { label: c.status_signature ?? "Situação indisponível", tone: "pend" };
}
