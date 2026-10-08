// Indicadores e gargalos da Bolsa de Ativos (Bloco 4, 08/10/2026).
// BRIEF: scratchpad brief-bloco4-indicadores.md (REVISAO v2). Funcoes PURAS: sem rede, sem banco.
// Tudo que e dia usa DATA-CALENDARIO em America/Sao_Paulo (nunca diferenca de instantes UTC).
// Metrica so aparece com amostra minima; abaixo disso devolve null e a tela diz "Sem dados suficientes".

import { DEMAND_DECLINE_REASONS, DEMAND_STATUS_LABELS } from "@/lib/cm-demand-stages";
import { ASSET_DECLINE_REASONS, BID_DECLINE_REASONS } from "@/lib/cm-decline-reasons";

// ---------------------------------------------------------------------------
// Sequencias e rotulos (fonte unica no servidor)
// ---------------------------------------------------------------------------

// Funil de VENDA (ativos). Rotulos iguais a CM_STATUS_LABELS (components/cm/filter-drawer.tsx).
export const SALE_STAGES = [
  "reuniao_validada", "formulario_preenchido", "reuniao_agendada", "em_qualificacao", "nda_assinado",
  "em_analise", "aprovado_head", "aprovado_com_restricoes", "ativo_vitrine", "proposta_recebida",
  "em_escrow_due_diligence", "liquidado",
] as const;

export const SALE_LABELS: Record<string, string> = {
  reuniao_validada: "Reunião Validada",
  formulario_preenchido: "Formulário Preenchido",
  reuniao_agendada: "Reunião Agendada",
  em_qualificacao: "Em Qualificação",
  nda_assinado: "NDA Assinado",
  em_analise: "Em Análise",
  aprovado_head: "Aprovado pela Diretoria",
  aprovado_com_restricoes: "Aprovado com Restrições",
  ativo_vitrine: "Ativo na Vitrine",
  proposta_recebida: "Proposta Recebida",
  em_escrow_due_diligence: "Escrow / Due Diligence",
  liquidado: "Liquidado",
  reprovado: "Reprovado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

// Funil de COMPRA (demandas). `pendente` e agrupado em `reuniao_validada` (mesmo tratamento da maquina de estados).
export const BUY_STAGES = [
  "reuniao_validada", "formulario_preenchido", "reuniao_agendada", "em_qualificacao", "nda_assinado",
  "em_analise", "aprovado_head", "aprovado_com_restricoes", "ativo", "em_negociacao", "concluido",
] as const;

// Etapas terminais, sempre depois da ultima etapa, nesta ordem.
export const TERMINAL_STAGES = ["reprovado", "cancelado", "expirado"] as const;

// Nunca entram em "parado": terminais e etapas finais de sucesso.
const NEVER_STALLED = new Set<string>([...TERMINAL_STAGES, "liquidado", "concluido"]);

export const STALLED_DAYS = 30; // "parado" = estritamente MAIOR que isto
export const MIN_ITEMS_FOR_MEDIAN = 5;
export const MIN_ITEMS_FOR_BOTTLENECK = 5;
export const MIN_STALLED_FOR_BOTTLENECK = 3;
export const MIN_TRANSITIONS_FOR_STAGE_TIME = 5;

export function stageLabel(side: "venda" | "compra", key: string): string {
  if (side === "venda") return SALE_LABELS[key] ?? key;
  if (key === "reuniao_validada") return "Aguardando Formulário";
  return DEMAND_STATUS_LABELS[key] ?? SALE_LABELS[key] ?? key;
}

// ---------------------------------------------------------------------------
// Datas em America/Sao_Paulo
// ---------------------------------------------------------------------------

const SP_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });

/** "AAAA-MM-DD" da data-calendario em Sao Paulo. */
export function spDateKey(d: Date): string {
  return SP_DATE.format(d);
}

function keyToUtcMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Dias inteiros (truncados, nunca negativos) entre duas datas-calendario de Sao Paulo. */
export function calendarDaysSp(from: Date, to: Date): number {
  const diff = Math.floor((keyToUtcMs(spDateKey(to)) - keyToUtcMs(spDateKey(from))) / 86_400_000);
  return diff < 0 ? 0 : diff;
}

/** Inicio do periodo: 00:00 de Sao Paulo de (hoje menos N dias). Sao Paulo e UTC-3 fixo (sem horario de verao desde 2019). */
export function periodStart(days: number | null, now: Date): Date | null {
  if (days === null) return null;
  const todayMs = keyToUtcMs(spDateKey(now));
  const start = new Date(todayMs - days * 86_400_000);
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}-${String(start.getUTCDate()).padStart(2, "0")}`;
  return new Date(`${key}T03:00:00.000Z`);
}

export function formatDateBr(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

export function formatDateTimeBr(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

// ---------------------------------------------------------------------------
// Estatistica
// ---------------------------------------------------------------------------

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Data de entrada na etapa (cascata) e funil
// ---------------------------------------------------------------------------

export interface Transition {
  entityId: string;
  toStatus: string;
  createdAt: Date;
  reasonCategory: string | null;
}

export interface Entity {
  id: string;
  status: string;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export type EntrySource = "transicao" | "criacao" | "atualizacao";

/** (1) ultima transicao para o status atual; (2) created_at da linha; (3) updated_at so se faltar created_at. */
export function entryDate(entity: Entity, lastTransitionToCurrent: Date | null): { at: Date; source: EntrySource } | null {
  if (lastTransitionToCurrent) return { at: lastTransitionToCurrent, source: "transicao" };
  if (entity.createdAt) return { at: entity.createdAt, source: "criacao" };
  if (entity.updatedAt) return { at: entity.updatedAt, source: "atualizacao" };
  return null;
}

export interface StageRow {
  key: string;
  label: string;
  count: number;
  stalled: number;
  median_days: number | null; // null = sem dados suficientes
  estimated: number; // itens cuja entrada na etapa e estimada (fallback)
}

export interface Funnel {
  stages: StageRow[];
  terminals: { key: string; label: string; count: number }[];
  total_active: number;
  estimated_total: number;
  updated_at_fallback_total: number;
  bottleneck: { key: string; label: string; stalled: number; pct: number; of: number } | null;
}

export function normalizeStatus(side: "venda" | "compra", status: string): string {
  return side === "compra" && status === "pendente" ? "reuniao_validada" : status;
}

export function buildFunnel(side: "venda" | "compra", entities: Entity[], lastToCurrent: Map<string, Date>, now: Date): Funnel {
  const stageKeys: readonly string[] = side === "venda" ? SALE_STAGES : BUY_STAGES;
  const days = new Map<string, number[]>();
  const rows = new Map<string, StageRow>();
  for (const k of stageKeys) rows.set(k, { key: k, label: stageLabel(side, k), count: 0, stalled: 0, median_days: null, estimated: 0 });
  const terminals = new Map<string, number>(TERMINAL_STAGES.map((k) => [k, 0]));
  let estimatedTotal = 0;
  let updatedFallback = 0;
  let totalActive = 0;

  for (const e of entities) {
    const status = normalizeStatus(side, e.status);
    if (terminals.has(status)) { terminals.set(status, (terminals.get(status) ?? 0) + 1); continue; }
    const row = rows.get(status);
    if (!row) continue; // status fora das sequencias declaradas: nao entra na conta
    row.count += 1;
    if (!NEVER_STALLED.has(status)) totalActive += 1;
    const entry = entryDate(e, lastToCurrent.get(e.id) ?? null);
    if (!entry) continue;
    const age = calendarDaysSp(entry.at, now);
    if (entry.source !== "transicao") { row.estimated += 1; estimatedTotal += 1; }
    if (entry.source === "atualizacao") updatedFallback += 1;
    if (!NEVER_STALLED.has(status)) {
      if (age > STALLED_DAYS) row.stalled += 1;
      const list = days.get(status) ?? [];
      list.push(age);
      days.set(status, list);
    }
  }

  const stages = stageKeys.map((k) => {
    const row = rows.get(k)!;
    const list = days.get(k) ?? [];
    return { ...row, median_days: list.length >= MIN_ITEMS_FOR_MEDIAN ? median(list) : null };
  });

  let bottleneck: Funnel["bottleneck"] = null;
  if (totalActive >= MIN_ITEMS_FOR_BOTTLENECK) {
    let best: StageRow | null = null;
    for (const s of stages) {
      if (NEVER_STALLED.has(s.key) || s.stalled < MIN_STALLED_FOR_BOTTLENECK) continue;
      if (!best || s.stalled > best.stalled) best = s; // empate: vence a etapa mais a esquerda
    }
    if (best) bottleneck = { key: best.key, label: best.label, stalled: best.stalled, pct: Math.round((best.stalled / totalActive) * 100), of: totalActive };
  }

  return {
    stages,
    terminals: TERMINAL_STAGES.map((k) => ({ key: k, label: SALE_LABELS[k], count: terminals.get(k) ?? 0 })),
    total_active: totalActive,
    estimated_total: estimatedTotal,
    updated_at_fallback_total: updatedFallback,
    bottleneck,
  };
}

// ---------------------------------------------------------------------------
// Tempo mediano por etapa (entrada e saida), por funil
// ---------------------------------------------------------------------------

export interface StageTimeRow {
  key: string;
  label: string;
  n: number;
  median_days: number | null; // null = sem dados suficientes (n < MIN_TRANSITIONS_FOR_STAGE_TIME)
}

export function buildStageTimes(side: "venda" | "compra", transitions: Transition[]): StageTimeRow[] {
  const stageKeys: readonly string[] = side === "venda" ? SALE_STAGES : BUY_STAGES;
  const byEntity = new Map<string, Transition[]>();
  for (const t of transitions) {
    const list = byEntity.get(t.entityId) ?? [];
    list.push(t);
    byEntity.set(t.entityId, list);
  }
  const durations = new Map<string, number[]>();
  for (const list of byEntity.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 0; i < list.length - 1; i++) {
      const stage = normalizeStatus(side, list[i].toStatus);
      const d = calendarDaysSp(list[i].createdAt, list[i + 1].createdAt);
      const arr = durations.get(stage) ?? [];
      arr.push(d);
      durations.set(stage, arr);
    }
  }
  return stageKeys.map((k) => {
    const arr = durations.get(k) ?? [];
    return { key: k, label: stageLabel(side, k), n: arr.length, median_days: arr.length >= MIN_TRANSITIONS_FOR_STAGE_TIME ? median(arr) : null };
  });
}

// ---------------------------------------------------------------------------
// Motivos de recusa
// ---------------------------------------------------------------------------

export const NOT_CATEGORIZED_LABEL = "Não categorizada";

const REASON_LABELS: Map<string, string> = new Map([
  ...ASSET_DECLINE_REASONS.map((r) => [r.value, r.label] as [string, string]),
  ...BID_DECLINE_REASONS.map((r) => [r.value, r.label] as [string, string]),
  ...DEMAND_DECLINE_REASONS.map((r) => [r.value, r.label] as [string, string]),
]);

export function reasonLabel(category: string | null): string {
  if (!category) return NOT_CATEGORIZED_LABEL;
  return REASON_LABELS.get(category) ?? NOT_CATEGORIZED_LABEL;
}

/** Contagem por motivo: contagem decrescente, desempate por rotulo em portugues (localeCompare pt-BR). */
export function buildReasons(categories: (string | null)[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of categories) {
    const label = reasonLabel(c);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"));
}
