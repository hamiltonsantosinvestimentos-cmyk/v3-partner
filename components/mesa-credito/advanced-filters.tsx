"use client";

import React, { useState } from "react";
import { Search, Filter, X, ChevronDown, ChevronUp } from "lucide-react";

export interface FilterState {
  search: string;
  creditLine: string;
  status: string;
  stage: string;
  valueMin: string;
  valueMax: string;
  dateFrom: string;
  dateTo: string;
  partner: string;
}

export const EMPTY_FILTERS: FilterState = {
  search: "", creditLine: "", status: "", stage: "",
  valueMin: "", valueMax: "", dateFrom: "", dateTo: "", partner: "",
};

const STAGES = ["RECEBIDO", "TRIAGEM", "ANALISE", "PENDENCIA", "AVALIACAO_IMOVEL", "APROVACAO", "CONTRATO_ASSINADO", "REGISTRO_IMOVEL", "LIBERADO", "REPROVADO", "FINALIZADO"];
const STAGE_LABELS: Record<string, string> = {
  RECEBIDO: "Recebido", TRIAGEM: "Triagem", ANALISE: "Análise de Crédito",
  PENDENCIA: "Pendência de Docs", AVALIACAO_IMOVEL: "Avaliação de Imóvel", APROVACAO: "Em Aprovação",
  CONTRATO_ASSINADO: "Contrato Assinado", REGISTRO_IMOVEL: "Registro de Imóveis",
  LIBERADO: "Recurso Liberado", REPROVADO: "Reprovado", FINALIZADO: "Finalizado",
};

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  creditLines: string[];
  isAdmin?: boolean;
}

export function AdvancedFilters({ filters, onChange, creditLines, isAdmin }: Props) {
  const [open, setOpen] = useState(false);

  const set = (k: keyof FilterState) => (v: string) => onChange({ ...filters, [k]: v });

  const activeCount = Object.entries(filters)
    .filter(([k, v]) => k !== "search" && v !== "").length;
  const hasActive = activeCount > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {/* Busca */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(e) => set("search")(e.target.value)}
            placeholder="Buscar por cliente, código, título..."
            className="w-full h-9 pl-9 pr-8 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {filters.search && (
            <button onClick={() => set("search")("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Toggle filtros avançados */}
        <button onClick={() => setOpen(!open)}
          className={`flex items-center gap-1.5 h-9 px-3 text-sm rounded-lg border transition-all ${
            hasActive
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-secondary border-border text-muted-foreground hover:text-foreground"
          }`}>
          <Filter className="w-3.5 h-3.5" />
          Filtros
          {activeCount > 0 && (
            <span className="bg-primary text-background text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {activeCount}
            </span>
          )}
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {hasActive && (
          <button
            onClick={() => onChange({ ...EMPTY_FILTERS, search: filters.search })}
            className="flex items-center gap-1.5 h-9 px-3 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
            <X className="w-3.5 h-3.5" /> Limpar filtros
          </button>
        )}
      </div>

      {/* Painel de filtros avançados */}
      {open && (
        <div className="p-4 rounded-xl bg-secondary/40 border border-border/60 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Linha de Crédito
            </label>
            <select value={filters.creditLine} onChange={(e) => set("creditLine")(e.target.value)}
              className="w-full h-8 px-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
              <option value="">Todas</option>
              {creditLines.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Status
            </label>
            <select value={filters.status} onChange={(e) => set("status")(e.target.value)}
              className="w-full h-8 px-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
              <option value="">Todos</option>
              <option value="PENDING">Pendente</option>
              <option value="IN_REVIEW">Em Análise</option>
              <option value="APPROVED">Aprovado</option>
              <option value="REJECTED">Reprovado</option>
              <option value="COMPLETED">Concluído</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Etapa do Pipeline
            </label>
            <select value={filters.stage} onChange={(e) => set("stage")(e.target.value)}
              className="w-full h-8 px-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40">
              <option value="">Todas</option>
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>

          {isAdmin && (
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                Parceiro
              </label>
              <input
                value={filters.partner}
                onChange={(e) => set("partner")(e.target.value)}
                placeholder="Nome do parceiro..."
                className="w-full h-8 px-2 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Valor Mínimo (R$)
            </label>
            <input
              type="number" min="0" step="1000"
              value={filters.valueMin}
              onChange={(e) => set("valueMin")(e.target.value)}
              placeholder="0"
              className="w-full h-8 px-2 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Valor Máximo (R$)
            </label>
            <input
              type="number" min="0" step="1000"
              value={filters.valueMax}
              onChange={(e) => set("valueMax")(e.target.value)}
              placeholder="Sem limite"
              className="w-full h-8 px-2 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Data De
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => set("dateFrom")(e.target.value)}
              className="w-full h-8 px-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
              Data Até
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => set("dateTo")(e.target.value)}
              className="w-full h-8 px-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Utilitários compartilhados ────────────────────────────────────────────────

export function applyFilters<T extends {
  client_name: string; code: string; title: string;
  credit_line: string; status: string; stage?: string;
  requested_value: number; created_at: string; partner_name?: string;
}>(proposals: T[], f: FilterState): T[] {
  return proposals.filter((p) => {
    if (f.search) {
      const q = f.search.toLowerCase();
      if (
        !p.client_name.toLowerCase().includes(q) &&
        !p.code.toLowerCase().includes(q) &&
        !p.title.toLowerCase().includes(q)
      ) return false;
    }
    if (f.creditLine && p.credit_line !== f.creditLine) return false;
    if (f.status && p.status !== f.status) return false;
    if (f.stage && (p.stage ?? "RECEBIDO") !== f.stage) return false;
    if (f.valueMin !== "" && p.requested_value < Number(f.valueMin)) return false;
    if (f.valueMax !== "" && p.requested_value > Number(f.valueMax)) return false;
    if (f.dateFrom && new Date(p.created_at) < new Date(f.dateFrom)) return false;
    if (f.dateTo && new Date(p.created_at) > new Date(f.dateTo + "T23:59:59")) return false;
    if (f.partner && !(p.partner_name ?? "").toLowerCase().includes(f.partner.toLowerCase())) return false;
    return true;
  });
}

export type SLAStatus = "ok" | "warning" | "critical" | "expired";

// SLA em horas úteis por etapa (seg–sex, 08h–18h = 10h úteis/dia)
export const SLA_HOURS_BY_STAGE: Record<string, number> = {
  RECEBIDO:          20,   // 2 dias úteis
  TRIAGEM:           20,   // 2 dias úteis
  ANALISE:           70,   // 7 dias úteis
  PENDENCIA:         20,   // 2 dias úteis
  AVALIACAO_IMOVEL: 150,   // 15 dias
  APROVACAO:         30,   // 3 dias úteis
  CONTRATO_ASSINADO: 50,   // 5 dias
  REGISTRO_IMOVEL:  300,   // 30 dias
  LIBERADO:          30,   // 3 dias
  REPROVADO:  Infinity,
  FINALIZADO: Infinity,
};

// Fuso horário de Brasília (UTC-3)
const BRT_OFFSET_MS = -3 * 60 * 60 * 1000;

/**
 * Calcula horas úteis decorridas entre `from` e `to`
 * Expediente: segunda a sexta, 08:00–18:00 (horário de Brasília)
 */
function businessHoursElapsed(from: Date, to: Date): number {
  if (to <= from) return 0;

  const WORK_START = 8;   // 08:00
  const WORK_END   = 18;  // 18:00
  const WORK_HOURS = WORK_END - WORK_START; // 10h/dia

  let elapsed = 0;
  // Avança minuto a minuto seria lento — avança hora a hora
  let cursor = new Date(from.getTime());

  // Ajusta cursor para horário de Brasília usando offset
  const toBRT = (d: Date) => new Date(d.getTime() + BRT_OFFSET_MS);

  // Avança até o início do próximo período útil se necessário
  const snapToWorkStart = (d: Date): Date => {
    const brt = toBRT(d);
    const day = brt.getUTCDay(); // 0=dom, 6=sáb
    const hour = brt.getUTCHours();

    // Fim de semana: avança para segunda 08:00
    if (day === 0 || day === 6) {
      const daysToMon = day === 0 ? 1 : 2;
      const next = new Date(d);
      next.setTime(
        new Date(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate() + daysToMon, WORK_START, 0, 0, 0).getTime() - BRT_OFFSET_MS
      );
      return next;
    }
    // Antes do expediente: avança para 08:00
    if (hour < WORK_START) {
      const next = new Date(d);
      next.setTime(
        new Date(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), WORK_START, 0, 0, 0).getTime() - BRT_OFFSET_MS
      );
      return next;
    }
    // Após expediente ou sexta noite: avança para próximo dia útil 08:00
    if (hour >= WORK_END) {
      const daysAhead = day === 5 ? 3 : 1; // sexta → segunda
      const next = new Date(d);
      next.setTime(
        new Date(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate() + daysAhead, WORK_START, 0, 0, 0).getTime() - BRT_OFFSET_MS
      );
      return next;
    }
    return d;
  };

  cursor = snapToWorkStart(cursor);
  if (cursor >= to) return 0;

  while (cursor < to) {
    const brt     = toBRT(cursor);
    const day     = brt.getUTCDay();
    const hour    = brt.getUTCHours();

    // Se fora do expediente, pula para o próximo slot útil
    if (day === 0 || day === 6 || hour < WORK_START || hour >= WORK_END) {
      cursor = snapToWorkStart(cursor);
      continue;
    }

    // Fim do expediente de hoje (em UTC)
    const endOfDayBRT = new Date(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate(), WORK_END, 0, 0, 0);
    const endOfDay    = new Date(endOfDayBRT.getTime() - BRT_OFFSET_MS);

    const chunkEnd = to < endOfDay ? to : endOfDay;
    elapsed += (chunkEnd.getTime() - cursor.getTime()) / 3600000;
    cursor   = snapToWorkStart(chunkEnd);
  }

  return Math.max(elapsed, 0);
}

export interface SLAInfo {
  hoursElapsed: number;   // horas úteis na etapa atual
  hoursLimit:   number;   // limite da etapa em horas úteis
  hoursLeft:    number;   // horas úteis restantes (negativo = vencido)
  pct:          number;   // 0-100 % consumido
  sla:          SLAStatus;
  stage:        string;
  stageChangedAt: string | null;
  targetDate:   string | null;  // data-alvo definida na mesa operacional (sla_override)
}

export function getSLAInfo(proposal: {
  created_at: string;
  status: string;
  stage?: string;
  metadata?: Record<string, unknown> | null;
}): SLAInfo {
  const finals = ["APPROVED", "REJECTED", "COMPLETED", "CANCELLED"];
  const stage  = proposal.stage ?? "RECEBIDO";

  if (finals.includes(proposal.status) || stage === "FINALIZADO") {
    return { hoursElapsed: 0, hoursLimit: Infinity, hoursLeft: Infinity, pct: 0, sla: "ok", stage, stageChangedAt: null, targetDate: null };
  }

  // Data-alvo definida na mesa operacional via sla_override
  const slaOverride = proposal.metadata?.sla_override as Record<string, string> | null | undefined;
  const targetDate  = slaOverride?.[stage] ?? null;

  const stageChangedAt = (proposal.metadata?.stage_changed_at as string | null) ?? null;
  const now = new Date();

  // Se há data definida na mesa operacional, usa ela como referência principal
  if (targetDate) {
    const deadline = new Date(targetDate + "T23:59:59-03:00");
    const totalMs  = deadline.getTime() - new Date(stageChangedAt ?? proposal.created_at).getTime();
    const leftMs   = deadline.getTime() - now.getTime();
    const pct      = Math.min(Math.round(((totalMs - leftMs) / totalMs) * 100), 100);
    const daysLeft = leftMs / (1000 * 60 * 60 * 24);

    let sla: SLAStatus = "ok";
    if (daysLeft < 0)      sla = "expired";
    else if (daysLeft <= 1) sla = "critical";
    else if (daysLeft <= 3) sla = "warning";

    // hoursLeft em horas para compatibilidade com fmtHours
    const hoursLeft = leftMs / (1000 * 60 * 60);
    return { hoursElapsed: (totalMs - leftMs) / (1000 * 60 * 60), hoursLimit: totalMs / (1000 * 60 * 60), hoursLeft, pct, sla, stage, stageChangedAt, targetDate };
  }

  // Fallback: cálculo por horas úteis quando não há data definida na mesa
  const baseDate     = stageChangedAt ? new Date(stageChangedAt) : new Date(proposal.created_at);
  const hoursElapsed = businessHoursElapsed(baseDate, now);
  const hoursLimit   = SLA_HOURS_BY_STAGE[stage] ?? 20;
  const hoursLeft    = hoursLimit - hoursElapsed;
  const pct          = Math.min(Math.round((hoursElapsed / hoursLimit) * 100), 100);

  let sla: SLAStatus = "ok";
  if (hoursLeft <= 0)                         sla = "expired";
  else if (hoursLeft <= hoursLimit * 0.2)     sla = "critical";
  else if (hoursLeft <= hoursLimit * 0.5)     sla = "warning";

  return { hoursElapsed, hoursLimit, hoursLeft, pct, sla, stage, stageChangedAt, targetDate };
}

function fmtHours(h: number): string {
  if (h <= 0) {
    const abs = Math.abs(h);
    if (abs < 1) return `${Math.round(abs * 60)}min vencido`;
    if (abs < 24) return `${Math.round(abs)}h vencido`;
    return `${Math.round(abs / 24)}d vencido`;
  }
  if (h < 1)  return `${Math.round(h * 60)}min`;
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d`;
}

/** Data-alvo de SLA definida na mesa operacional. Sempre visível quando presente. */
export function SLATargetDate({ targetDate }: { targetDate: string | null }) {
  if (!targetDate) return null;
  const date = new Date(targetDate + "T00:00:00-03:00");
  const now  = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  let colorClass = "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (diffDays < 0)      colorClass = "text-red-400 border-red-500/30 bg-red-500/10";
  else if (diffDays <= 1) colorClass = "text-red-400 border-red-500/30 bg-red-500/10";
  else if (diffDays <= 3) colorClass = "text-amber-400 border-amber-500/30 bg-amber-500/10";

  const diffLabel = diffDays < 0
    ? `venceu há ${Math.abs(diffDays)}d`
    : diffDays === 0 ? "hoje"
    : `${diffDays}d restantes`;

  return (
    <span
      title={`Retorno SLA: ${date.toLocaleDateString("pt-BR")} — ${diffLabel}`}
      className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${colorClass}`}
    >
      📅 {label}
    </span>
  );
}

export function SLABadge({ sla, hoursLeft, hoursLimit, pct }: {
  sla: SLAStatus; hoursLeft: number; hoursLimit: number; pct: number;
}) {
  if (sla === "ok") return null;

  const configs = {
    expired:  { bg: "bg-red-600/25",   text: "text-red-400",   border: "border-red-500/40",   label: `⏰ ${fmtHours(hoursLeft)}` },
    critical: { bg: "bg-red-500/20",   text: "text-red-400",   border: "border-red-500/30",   label: `⚠ ${fmtHours(hoursLeft)}` },
    warning:  { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30", label: `⏱ ${fmtHours(hoursLeft)}` },
    ok:       { bg: "", text: "", border: "", label: "" },
  };
  const c = configs[sla];

  return (
    <span title={`SLA: ${pct}% consumido — Limite: ${fmtHours(hoursLimit)}`}
      className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ml-1 border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  );
}
