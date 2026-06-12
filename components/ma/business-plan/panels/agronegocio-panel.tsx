"use client";

import { useState } from "react";
import { Loader2, TrendingUp, DollarSign, BarChart2, Shield } from "lucide-react";
import type { GeneratedPlan } from "@/lib/ma/business-plan-engine/generate";
import type { AgronegocioFinancialProjections } from "@/lib/ma/business-plan-schemas/agronegocio-v1";
import {
  ChartTimeSeries,
  ChartCenariosAgrupado,
  type ChartRow,
} from "@/components/ma/business-plan/charts/dynamic-metrics-charts";

const C = {
  nd: "#09081A", nc: "#162744", nm: "#243A66",
  go: "#C9A84C", gl: "#E8C97A", cr: "#F5F1E8", mu: "#9BAFC5",
};

const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtBRL2 = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (v: number) => `${v.toFixed(1)}%`;
const fmtArroba = (v: number) => `${v.toFixed(2)} @`;
const fmtM = (v: number) =>
  v >= 1e9 ? `R$${(v / 1e9).toFixed(1)}Bi`
  : v >= 1e6 ? `R$${(v / 1e6).toFixed(1)}M`
  : `R$${(v / 1e3).toFixed(0)}K`;

interface Props {
  plan: GeneratedPlan;
  dealId: string;
  dealCode?: string;
  financialProjections: AgronegocioFinancialProjections;
  canGenerate: boolean;
  onRegenerate: () => Promise<void>;
}

export function AgronegocionPanel({ plan, financialProjections: fp, canGenerate, onRegenerate }: Props) {
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegen() {
    setRegenerating(true);
    await onRegenerate();
    setRegenerating(false);
  }

  const ano0 = fp.anos?.[0];
  const ano5 = fp.anos?.[4];
  const hedge = fp.hedge_analysis as Record<string, unknown> | null | undefined;
  const bgi = fp.viabilidade_bgi as Record<string, unknown> | undefined;

  // Detect sector-specific metrics for conditional chart rendering.
  // Check presence of keys in anos[0] (commodity fields) or indicadores (securitização).
  const firstYear = fp.anos?.[0] as ChartRow | undefined;
  const hasCommodityMetric = firstYear !== undefined && typeof firstYear.margem_por_tonelada === "number";
  const hasSecuritizacaoMetric =
    fp.indicadores !== undefined && typeof fp.indicadores.prazo_medio_carteira === "number";

  // Cast anos to ChartRow[] for the generic chart component (number extends unknown).
  const anosRows = (fp.anos ?? []) as ChartRow[];

  return (
    <div className="space-y-4">
      {/* ── KPI strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Receita Ano 1",      value: ano0 ? fmt.format(ano0.receita_total_brl) : "—", icon: <TrendingUp size={12} /> },
          { label: "EBITDA Ano 1",       value: ano0 ? fmt.format(ano0.ebitda_brl) : "—",        icon: <BarChart2 size={12} /> },
          { label: "Margem EBITDA (A1)", value: ano0 ? fmtPct(ano0.margem_ebitda_pct) : "—",     icon: <DollarSign size={12} /> },
          { label: "EBITDA Ano 5",       value: ano5 ? fmt.format(ano5.ebitda_brl) : "—",        icon: <TrendingUp size={12} /> },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl p-3 border" style={{ background: C.nc, borderColor: C.nm }}>
            <div className="flex items-center gap-1 mb-1" style={{ color: C.go }}>
              {kpi.icon}
              <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.gl }}>
                {kpi.label}
              </span>
            </div>
            <p className="text-sm font-semibold" style={{ color: C.cr }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Receita + EBITDA — série temporal ─────────────────── */}
      {anosRows.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: C.nc, borderColor: C.nm }}>
          <ChartTimeSeries
            title="Receita Total e EBITDA — Projeção 10 Anos (CAGR Base 12%)"
            data={anosRows}
            xKey="ano"
            series={[
              { key: "receita_total_brl", label: "Receita Total", color: C.go,  gradientId: "rec" },
              { key: "ebitda_brl",        label: "EBITDA",        color: C.mu,  gradientId: "ebt" },
            ]}
            formatY={fmtM}
            height={220}
          />
        </div>
      )}

      {/* ── Commodity: margem por tonelada (conditional) ──────── */}
      {hasCommodityMetric && (
        <div className="rounded-xl border p-4" style={{ background: C.nc, borderColor: C.nm }}>
          <ChartTimeSeries
            title="Margem por Tonelada — Projeção"
            data={anosRows}
            xKey="ano"
            series={[
              { key: "margem_por_tonelada", label: "Margem/t (BRL)", color: C.gl, gradientId: "mgt" },
            ]}
            formatY={fmtM}
            height={160}
          />
        </div>
      )}

      {/* ── Securitização: prazo médio da carteira (conditional) ─ */}
      {hasSecuritizacaoMetric && (
        <div className="rounded-xl border p-3" style={{ background: C.nc, borderColor: C.nm }}>
          <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: C.gl }}>
            Prazo Médio da Carteira
          </p>
          <p className="text-sm font-semibold" style={{ color: C.cr }}>
            {fp.indicadores!.prazo_medio_carteira} meses
          </p>
        </div>
      )}

      {/* ── Cenários de valuation ─────────────────────────────── */}
      {fp.scenarios && (
        <div className="rounded-xl border p-4" style={{ background: C.nc, borderColor: C.nm }}>
          <ChartCenariosAgrupado
            title="Comparativo de Cenários — Valor Terminal"
            scenarios={fp.scenarios}
            valueKey="valor_terminal_brl"
            formatY={fmtM}
          />
          {/* CAGR labels below chart */}
          <div className="flex gap-4 mt-3 justify-center">
            {Object.entries(fp.scenarios).map(([key, sc]) => (
              <div key={key} className="text-center">
                <p className="text-[9px] font-semibold" style={{ color: C.gl }}>{sc.label}</p>
                <p className="text-[9px]" style={{ color: C.mu }}>CAGR {fmtPct(sc.cagr_pct)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hedge analysis summary (conditional) ──────────────── */}
      {hedge && (hedge.exposicao_residual_usd as number) > 0 && (
        <div
          className="rounded-xl border p-3 space-y-1"
          style={{ background: "#0d1f35", borderColor: "#1c3d6e" }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Shield size={12} style={{ color: C.go }} />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.gl }}>
              Análise de Hedge Cambial
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span style={{ color: C.mu }}>Hedge natural: </span>
              <span style={{ color: C.cr }}>{fmtPct(hedge.taxa_hedge_natural_pct as number)}</span>
            </div>
            <div>
              <span style={{ color: C.mu }}>Exposição residual: </span>
              <span style={{ color: C.cr }}>
                USD {(hedge.exposicao_residual_usd as number).toLocaleString("pt-BR")}
              </span>
            </div>
            <div>
              <span style={{ color: C.mu }}>Instrumento sugerido: </span>
              <span style={{ color: C.go }}>{String(hedge.instrumento_sugerido).replace("_", " ")}</span>
            </div>
            <div>
              <span style={{ color: C.mu }}>Custo NDF/ano: </span>
              <span style={{ color: C.cr }}>{fmt.format(hedge.custo_anual_ndf_brl as number)}</span>
            </div>
          </div>
          {!!hedge.justificativa && (
            <p className="text-[10px] mt-1" style={{ color: C.mu }}>{String(hedge.justificativa)}</p>
          )}
        </div>
      )}

      {/* ── B3 BGI (Boi Gordo) — viabilidade em arrobas-equivalentes (conditional) ─ */}
      {bgi && (
        <div
          className="rounded-xl border p-3 space-y-1"
          style={{ background: "#0d1f35", borderColor: "#1c3d6e" }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart2 size={12} style={{ color: C.go }} />
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: C.gl }}>
              BGI vs Custo Unitário Embrião — Arrobas-Equivalentes (CEPEA/B3 SP)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span style={{ color: C.mu }}>Indicador B3 BGI (R$/@): </span>
              <span style={{ color: C.cr }}>{fmtBRL2.format(bgi.preco_arroba_boi_gordo_rs as number)}</span>
            </div>
            <div>
              <span style={{ color: C.mu }}>Custo do embrião em @: </span>
              <span style={{ color: C.cr }}>{fmtArroba(bgi.custo_embriao_em_arrobas as number)}</span>
            </div>
            <div>
              <span style={{ color: C.mu }}>Preço de venda em @: </span>
              <span style={{ color: C.cr }}>{fmtArroba(bgi.preco_venda_embriao_em_arrobas as number)}</span>
            </div>
            <div>
              <span style={{ color: C.mu }}>Margem em @: </span>
              <span style={{ color: C.cr }}>
                {fmtArroba(bgi.margem_unitaria_em_arrobas as number)} ({fmtPct(bgi.margem_pct as number)})
              </span>
            </div>
          </div>
          <p
            className="text-[10px] mt-1 font-semibold"
            style={{ color: bgi.classificacao === "Favoravel" ? C.go : C.mu }}
          >
            Classificação: {String(bgi.classificacao)} — margem unitária de {fmt.format(bgi.margem_unitaria_brl as number)},
            equivalente a {fmtArroba(bgi.margem_unitaria_em_arrobas as number)} de boi gordo ao preço de referência CEPEA/B3 SP.
          </p>
          {bgi.custo_igg_em_arrobas !== undefined && (
            <p className="text-[10px]" style={{ color: C.mu }}>
              IGG Select: custo de {fmtArroba(bgi.custo_igg_em_arrobas as number)}
              {bgi.margem_igg_em_arrobas !== undefined
                ? ` · margem de ${fmtArroba(bgi.margem_igg_em_arrobas as number)}`
                : ""}
            </p>
          )}
        </div>
      )}

      {/* ── Narrative sections ─────────────────────────────────── */}
      <div className="space-y-3">
        {plan.narrative_sections.map((sec, i) => (
          <div key={i} className="rounded-xl border p-4" style={{ background: C.nc, borderColor: C.nm }}>
            <h3 className="text-xs font-semibold mb-2" style={{ color: C.go }}>{sec.title}</h3>
            <p className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color: C.mu }}>
              {sec.body}
            </p>
          </div>
        ))}
      </div>

      {/* ── FX snapshot ───────────────────────────────────────── */}
      {fp.fx_snapshot && (
        <p className="text-[9px]" style={{ color: C.mu }}>
          Câmbio aplicado: USD/BRL {fp.fx_snapshot.usd_brl.toFixed(4)} · fonte: {fp.fx_snapshot.source} · {fp.fx_snapshot.date}
        </p>
      )}

      {/* ── Regenerate ───────────────────────────────────────── */}
      {canGenerate && (
        <button
          onClick={handleRegen}
          disabled={regenerating}
          className="flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: `${C.go}40`, background: `${C.go}10`, color: C.go }}
        >
          {regenerating ? <Loader2 size={10} className="animate-spin" /> : null}
          {regenerating ? "Regenerando..." : "Regenerar Business Plan"}
        </button>
      )}

      {/* ── Auditoria ─────────────────────────────────────────── */}
      <details className="text-[9px]" style={{ color: C.mu }}>
        <summary className="cursor-pointer hover:underline">
          Auditoria · {plan.claim_trace.length} afirmações · modelo {plan.model}
        </summary>
        <ul className="mt-2 space-y-1 pl-2">
          {plan.claim_trace.map((c, i) => (
            <li key={i}>
              <span style={{ color: C.go }}>{c.claim}</span>{" "}
              <span style={{ color: C.mu }}>← {c.source_path}: {String(c.source_value)}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
