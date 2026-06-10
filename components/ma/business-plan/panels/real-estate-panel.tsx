"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, RefreshCw, ShieldCheck, FlaskConical } from "lucide-react";
import type { GeneratedPlan } from "@/lib/ma/business-plan-engine/generate";
import type { RealEstateFinancialProjections } from "@/lib/ma/business-plan-schemas/real-estate-v1";
import type { DREEntry, DFCEntry, IndicadoresBase } from "@/types/financial";
import { enrichREProjections } from "@/lib/ma/business-plan-engine/enrich";
import {
  ChartReceita, ChartNOI, ChartVacancia, ChartCenarios,
  ChartDRE, ChartDFC,
} from "@/components/ma/business-plan/charts/real-estate-charts";

const C = {
  nb: "#13223A", nc: "#162744", nm: "#243A66",
  go: "#C9A84C", gl: "#E8C97A", cr: "#F5F1E8", mu: "#9BAFC5",
};

const fmtBRL = (n: unknown) =>
  typeof n === "number"
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : String(n ?? "—");

const fmtPct = (n: unknown) => (typeof n === "number" ? `${n.toFixed(1)}%` : String(n ?? "—"));

function getByPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

interface EnrichedComparison {
  original_sections: number;
  enriched_sections: number;
  original_claims: number;
  enriched_claims: number;
}

interface Props {
  plan: GeneratedPlan;
  dealCode?: string;
  dealId: string;
  financialProjections: RealEstateFinancialProjections;
  canGenerate: boolean;
  onRegenerate: () => Promise<void>;
}

export function RealEstatePanel({
  plan,
  dealCode,
  dealId,
  financialProjections,
  canGenerate,
  onRegenerate,
}: Props) {
  const [auditOpen, setAuditOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [modelando, setModelando] = useState(false);
  const [enrichedPlan, setEnrichedPlan] = useState<GeneratedPlan | null>(null);
  const [enrichedComparison, setEnrichedComparison] = useState<EnrichedComparison | null>(null);

  const sourcePayload = { financial_projections: financialProjections } as unknown as Record<string, unknown>;

  const enrichedFP = useMemo(
    () => (enrichedPlan ? enrichREProjections(financialProjections) : null),
    [enrichedPlan, financialProjections]
  );

  useEffect(() => {
    let cancelled = false;
    async function checkDrift() {
      if (!plan.source_hash || !crypto?.subtle) return;
      const json = JSON.stringify(financialProjections);
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
      const hash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
      if (!cancelled) setIsStale(hash !== plan.source_hash);
    }
    checkDrift();
    return () => { cancelled = true; };
  }, [plan.source_hash, financialProjections]);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  }

  async function handleModel3S() {
    setModelando(true);
    setEnrichedPlan(null);
    setEnrichedComparison(null);
    try {
      const res = await fetch(
        `/api/ma/business-plan/${dealId}/generate?mode=model3s`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
      );
      if (!res.ok) return;
      const json = await res.json();
      if (json.business_plan) {
        setEnrichedPlan(json.business_plan as GeneratedPlan);
        setEnrichedComparison(json.comparison ?? null);
      }
    } finally {
      setModelando(false);
    }
  }

  const kpis: { label: string; claimSourcePath: string; format: (v: unknown) => string }[] = [
    { label: "Valuation Base", claimSourcePath: "financial_projections.scenarios.base.valuation", format: fmtBRL },
    { label: "NOI Anual Base", claimSourcePath: "financial_projections.scenarios.base.noi_anual", format: fmtBRL },
    { label: "Cap Rate Base", claimSourcePath: "financial_projections.scenarios.base.cap_rate", format: (v) => typeof v === "number" ? `${(v * 100).toFixed(2)}%` : "—" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold" style={{ color: C.cr }}>
            Business Plan {dealCode ? `· ${dealCode}` : ""}
          </h3>
          <p className="mt-0.5 text-[10px] uppercase tracking-widest font-bold" style={{ color: C.gl }}>
            Gerado em {new Date(plan.generated_at).toLocaleString("pt-BR")} · {plan.model}
          </p>
        </div>
        {canGenerate && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleModel3S}
              disabled={modelando || regenerating}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
              style={{ borderColor: "#6366F1", color: "#a5b4fc" }}
            >
              {modelando ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />}
              Modelo 3-Statement
            </button>
            <button
              onClick={handleRegenerate}
              disabled={regenerating || modelando}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
              style={{ borderColor: C.go, color: C.gl }}
            >
              {regenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Regenerar
            </button>
          </div>
        )}
      </div>

      {isStale && (
        <div className="rounded-lg border px-4 py-2.5" style={{ borderColor: "#EF4444", background: "rgba(239,68,68,.08)" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#EF4444" }}>
            Plano desatualizado — os dados financeiros mudaram desde a última geração. Regenerar?
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map((kpi) => {
          const value = getByPath(sourcePayload, kpi.claimSourcePath);
          return (
            <div key={kpi.label} className="rounded-xl border px-4 py-3" style={{ background: C.nc, borderColor: C.nm }}>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.gl }}>
                {kpi.label}
              </p>
              <p className="mt-1 text-lg font-bold" style={{ color: C.cr }}>
                {kpi.format(value)}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Gráficos operacionais permanentes ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChartReceita fp={financialProjections} />
        <ChartNOI fp={financialProjections} />
        <ChartVacancia fp={financialProjections} />
        <ChartCenarios fp={financialProjections} />
      </div>

      <div className="flex flex-col gap-4">
        {plan.narrative_sections.map((section, i) => (
          <div key={i} className="rounded-xl border px-5 py-4" style={{ background: C.nb, borderColor: C.nm }}>
            <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.go }}>
              {section.title}
            </h4>
            <div className="mt-2 flex flex-col gap-2 text-xs leading-relaxed" style={{ color: C.mu }}>
              {section.body.split(/\n{2,}/).map((para, j) => (
                <p key={j}>{para}</p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Modelo 3-Statement (preview — não salvo) ── */}
      {enrichedPlan && (
        <div className="flex flex-col gap-4 rounded-xl border-2 px-5 py-4" style={{ borderColor: "#6366F1", background: "rgba(99,102,241,.06)" }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a5b4fc" }}>
                Modelo 3-Statement · PREVIEW — não salvo
              </p>
              {enrichedComparison && (
                <p className="mt-0.5 text-[9px]" style={{ color: C.mu }}>
                  Seções: {enrichedComparison.original_sections} → {enrichedComparison.enriched_sections} ·
                  Claims: {enrichedComparison.original_claims} → {enrichedComparison.enriched_claims}
                </p>
              )}
            </div>
            <button
              onClick={() => { setEnrichedPlan(null); setEnrichedComparison(null); }}
              className="text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded border"
              style={{ borderColor: "#6366F1", color: "#a5b4fc" }}
            >
              Fechar
            </button>
          </div>

          {/* Indicadores IRR / Payback / WCC */}
          {(enrichedPlan as GeneratedPlan & { _enriched_payload?: { indicadores?: IndicadoresBase } })._enriched_payload?.indicadores && (() => {
            const ind = (enrichedPlan as GeneratedPlan & { _enriched_payload?: { indicadores?: IndicadoresBase } })._enriched_payload!.indicadores!;
            return (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: "TIR (IRR) — 10 anos", value: `${(ind.irr * 100).toFixed(1)}% a.a.` },
                  { label: "Payback Nominal", value: `${ind.payback_nominal} anos` },
                  { label: "Ciclo de Capital de Giro", value: `${ind.working_capital_cycle_days} dias` },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border px-3 py-2" style={{ borderColor: "#6366F1" }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "#a5b4fc" }}>{item.label}</p>
                    <p className="mt-1 text-base font-bold" style={{ color: C.cr }}>{item.value}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Narrativa enriquecida */}
          <div className="flex flex-col gap-3">
            {enrichedPlan.narrative_sections.map((section, i) => (
              <div key={i} className="rounded-lg border px-4 py-3" style={{ background: C.nb, borderColor: "#4338ca" }}>
                <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#a5b4fc" }}>{section.title}</h4>
                <div className="mt-2 flex flex-col gap-2 text-xs leading-relaxed" style={{ color: C.mu }}>
                  {section.body.split(/\n{2,}/).map((para, j) => <p key={j}>{para}</p>)}
                </div>
              </div>
            ))}
          </div>

          {/* Gráficos 3-Statement */}
          {enrichedFP && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ChartDRE dre={enrichedFP.dre_projetada} />
              <ChartDFC dfc={enrichedFP.dfc_projetada} />
            </div>
          )}

          {/* Auditoria enriquecida */}
          <p className="text-[9px] font-mono" style={{ color: C.mu }}>
            <ShieldCheck size={10} className="inline mr-1" style={{ color: "#6366F1" }} />
            {enrichedPlan.claim_trace.length} afirmações rastreadas · dados derivados matematicamente dos dados operacionais
          </p>
        </div>
      )}

      {financialProjections.scenarios && Object.keys(financialProjections.scenarios).length > 0 && (
        <div className="rounded-xl border px-5 py-4" style={{ background: C.nc, borderColor: C.nm }}>
          <h4 className="text-xs font-bold uppercase tracking-widest" style={{ color: C.go }}>
            Cenários Projetados
          </h4>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Object.entries(financialProjections.scenarios).map(([nome, scenario]) => (
              <div key={nome} className="rounded-lg border px-3 py-2" style={{ borderColor: C.nm }}>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.gl }}>
                  {nome}
                </p>
                {scenario.valuation !== undefined && (
                  <p className="mt-1 text-xs" style={{ color: C.cr }}>
                    Valuation: {fmtBRL(scenario.valuation)}
                  </p>
                )}
                {scenario.noi_anual !== undefined && (
                  <p className="text-xs" style={{ color: C.mu }}>
                    NOI: {fmtBRL(scenario.noi_anual)}
                  </p>
                )}
                {scenario.cap_rate !== undefined && (
                  <p className="text-xs" style={{ color: C.mu }}>
                    Cap Rate: {(scenario.cap_rate * 100).toFixed(2)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border" style={{ borderColor: C.nm, background: C.nc }}>
        <button
          onClick={() => setAuditOpen((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-left"
        >
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: C.gl }}>
            <ShieldCheck size={14} color={C.go} />
            Auditoria · {plan.claim_trace.length} afirmações rastreadas
          </span>
          <ChevronDown
            size={14}
            color={C.mu}
            style={{ transform: auditOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}
          />
        </button>
        {auditOpen && (
          <div className="flex flex-col gap-2 border-t px-5 py-4" style={{ borderColor: C.nm }}>
            {plan.claim_trace.map((claim, i) => (
              <div key={i} className="text-xs" style={{ color: C.mu }}>
                <span style={{ color: C.cr }}>{claim.claim}</span>
                <span className="ml-2 text-[10px] font-mono" style={{ color: C.gl }}>
                  {claim.source_path} = {String(claim.source_value)}
                </span>
              </div>
            ))}
            <p className="mt-2 text-[9px] font-mono" style={{ color: C.mu }}>
              source_hash: {plan.source_hash} · deal {dealId.slice(0, 8).toUpperCase()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
