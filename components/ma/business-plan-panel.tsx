"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Save, Printer, TrendingUp, DollarSign, Target, BarChart2 } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  AgroFinancialProjections,
  AgroFase1, AgroFase2, AgroFase3,
  emptyAgroProjections,
} from "@/types/deal-financial-agro";

// ── Paleta V3 V4.2 ──────────────────────────────────────────────────────────
const C = {
  nd: "#09081A", nb: "#13223A", nc: "#162744", nm: "#243A66",
  go: "#C9A84C", gl: "#E8C97A", cr: "#F5F1E8", mu: "#9BAFC5",
  ok: "#10B981", err: "#EF4444",
};

// ── Roles ────────────────────────────────────────────────────────────────────
const EDIT_ROLES = ["ADMIN", "GESTAO"];

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number, prefix = "R$") =>
  `${prefix} ${n.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;

function calcCustoEmbriao(f1: AgroFase1): number {
  if (!f1.volume_embrioes_ano || f1.volume_embrioes_ano === 0) return 0;
  const total = f1.custo_embriao_brl + f1.custo_dose_semen_brl +
    f1.custo_iatf_brl + f1.custo_igg_select_brl + f1.custo_te_brl;
  return total;
}

function calcCenarios(data: AgroFinancialProjections) {
  const f1 = data.fase_1_mvp;
  const f3 = data.fase_3_exportacao;
  const receitaEmbriao = f1.preco_venda_embriao_brl * f1.volume_embrioes_ano;
  const receitaDose = f1.preco_venda_dose_brl * f1.volume_embrioes_ano * 5;
  const receitaExport = f3.volume_cabecas_ano * f3.preco_arroba_brl *
    (f3.rendimento_carcaca_pct / 100) * 15;
  const custoFixo = f1.opex_central_genetica_brl * 12 +
    data.fase_2_contratos.custo_spe_juridico +
    data.fase_2_contratos.custo_cvm88_estruturacao +
    data.fase_2_contratos.custo_assessoria_legal_mes * 12;
  const custoVar = (f3.custo_quarentena_cabeca + f3.frete_medio_cabeca_usd * 5.5) *
    f3.volume_cabecas_ano + f3.custo_gacc + f3.custo_halal;

  const base = receitaEmbriao + receitaDose + receitaExport;
  const custo = custoFixo + custoVar;
  const ebitdaBase = base - custo;

  return {
    base:        { receita_total: base, custo_total: custo, ebitda: ebitdaBase, margem_pct: base ? (ebitdaBase / base) * 100 : 0 },
    otimista:    { receita_total: base * 1.3, custo_total: custo * 1.1, ebitda: base * 1.3 - custo * 1.1, margem_pct: base ? ((base * 1.3 - custo * 1.1) / (base * 1.3)) * 100 : 0 },
    conservador: { receita_total: base * 0.7, custo_total: custo * 0.95, ebitda: base * 0.7 - custo * 0.95, margem_pct: base ? ((base * 0.7 - custo * 0.95) / (base * 0.7)) * 100 : 0 },
  };
}

function calcFluxo12m(data: AgroFinancialProjections) {
  const f1 = data.fase_1_mvp;
  const receitaMes = (f1.preco_venda_embriao_brl * f1.volume_embrioes_ano +
    f1.preco_venda_dose_brl * f1.volume_embrioes_ano * 5) / 12;
  const custoMes = f1.opex_central_genetica_brl +
    data.fase_2_contratos.custo_assessoria_legal_mes;

  let saldo = 0;
  return Array.from({ length: 12 }, (_, i) => {
    const receita = i < 3 ? receitaMes * 0.3 : i < 6 ? receitaMes * 0.6 : receitaMes;
    const custo = i === 0
      ? custoMes + data.fase_2_contratos.custo_spe_juridico + data.fase_2_contratos.custo_cvm88_estruturacao
      : custoMes;
    saldo += receita - custo;
    return { mes: i + 1, receita: Math.round(receita), custo: Math.round(custo), saldo: Math.round(saldo) };
  });
}

// ── Input Field ──────────────────────────────────────────────────────────────
function Field({ label, value, onChange, unit = "R$", disabled = false }: {
  label: string; value: number; onChange: (v: number) => void;
  unit?: string; disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[9px] font-bold uppercase tracking-widest text-[#E8C97A]">{label}</label>
      <div className="flex items-center gap-1 bg-[#162744] border border-[#243A66] rounded-lg px-3 py-2">
        <span className="text-[10px] text-[#9BAFC5] font-medium">{unit}</span>
        <input
          type="number"
          value={value || ""}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          disabled={disabled}
          className="flex-1 bg-transparent text-[#F5F1E8] text-sm font-semibold outline-none min-w-0
            disabled:opacity-50 disabled:cursor-not-allowed"
          placeholder="0"
          step="any"
        />
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-bold text-[#F5F1E8]">{title}</h3>
      {sub && <p className="text-[10px] text-[#9BAFC5] mt-0.5">{sub}</p>}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = C.go }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-[#13223A] border border-[#243A66] rounded-xl p-4">
      <p className="text-[9px] font-bold uppercase tracking-widest text-[#E8C97A] mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-[#9BAFC5] mt-1">{sub}</p>}
    </div>
  );
}

// ── Tooltip customizado ───────────────────────────────────────────────────────
interface TooltipProps { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: number | string; }
const ChartTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#13223A] border border-[#243A66] rounded-lg p-3 text-xs shadow-xl">
        <p className="text-[#E8C97A] font-bold mb-1">{typeof label === "number" ? `Mês ${label}` : label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: {fmt(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ── Main Component ────────────────────────────────────────────────────────────
export function BusinessPlanPanel({
  dealId,
  dealCode,
  userRole,
}: {
  dealId: string;
  dealCode?: string;
  userRole: string;
}) {
  const canEdit = EDIT_ROLES.includes(userRole);
  const [data, setData] = useState<AgroFinancialProjections>(emptyAgroProjections());
  const [tab, setTab] = useState<"dashboard" | "fase1" | "fase2" | "fase3">("dashboard");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    fetch(`/api/ma/projections/${dealId}`)
      .then(r => r.json())
      .then(d => {
        if (d.projections) setData(d.projections);
      })
      .catch(() => setError("Erro ao carregar projeções"))
      .finally(() => setLoading(false));
  }, [dealId]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/ma/projections/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projections: data }),
      });
      if (!res.ok) throw new Error("Falha ao salvar");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }, [dealId, data]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const cenarios = calcCenarios(data);
  const fluxo = calcFluxo12m(data);
  const custoEmbriao = calcCustoEmbriao(data.fase_1_mvp);
  const economiaIgg = data.comparativo_igg.citometria_custo > 0
    ? ((data.comparativo_igg.citometria_custo - data.comparativo_igg.igg_custo) /
        data.comparativo_igg.citometria_custo * 100).toFixed(0)
    : "76";

  const tabs = [
    { id: "dashboard" as const, label: "Dashboard" },
    { id: "fase1" as const, label: "Fase 1 — MVP" },
    { id: "fase2" as const, label: "Fase 2 — Contratos" },
    { id: "fase3" as const, label: "Fase 3 — Exportação" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-[#9BAFC5]">
        <Loader2 className="animate-spin mr-2" size={16} />
        <span className="text-sm">Carregando Business Plan...</span>
      </div>
    );
  }

  return (
    <div className="text-[#F5F1E8] print:bg-white print:text-black">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4 print:mb-6">
        <div>
          <h2 className="text-sm font-bold text-[#F5F1E8] print:text-black">
            Business Plan Financeiro
            {dealCode && <span className="ml-2 text-[10px] text-[#9BAFC5] font-normal">{dealCode}</span>}
          </h2>
          <p className="text-[10px] text-[#9BAFC5] mt-0.5 print:hidden">
            Genética Bovina · Nelblue × IGG Select · Exportação viva
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] hover:text-[#F5F1E8] text-[10px] font-semibold transition-colors"
          >
            <Printer size={12} /> Exportar CIM
          </button>
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                saved
                  ? "bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981]"
                  : "bg-[#C9A84C]/10 border border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/20"
              }`}
            >
              {saving ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
              {saved ? "Salvo!" : "Salvar"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs print:hidden">
          {error}
        </div>
      )}

      {/* ── Tabs internas ────────────────────────────────────────── */}
      <div className="flex gap-0 border-b border-[#243A66] mb-4 print:hidden overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-[10px] font-semibold border-b-2 flex-shrink-0 transition-colors ${
              tab === t.id
                ? "border-[#C9A84C] text-[#C9A84C]"
                : "border-transparent text-[#9BAFC5] hover:text-[#F5F1E8]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ DASHBOARD ══════════════════════════════════════════════ */}
      {(tab === "dashboard") && (
        <div className="space-y-6">

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Custo unitário embrião" value={fmt(custoEmbriao)} sub="Fase 1 MVP" />
            <KpiCard label="EBITDA — Cenário Base" value={fmt(cenarios.base.ebitda)} sub={`Margem ${cenarios.base.margem_pct.toFixed(1)}%`} color={cenarios.base.ebitda >= 0 ? C.ok : C.err} />
            <KpiCard label="Economia IGG Select" value={`${economiaIgg}%`} sub="vs Citometria de Fluxo" color={C.ok} />
            <KpiCard label="Receita base projetada" value={fmt(cenarios.base.receita_total)} sub="Fases 1 + 3" />
          </div>

          {/* Fluxo de Caixa 12 meses */}
          <div className="bg-[#13223A] border border-[#243A66] rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#E8C97A] mb-3">
              Fluxo de Caixa — 12 Meses
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={fluxo}>
                <CartesianGrid strokeDasharray="3 3" stroke="#243A66" />
                <XAxis dataKey="mes" tick={{ fill: "#9BAFC5", fontSize: 10 }} tickFormatter={v => `M${v}`} />
                <YAxis tick={{ fill: "#9BAFC5", fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#9BAFC5" }} />
                <Line type="monotone" dataKey="receita" stroke={C.ok} strokeWidth={2} dot={false} name="Receita" />
                <Line type="monotone" dataKey="custo" stroke={C.err} strokeWidth={2} dot={false} name="Custo" />
                <Line type="monotone" dataKey="saldo" stroke={C.go} strokeWidth={2} dot={false} name="Saldo Acum." />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Cenários */}
          <div className="bg-[#13223A] border border-[#243A66] rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#E8C97A] mb-3">
              Receita × Custo por Cenário
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[
                { name: "Conservador", Receita: cenarios.conservador.receita_total, Custo: cenarios.conservador.custo_total },
                { name: "Base", Receita: cenarios.base.receita_total, Custo: cenarios.base.custo_total },
                { name: "Otimista", Receita: cenarios.otimista.receita_total, Custo: cenarios.otimista.custo_total },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#243A66" />
                <XAxis dataKey="name" tick={{ fill: "#9BAFC5", fontSize: 10 }} />
                <YAxis tick={{ fill: "#9BAFC5", fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#9BAFC5" }} />
                <Bar dataKey="Receita" fill={C.go} radius={[4, 4, 0, 0]} />
                <Bar dataKey="Custo" fill={C.mu} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* IGG Select vs Citometria */}
          <div className="bg-[#13223A] border border-[#243A66] rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#E8C97A] mb-3">
              IGG Select vs Citometria de Fluxo (US$/dose)
            </p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={[
                { name: "IGG Select", custo: data.comparativo_igg.igg_custo },
                { name: "Citometria", custo: data.comparativo_igg.citometria_custo },
              ]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#243A66" />
                <XAxis type="number" tick={{ fill: "#9BAFC5", fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#9BAFC5", fontSize: 10 }} width={80} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="custo" fill={C.ok} radius={[0, 4, 4, 0]} name="Custo US$" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-[#9BAFC5] mt-2 text-center">
              Economia de <span className="text-[#10B981] font-bold">{economiaIgg}%</span> usando IGG Select — mesma eficácia reprodutiva
            </p>
          </div>

          {/* Break-even timeline */}
          <div className="bg-[#13223A] border border-[#243A66] rounded-xl p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#E8C97A] mb-3">Break-even por Fase</p>
            <div className="space-y-3">
              {[
                { label: "Fase 1 — MVP (genética)", meses: data.break_even.fase_1_meses, max: 18 },
                { label: "Fase 2 — Contratos futuros", meses: data.break_even.fase_2_meses, max: 24 },
                { label: "Fase 3 — Exportação 50k cab./ano", meses: data.break_even.fase_3_meses, max: 36 },
              ].map(item => (
                <div key={item.label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-[#9BAFC5]">{item.label}</span>
                    <span className="text-[10px] font-bold text-[#C9A84C]">
                      {item.meses ? `${item.meses} meses` : "Preencher dados"}
                    </span>
                  </div>
                  <div className="h-2 bg-[#162744] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: item.meses ? `${Math.min((item.meses / item.max) * 100, 100)}%` : "0%",
                        background: `linear-gradient(90deg, ${C.go}, ${C.gl})`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ FASE 1 ═════════════════════════════════════════════════ */}
      {tab === "fase1" && (
        <div className="space-y-6">
          <SectionHead
            title="Fase 1 — MVP · Central de Genética"
            sub="Custos e receitas da central de melhoramento. Preencher com dados do Dr. Fábio / Prof. Neimar Severo."
          />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#E8C97A] mb-3">Custos operacionais</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Custo por embrião (coleta)" value={data.fase_1_mvp.custo_embriao_brl} onChange={v => setData(d => ({ ...d, fase_1_mvp: { ...d.fase_1_mvp, custo_embriao_brl: v } }))} disabled={!canEdit} />
              <Field label="Custo por dose de sêmen" value={data.fase_1_mvp.custo_dose_semen_brl} onChange={v => setData(d => ({ ...d, fase_1_mvp: { ...d.fase_1_mvp, custo_dose_semen_brl: v } }))} disabled={!canEdit} />
              <Field label="Custo IATF por vaca" value={data.fase_1_mvp.custo_iatf_brl} onChange={v => setData(d => ({ ...d, fase_1_mvp: { ...d.fase_1_mvp, custo_iatf_brl: v } }))} disabled={!canEdit} />
              <Field label="Custo IGG Select (sexagem) por dose" value={data.fase_1_mvp.custo_igg_select_brl} onChange={v => setData(d => ({ ...d, fase_1_mvp: { ...d.fase_1_mvp, custo_igg_select_brl: v } }))} unit="US$" disabled={!canEdit} />
              <Field label="Custo transferência de embrião (TE)" value={data.fase_1_mvp.custo_te_brl} onChange={v => setData(d => ({ ...d, fase_1_mvp: { ...d.fase_1_mvp, custo_te_brl: v } }))} disabled={!canEdit} />
              <Field label="OPEX central genética / mês" value={data.fase_1_mvp.opex_central_genetica_brl} onChange={v => setData(d => ({ ...d, fase_1_mvp: { ...d.fase_1_mvp, opex_central_genetica_brl: v } }))} disabled={!canEdit} />
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#E8C97A] mb-3">Volume e receitas</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Volume de embriões / ano" value={data.fase_1_mvp.volume_embrioes_ano} onChange={v => setData(d => ({ ...d, fase_1_mvp: { ...d.fase_1_mvp, volume_embrioes_ano: v } }))} unit="un" disabled={!canEdit} />
              <Field label="Preço de venda embrião" value={data.fase_1_mvp.preco_venda_embriao_brl} onChange={v => setData(d => ({ ...d, fase_1_mvp: { ...d.fase_1_mvp, preco_venda_embriao_brl: v } }))} disabled={!canEdit} />
              <Field label="Preço de venda dose sêmen" value={data.fase_1_mvp.preco_venda_dose_brl} onChange={v => setData(d => ({ ...d, fase_1_mvp: { ...d.fase_1_mvp, preco_venda_dose_brl: v } }))} disabled={!canEdit} />
            </div>
          </div>
          {/* Custo unitário calculado */}
          <div className="bg-[#C9A84C]/8 border border-[#C9A84C]/25 rounded-xl p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#E8C97A] mb-1">Custo unitário calculado</p>
            <p className="text-2xl font-bold text-[#C9A84C]">{fmt(custoEmbriao)}</p>
            <p className="text-[10px] text-[#9BAFC5] mt-1">Soma dos custos de coleta + sêmen + IATF + IGG Select + TE por embrião</p>
          </div>
          {/* IGG Select config */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#E8C97A] mb-3">Comparativo IGG Select</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="IGG Select / dose" value={data.comparativo_igg.igg_custo} onChange={v => setData(d => ({ ...d, comparativo_igg: { ...d.comparativo_igg, igg_custo: v } }))} unit="US$" disabled={!canEdit} />
              <Field label="Citometria de fluxo / dose" value={data.comparativo_igg.citometria_custo} onChange={v => setData(d => ({ ...d, comparativo_igg: { ...d.comparativo_igg, citometria_custo: v } }))} unit="US$" disabled={!canEdit} />
              <div className="bg-[#13223A] border border-[#243A66] rounded-xl p-3 flex flex-col justify-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#E8C97A]">Economia</p>
                <p className="text-xl font-bold text-[#10B981] mt-1">{economiaIgg}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ FASE 2 ═════════════════════════════════════════════════ */}
      {tab === "fase2" && (
        <div className="space-y-6">
          <SectionHead
            title="Fase 2 — Contratos Futuros"
            sub="Custos de estruturação legal (SPE, CVM 88) e receita projetada de contratos futuros de embriões e sêmen."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Constituição da SPE" value={data.fase_2_contratos.custo_spe_juridico} onChange={v => setData(d => ({ ...d, fase_2_contratos: { ...d.fase_2_contratos, custo_spe_juridico: v } }))} disabled={!canEdit} />
            <Field label="Registro CVM 88 (estruturação)" value={data.fase_2_contratos.custo_cvm88_estruturacao} onChange={v => setData(d => ({ ...d, fase_2_contratos: { ...d.fase_2_contratos, custo_cvm88_estruturacao: v } }))} disabled={!canEdit} />
            <Field label="Assessoria jurídica / mês" value={data.fase_2_contratos.custo_assessoria_legal_mes} onChange={v => setData(d => ({ ...d, fase_2_contratos: { ...d.fase_2_contratos, custo_assessoria_legal_mes: v } }))} disabled={!canEdit} />
            <Field label="Receita estimada (contratos futuros)" value={data.fase_2_contratos.receita_contrato_futuro_estimada} onChange={v => setData(d => ({ ...d, fase_2_contratos: { ...d.fase_2_contratos, receita_contrato_futuro_estimada: v } }))} disabled={!canEdit} />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#E8C97A] mb-3">Break-even Fase 2</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Break-even Fase 1 (meses)" value={data.break_even.fase_1_meses ?? 0} onChange={v => setData(d => ({ ...d, break_even: { ...d.break_even, fase_1_meses: v || null } }))} unit="m" disabled={!canEdit} />
              <Field label="Break-even Fase 2 (meses)" value={data.break_even.fase_2_meses ?? 0} onChange={v => setData(d => ({ ...d, break_even: { ...d.break_even, fase_2_meses: v || null } }))} unit="m" disabled={!canEdit} />
              <Field label="Break-even Fase 3 (meses)" value={data.break_even.fase_3_meses ?? 0} onChange={v => setData(d => ({ ...d, break_even: { ...d.break_even, fase_3_meses: v || null } }))} unit="m" disabled={!canEdit} />
            </div>
          </div>
        </div>
      )}

      {/* ══ FASE 3 ═════════════════════════════════════════════════ */}
      {tab === "fase3" && (
        <div className="space-y-6">
          <SectionHead
            title="Fase 3 — Exportação (18-24 meses)"
            sub="Boi Nelblue BN sob demanda. 50.000 cabeças/ano faseadas. Oriente Médio · China · África."
          />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#E8C97A] mb-3">Custos de habilitação (fixos)</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Certificação GACC (China)" value={data.fase_3_exportacao.custo_gacc} onChange={v => setData(d => ({ ...d, fase_3_exportacao: { ...d.fase_3_exportacao, custo_gacc: v } }))} disabled={!canEdit} />
              <Field label="Certificação Halal" value={data.fase_3_exportacao.custo_halal} onChange={v => setData(d => ({ ...d, fase_3_exportacao: { ...d.fase_3_exportacao, custo_halal: v } }))} disabled={!canEdit} />
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#E8C97A] mb-3">Custos por cabeça</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Quarentena por cabeça" value={data.fase_3_exportacao.custo_quarentena_cabeca} onChange={v => setData(d => ({ ...d, fase_3_exportacao: { ...d.fase_3_exportacao, custo_quarentena_cabeca: v } }))} disabled={!canEdit} />
              <Field label="Frete médio por cabeça" value={data.fase_3_exportacao.frete_medio_cabeca_usd} onChange={v => setData(d => ({ ...d, fase_3_exportacao: { ...d.fase_3_exportacao, frete_medio_cabeca_usd: v } }))} unit="US$" disabled={!canEdit} />
            </div>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#E8C97A] mb-3">Produção e receita</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Volume cabeças / ano" value={data.fase_3_exportacao.volume_cabecas_ano} onChange={v => setData(d => ({ ...d, fase_3_exportacao: { ...d.fase_3_exportacao, volume_cabecas_ano: v } }))} unit="cab" disabled={!canEdit} />
              <Field label="Preço da arroba" value={data.fase_3_exportacao.preco_arroba_brl} onChange={v => setData(d => ({ ...d, fase_3_exportacao: { ...d.fase_3_exportacao, preco_arroba_brl: v } }))} disabled={!canEdit} />
              <Field label="Rendimento de carcaça (%)" value={data.fase_3_exportacao.rendimento_carcaca_pct} onChange={v => setData(d => ({ ...d, fase_3_exportacao: { ...d.fase_3_exportacao, rendimento_carcaca_pct: Math.min(100, Math.max(0, v)) } }))} unit="%" disabled={!canEdit} />
            </div>
          </div>
        </div>
      )}

      {/* ── Save footer ──────────────────────────────────────────── */}
      {canEdit && tab !== "dashboard" && (
        <div className="mt-6 pt-4 border-t border-[#243A66] flex justify-end print:hidden">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A84C] text-[#09081A] font-bold text-sm hover:bg-[#E8C97A] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            {saved ? "Salvo com sucesso!" : "Salvar Business Plan"}
          </button>
        </div>
      )}

      {/* ── Print styles (CIM export) ────────────────────────────── */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          nav, header, [class*="sidebar"], [class*="topbar"] { display: none !important; }
        }
      `}</style>
    </div>
  );
}
