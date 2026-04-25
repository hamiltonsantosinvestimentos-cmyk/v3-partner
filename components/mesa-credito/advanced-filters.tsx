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

const STAGES = ["RECEBIDO", "TRIAGEM", "ANALISE", "PENDENCIA", "APROVACAO", "FINALIZADO"];
const STAGE_LABELS: Record<string, string> = {
  RECEBIDO: "Recebido", TRIAGEM: "Triagem", ANALISE: "Análise de Crédito",
  PENDENCIA: "Pendência de Docs", APROVACAO: "Em Aprovação", FINALIZADO: "Finalizado",
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

export type SLAStatus = "ok" | "warning" | "critical";

export function getSLAInfo(proposal: { created_at: string; status: string; stage?: string }): {
  days: number; sla: SLAStatus;
} {
  const finals = ["APPROVED", "REJECTED", "COMPLETED", "CANCELLED"];
  const days = Math.floor((Date.now() - new Date(proposal.created_at).getTime()) / 86400000);
  if (finals.includes(proposal.status) || proposal.stage === "FINALIZADO") {
    return { days, sla: "ok" };
  }
  if (days >= 10) return { days, sla: "critical" };
  if (days >= 5)  return { days, sla: "warning" };
  return { days, sla: "ok" };
}

export function SLABadge({ days, sla }: { days: number; sla: SLAStatus }) {
  if (sla === "ok") return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded ml-1 ${
      sla === "critical"
        ? "bg-red-500/20 text-red-400 border border-red-500/30"
        : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
    }`}>
      ⚠ {days}d
    </span>
  );
}
