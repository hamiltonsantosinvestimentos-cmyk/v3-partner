"use client";

import { useState, useEffect, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, ExternalLink, FileText,
  TrendingUp, DollarSign, Target, Award, RefreshCw,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

// ─── Etapas unificadas M&A ────────────────────────────────────────────────────
export const MA_PIPELINE = [
  { id: "prospeccao",    label: "Prospecção",                   color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  { id: "qualificacao",  label: "Qualificação",                 color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  { id: "viabilidade",   label: "Análise de Viabilidade",       color: "#06B6D4", bg: "rgba(6,182,212,0.12)"  },
  { id: "estruturacao",  label: "Estruturação da Oferta",       color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  { id: "negociacao",    label: "Negociação",                   color: "#EF4444", bg: "rgba(239,68,68,0.12)"  },
  { id: "due_diligence", label: "Due Diligence",                color: "#C4922E", bg: "rgba(196,146,46,0.12)" },
  { id: "aprovacao",     label: "Aprovação Final e Fechamento", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
];

// Mapeia deal_stage ENUM do BD para os IDs do pipeline
const STAGE_MAP: Record<string, string> = {
  PROSPECTING:   "prospeccao",
  QUALIFICATION: "qualificacao",
  IOI:           "viabilidade",
  DUE_DILIGENCE: "due_diligence",
  PROPOSAL:      "estruturacao",
  NEGOTIATION:   "negociacao",
  CLOSING:       "aprovacao",
  CLOSED_WON:    "aprovacao",
  CLOSED_LOST:   "aprovacao",
};

function normalizeStage(stage: string): string {
  return STAGE_MAP[stage] ?? "prospeccao";
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface MaDeal {
  id: string;
  code: string;
  target_company: string;
  sector?: string | null;
  deal_value?: number | null;
  ebitda_multiple?: number | null;
  stage: string;
  probability_percent?: number | null;
  created_at?: string;
  title?: string;
  responsible?: string | null;
}

// ─── Kanban Card ─────────────────────────────────────────────────────────────
function KanbanDealCard({ deal, stage }: { deal: MaDeal & { stage: string }; stage: typeof MA_PIPELINE[0] | undefined }) {
  return (
    <div className="rounded-lg border border-[#122036] bg-[#091221] p-3 hover:border-[#C4922E]/50 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-[#E8EDF5] leading-tight line-clamp-2">{deal.target_company}</p>
        <span className="text-[10px] text-[#5A7490] flex-shrink-0">{deal.code}</span>
      </div>
      {deal.sector && (
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full border mb-2"
          style={{ color: stage?.color ?? "#C4922E", borderColor: `${stage?.color ?? "#C4922E"}40`, background: stage?.bg ?? "rgba(196,146,46,0.1)" }}>
          {deal.sector}
        </span>
      )}
      {deal.deal_value ? (
        <p className="text-sm font-bold text-[#C4922E] mb-2">{formatCurrency(deal.deal_value)}</p>
      ) : null}
      {deal.probability_percent != null && (
        <div>
          <div className="flex justify-between mb-0.5">
            <span className="text-[10px] text-[#5A7490]">Prob.</span>
            <span className="text-[10px] font-medium" style={{ color: deal.probability_percent >= 70 ? "#10B981" : deal.probability_percent >= 40 ? "#F59E0B" : "#EF4444" }}>
              {deal.probability_percent}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-[#122036] overflow-hidden">
            <div className="h-full rounded-full" style={{
              width: `${deal.probability_percent}%`,
              background: deal.probability_percent >= 70 ? "#10B981" : deal.probability_percent >= 40 ? "#F59E0B" : "#EF4444",
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface MaClientProps {
  deals: MaDeal[];
  userId?: string;
  pipefyCfg?: { token?: string; pipeId?: string; formUrl?: string } | null;
}

export function MaClient({ deals, userId = "", pipefyCfg }: MaClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pipefyFormUrl, setPipefyFormUrl] = useState(pipefyCfg?.formUrl ?? "");
  const [syncError, setSyncError] = useState<string | null>(null);
  const syncedOnMount = useRef(false);

  const syncFromPipefy = useCallback(async (token: string, pipeId: string) => {
    setSyncError(null);
    try {
      const res = await fetch("/api/pipefy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_ma", token, pipeId, userId }),
      });
      const data = await res.json();
      if (data.success) {
        startTransition(() => router.refresh());
      } else {
        setSyncError(data.error ?? "Erro na sincronização");
      }
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Erro na sincronização");
    }
  }, [router, userId]);

  // Sync automático no mount — prioridade: prop do servidor > localStorage
  useEffect(() => {
    if (syncedOnMount.current) return;

    // 1. Config vinda do servidor (app_config no banco)
    if (pipefyCfg?.token && pipefyCfg?.pipeId) {
      syncedOnMount.current = true;
      syncFromPipefy(pipefyCfg.token, pipefyCfg.pipeId);
      return;
    }

    // 2. Fallback: localStorage (para admins que configuraram pelo Mesa M&A)
    try {
      const saved = localStorage.getItem("v3_pipefy_mesa_ma");
      if (saved) {
        const config = JSON.parse(saved);
        if (config.formUrl) setPipefyFormUrl(config.formUrl);
        if (config.token && config.pipeId) {
          syncedOnMount.current = true;
          syncFromPipefy(config.token, config.pipeId);
        }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizedDeals = deals.map(d => ({ ...d, stage: normalizeStage(d.stage) }));
  const totalValue = deals.reduce((s, d) => s + (d.deal_value ?? 0), 0);
  const activeDeals = normalizedDeals.filter(d => d.stage !== "aprovacao").length;
  const closedDeals = normalizedDeals.filter(d => d.stage === "aprovacao").length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#C4922E]/15 flex items-center justify-center">
            <Building2 size={18} className="text-[#C4922E]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">M&A — Minhas Operações</h1>
            <p className="text-xs text-[#5A7490]">Seus deals no pipeline de fusões e aquisições</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              syncedOnMount.current = false;
              startTransition(() => router.refresh());
            }}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-[#122036] bg-[#091221] text-xs px-3 py-2 text-[#5A7490] hover:text-[#C4922E] hover:border-[#C4922E]/40 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={isPending ? "animate-spin" : ""} />
            {isPending ? "Atualizando..." : "Atualizar"}
          </button>
          <button
            onClick={() => {
              if (pipefyFormUrl) {
                window.open(pipefyFormUrl, "_blank");
              }
            }}
            disabled={!pipefyFormUrl}
            className="flex items-center gap-2 rounded-lg bg-[#C4922E] text-[#050C18] text-xs font-semibold px-4 py-2 hover:bg-[#E5B96A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            Nova Operação
          </button>
        </div>
      </div>

      {syncError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {syncError}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total de Deals", value: deals.length, icon: <Target size={16} />, color: "text-purple-400", accent: "#8B5CF6" },
          { label: "Volume Total", value: formatCurrency(totalValue), icon: <DollarSign size={16} />, color: "text-[#C4922E]", accent: "#C4922E" },
          { label: "Em Andamento", value: activeDeals, icon: <TrendingUp size={16} />, color: "text-amber-400", accent: "#F59E0B" },
          { label: "Concluídos", value: closedDeals, icon: <Award size={16} />, color: "text-emerald-400", accent: "#10B981" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-[#122036] bg-[#091221] p-4 flex items-center gap-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px]"
              style={{ background: `linear-gradient(90deg, transparent, ${kpi.accent}44, transparent)` }} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${kpi.accent}18`, color: kpi.accent }}>
              {kpi.icon}
            </div>
            <div>
              <p className="text-xs text-[#5A7490]">{kpi.label}</p>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      {normalizedDeals.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[#122036]">
          <Building2 size={32} className="text-[#5A7490] mx-auto mb-3 opacity-40" />
          <p className="text-[#5A7490] text-sm">Nenhuma operação encontrada.</p>
          {pipefyFormUrl && (
            <button onClick={() => window.open(pipefyFormUrl, "_blank")} className="mt-4 text-xs text-[#C4922E] hover:underline">
              + Submeter nova operação via Pipefy
            </button>
          )}
          {!pipefyCfg?.token && (
            <p className="mt-2 text-xs text-[#5A7490]">
              Configure o Pipefy na <span className="text-[#C4922E]">Mesa M&A</span> para sincronizar.
            </p>
          )}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {MA_PIPELINE.map(stage => {
            const stageDeals = normalizedDeals.filter(d => d.stage === stage.id);
            return (
              <div key={stage.id} className="flex-shrink-0 w-60">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                  <span className="text-xs font-semibold text-[#E8EDF5] flex-1 truncate">{stage.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ color: stage.color, background: stage.bg }}>
                    {stageDeals.length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[80px] rounded-xl border border-[#122036]/60 bg-[#050C18]/50 p-2">
                  {stageDeals.map(deal => (
                    <KanbanDealCard key={deal.id} deal={deal} stage={stage} />
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="h-14 flex items-center justify-center">
                      <p className="text-[11px] text-[#5A7490]">Sem operações</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Aviso se formUrl não configurado */}
      {!pipefyFormUrl && normalizedDeals.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <FileText size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-400">Formulário Pipefy não configurado</p>
            <p className="text-xs text-[#5A7490] mt-0.5">
              Acesse <span className="text-[#C4922E]">Mesa M&A → aba Pipefy</span> e configure o link do formulário público para submeter novos deals.
            </p>
          </div>
        </div>
      )}

      {/* Link externo caso tenha formUrl */}
      {pipefyFormUrl && normalizedDeals.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={() => window.open(pipefyFormUrl, "_blank")}
            className="flex items-center gap-2 text-xs text-[#5A7490] hover:text-[#C4922E] transition-colors"
          >
            <ExternalLink size={12} />
            Submeter nova operação via Pipefy
          </button>
        </div>
      )}
    </div>
  );
}
