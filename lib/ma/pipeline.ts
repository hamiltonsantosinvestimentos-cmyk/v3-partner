// Fonte única das fases da Mesa M&A (BRIEF 28/10/2026, bloco B, seção 4.7).
// Antes deste arquivo, fases, rótulos e o mapa banco <-> tela estavam copiados em
// ma-client.tsx, mesa-ma-client.tsx, na página server-side, na rota PATCH e na Timeline,
// e CLOSED_WON/CLOSED_LOST caíam em "Aprovação Final" (Ganho e Perdido ficavam invisíveis).
// Usado no cliente e no servidor: sem dependência de React nem de Supabase.

export type DbStage =
  | "PROSPECTING" | "QUALIFICATION" | "IOI" | "PROPOSAL" | "MANDATE" | "ROADSHOW"
  | "NEGOTIATION" | "DUE_DILIGENCE" | "CLOSING" | "CLOSED_WON" | "CLOSED_LOST";

export type PipelineStage = { id: string; db: DbStage; label: string; color: string; bg: string; probability: number };

// Fases de trabalho, na ordem da esteira (escala ordinal: a ordem tem significado, não alfabetizar).
// Bloco E (29/10/2026): colunas alinhadas à Esteira de Originação (BRIEF 28/10/2026, seção 8).
// Nenhum deal mudou de fase: IOI e PROPOSAL ganharam rótulo novo, MANDATE e ROADSHOW são valores
// novos do enum deal_stage (migration 20261029a). Os ids de tela antigos ficam para não quebrar
// links e estados salvos. NCNDA vem depois do teaser e dos cenários; Due Diligence antes da Negociação.
export const MA_PIPELINE: PipelineStage[] = [
  { id: "prospeccao",    db: "PROSPECTING",   label: "Originação",                color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", probability: 10 },
  { id: "viabilidade",   db: "IOI",           label: "Relatórios e Teaser",       color: "#06B6D4", bg: "rgba(6,182,212,0.12)",  probability: 20 },
  { id: "estruturacao",  db: "PROPOSAL",      label: "Cenários e Proposta",       color: "#F59E0B", bg: "rgba(245,158,11,0.12)", probability: 30 },
  { id: "qualificacao",  db: "QUALIFICATION", label: "NCNDA / Qualificação",      color: "#3B82F6", bg: "rgba(59,130,246,0.12)", probability: 40 },
  { id: "mandato",       db: "MANDATE",       label: "Mandato",                   color: "#A78BFA", bg: "rgba(167,139,250,0.12)", probability: 50 },
  { id: "roadshow",      db: "ROADSHOW",      label: "Roadshow com Investidores", color: "#E8C97A", bg: "rgba(232,201,122,0.12)", probability: 60 },
  { id: "due_diligence", db: "DUE_DILIGENCE", label: "Due Diligence",             color: "#C4922E", bg: "rgba(196,146,46,0.12)", probability: 70 },
  { id: "negociacao",    db: "NEGOTIATION",   label: "Negociação",                color: "#EF4444", bg: "rgba(239,68,68,0.12)",  probability: 80 },
  { id: "aprovacao",     db: "CLOSING",       label: "Fechamento",                color: "#10B981", bg: "rgba(16,185,129,0.12)", probability: 90 },
];

// Saídas do funil: colunas próprias à direita do Kanban.
export const MA_CLOSED_STAGES: PipelineStage[] = [
  { id: "ganho",   db: "CLOSED_WON",  label: "Ganho",   color: "#C9A84C", bg: "rgba(201,168,76,0.12)",  probability: 100 },
  { id: "perdido", db: "CLOSED_LOST", label: "Perdido", color: "#9BAFC5", bg: "rgba(155,175,197,0.12)", probability: 0 },
];

export const MA_ALL_STAGES: PipelineStage[] = [...MA_PIPELINE, ...MA_CLOSED_STAGES];

export const WORKING_DB_STAGES: DbStage[] = MA_PIPELINE.map(s => s.db);
export const CLOSED_DB_STAGES: DbStage[] = ["CLOSED_WON", "CLOSED_LOST"];

export const PIPELINE_TO_DB: Record<string, DbStage> = Object.fromEntries(MA_ALL_STAGES.map(s => [s.id, s.db]));
export const DB_TO_PIPELINE: Record<string, string> = Object.fromEntries(MA_ALL_STAGES.map(s => [s.db, s.id]));
export const STAGE_DEFAULT_PROBABILITY: Record<string, number> = Object.fromEntries(MA_ALL_STAGES.map(s => [s.id, s.probability]));

// Rótulo por valor do banco (Timeline, CRM, relatórios). Valor vazio vira "Sem fase", nunca travessão.
export function dbStageLabel(stage: string | null | undefined): string {
  if (!stage) return "Sem fase";
  return MA_ALL_STAGES.find(s => s.db === stage)?.label ?? stage;
}

export function isClosedDbStage(stage: string | null | undefined): boolean {
  return stage === "CLOSED_WON" || stage === "CLOSED_LOST";
}

// Categorias de perda (seção 4.3): ordem alfabética do rótulo, "Outro" por último.
// Lista validada pelo João em 28/10/2026. Os valores batem com ma_deals_closed_reason_category_chk.
export const LOSS_CATEGORIES: { value: string; label: string }[] = [
  { value: "cliente_desistiu",          label: "Cliente desistiu" },
  { value: "concorrencia",              label: "Concorrência (outro assessor ou banco)" },
  { value: "documentacao_insuficiente", label: "Documentação insuficiente" },
  { value: "inviabilidade_financeira",  label: "Inviabilidade financeira" },
  { value: "sem_investidor",            label: "Sem investidor interessado" },
  { value: "sem_resposta",              label: "Sem resposta do cliente" },
  { value: "valuation_sem_acordo",      label: "Valuation sem acordo" },
  { value: "outro",                     label: "Outro" },
];

export function lossCategoryLabel(value: string | null | undefined): string {
  return LOSS_CATEGORIES.find(c => c.value === value)?.label ?? (value ?? "");
}

export const MIN_REASON_LENGTH = 10;
export const MAX_CLOSED_DAYS_BACK = 365;

// Data de hoje no fuso de referência (America/Sao_Paulo), em AAAA-MM-DD.
export function todaySaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// AAAA-MM-DD -> DD/MM/AAAA (sem passar por Date, para não deslocar o dia pelo fuso).
export function isoToBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

// DD/MM/AAAA -> AAAA-MM-DD, ou null se não for uma data real.
export function brToIso(br: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (!m) return null;
  const [, d, mo, y] = m;
  const dt = new Date(Date.UTC(+y, +mo - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +mo - 1 || dt.getUTCDate() !== +d) return null;
  return `${y}-${mo}-${d}`;
}

// Regra da data de fechamento: nunca futura, no máximo 365 dias para trás (fuso America/Sao_Paulo).
export function validateClosedDate(iso: string, now: Date = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Data de fechamento inválida.";
  const today = todaySaoPaulo(now);
  if (iso > today) return "A data de fechamento não pode ser futura.";
  const [y, m, d] = today.split("-").map(Number);
  const min = new Date(Date.UTC(y, m - 1, d - MAX_CLOSED_DAYS_BACK)).toISOString().slice(0, 10);
  if (iso < min) return `A data de fechamento pode ser no máximo ${MAX_CLOSED_DAYS_BACK} dias no passado.`;
  return null;
}

export type TransitionKind =
  | "same"          // mesma fase: nada a fazer
  | "advance"       // uma fase à frente
  | "skip"          // mais de uma fase à frente: exige justificativa
  | "back"          // qualquer fase anterior: exige confirmação
  | "won"           // CLOSING -> CLOSED_WON
  | "won_invalid"   // Ganho fora de "Fechamento"
  | "lost"          // fase de trabalho -> CLOSED_LOST
  | "reopen_won"    // CLOSED_WON -> closed_from_stage (só ADMIN)
  | "reopen_lost"   // CLOSED_LOST -> closed_from_stage
  | "invalid";      // ex.: Ganho -> Perdido sem reabrir, ou reabrir para fase que não é a de origem

export function classifyTransition(from: string, to: string, closedFromStage?: string | null): TransitionKind {
  if (from === to) return "same";
  const fi = WORKING_DB_STAGES.indexOf(from as DbStage);
  const ti = WORKING_DB_STAGES.indexOf(to as DbStage);
  if (isClosedDbStage(from)) {
    if (ti === -1) return "invalid";
    // Sem fase de origem gravada (deal encerrado antes deste BRIEF) aceita qualquer fase de trabalho.
    if (closedFromStage && closedFromStage !== to) return "invalid";
    return from === "CLOSED_WON" ? "reopen_won" : "reopen_lost";
  }
  if (fi === -1) return "invalid";
  if (to === "CLOSED_WON") return from === "CLOSING" ? "won" : "won_invalid";
  if (to === "CLOSED_LOST") return "lost";
  if (ti === -1) return "invalid";
  if (ti === fi + 1) return "advance";
  if (ti > fi + 1) return "skip";
  return "back";
}

// Trava da Análise de Crédito (rev.113, movida no bloco E por decisão do João em 28/10/2026):
// barra a ENTRADA no Mandato, inclusive salto que passe por ele. Antes barrava a saída da
// Qualificação. Inteligência, teaser e cenários vêm antes de qualquer cobrança ao cliente.
export const CREDIT_GATE_STAGE: DbStage = "MANDATE";

export function crossesCreditGate(from: string, to: string): boolean {
  const gi = WORKING_DB_STAGES.indexOf(CREDIT_GATE_STAGE);
  const fi = WORKING_DB_STAGES.indexOf(from as DbStage);
  const ti = WORKING_DB_STAGES.indexOf(to as DbStage);
  return fi !== -1 && ti !== -1 && fi < gi && ti >= gi;
}

// Fases antes do NCNDA: NCNDA assinado (webhook ClickSign) leva o deal daqui para QUALIFICATION.
export const PRE_NCNDA_DB_STAGES: DbStage[] = WORKING_DB_STAGES.slice(0, WORKING_DB_STAGES.indexOf("QUALIFICATION"));

// Matriz por papel (seção 4.2). Devolve null se o papel pode, ou a mensagem do 403.
export const MA_STAGE_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

export function stageRoleDenial(role: string | null | undefined, kind: TransitionKind): string | null {
  if (!role || !(MA_STAGE_ROLES as readonly string[]).includes(role)) return "A fase do deal é conduzida pela Mesa M&A.";
  if (kind === "won" && role === "MESA_OPERACIONAL") return "Só ADMIN e GESTAO marcam um deal como Ganho.";
  if (kind === "reopen_lost" && role === "MESA_OPERACIONAL") return "Só ADMIN e GESTAO reabrem um deal Perdido.";
  if (kind === "reopen_won" && role !== "ADMIN") return "Só ADMIN reabre um deal Ganho.";
  return null;
}
