"use client";

import React, { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Users, DollarSign,
  BarChart3, Activity, RefreshCw, AlertCircle,
  ArrowUpRight, ArrowDownRight, Crown, UserCheck,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GOLD = "#C9A84C";
const NAVY_CARD = "#162744";
const MUTED = "#7A8FA8";

interface Metricas {
  mrr: number;
  arr: number;
  churnRate: number;
  crescimentoMoM: number;
  novosEsteMes: number;
  totalAtivos: number;
  ativosPartner: number;
  ativosPro: number;
  totalPartners: number;
  ticketMedioMensal: number;
  ltv: number;
  receitaRegistrada: number;
  serie: Array<{ mes: string; mrr: number; partners: number; novos: number }>;
  pagamentosHistorico: Array<{ mes: string; valor: number }>;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

function MetricCard({
  label, value, sub, icon: Icon, color, trend, trendLabel,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: number;
  trendLabel?: string;
}) {
  const positivo = (trend ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-white/5 p-4 flex flex-col gap-3" style={{ background: NAVY_CARD }}>
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${positivo ? "text-emerald-400" : "text-red-400"}`}>
            {positivo ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(trend)}%
            {trendLabel && <span className="text-[10px] text-muted-foreground ml-0.5">{trendLabel}</span>}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm font-medium" style={{ color: "#F0ECE4" }}>{label}</p>
        {sub && <p className="text-xs mt-0.5" style={{ color: MUTED }}>{sub}</p>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 p-3 text-xs space-y-1" style={{ background: "#0F1E35" }}>
      <p className="font-semibold text-white mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.name.toLowerCase().includes("mrr") || p.name.toLowerCase().includes("receita") || p.name.toLowerCase().includes("ticket") || p.name.toLowerCase().includes("ltv")
            ? fmt(p.value)
            : p.value}
        </p>
      ))}
    </div>
  );
};

export function MetricasClient() {
  const [data, setData] = useState<Metricas | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/financeiro/metricas")
      .then(r => r.json())
      .then(j => {
        if (j.error) setError(j.error);
        else setData(j);
      })
      .catch(() => setError("Erro ao carregar métricas"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <RefreshCw className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
        <span className="text-sm">Calculando métricas…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-red-400">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm">{error ?? "Sem dados"}</span>
      </div>
    );
  }

  const churnBom = data.churnRate <= 3;
  const crescimentoBom = data.crescimentoMoM >= 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Dashboard de Métricas</h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            Saúde financeira da rede de partners · Atualizado agora
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors"
          style={{ color: MUTED }}
        >
          <RefreshCw className="w-3 h-3" />
          Atualizar
        </button>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="MRR"
          value={fmt(data.mrr)}
          sub="Receita recorrente mensal"
          icon={DollarSign}
          color={GOLD}
          trend={data.crescimentoMoM}
          trendLabel="vs mês ant."
        />
        <MetricCard
          label="ARR"
          value={fmt(data.arr)}
          sub="Projeção anual"
          icon={TrendingUp}
          color="#60A5FA"
        />
        <MetricCard
          label="Partners Ativos"
          value={data.totalAtivos.toString()}
          sub={`${data.ativosPartner} Partner · ${data.ativosPro} PRO`}
          icon={Users}
          color="#A78BFA"
        />
        <MetricCard
          label="Churn Rate"
          value={`${data.churnRate}%`}
          sub={churnBom ? "Dentro do saudável (≤3%)" : "Atenção — acima do ideal"}
          icon={churnBom ? Activity : AlertCircle}
          color={churnBom ? "#34D399" : "#F87171"}
          trend={-data.churnRate}
        />
      </div>

      {/* KPIs secundários */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Novos este mês"
          value={data.novosEsteMes.toString()}
          sub="Partners cadastrados"
          icon={UserCheck}
          color="#34D399"
        />
        <MetricCard
          label="Ticket Médio"
          value={fmt(data.ticketMedioMensal)}
          sub="Por partner ativo/mês"
          icon={BarChart3}
          color={GOLD}
        />
        <MetricCard
          label="LTV Estimado"
          value={fmt(data.ltv)}
          sub="Valor de vida do partner"
          icon={Crown}
          color="#F59E0B"
        />
        <MetricCard
          label="Receita Registrada"
          value={fmt(data.receitaRegistrada)}
          sub="Pagamentos confirmados"
          icon={DollarSign}
          color="#60A5FA"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* MRR histórico */}
        <div className="rounded-2xl border border-white/5 p-4" style={{ background: NAVY_CARD }}>
          <p className="text-sm font-semibold text-white mb-4">MRR — Últimos 6 Meses</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradMRR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F3557" />
              <XAxis dataKey="mes" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fill: MUTED, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="mrr"
                name="MRR"
                stroke={GOLD}
                strokeWidth={2}
                fill="url(#gradMRR)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Novos partners por mês */}
        <div className="rounded-2xl border border-white/5 p-4" style={{ background: NAVY_CARD }}>
          <p className="text-sm font-semibold text-white mb-4">Novos Partners — Últimos 6 Meses</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.serie} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1F3557" />
              <XAxis dataKey="mes" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} width={32} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="novos" name="Novos" fill="#A78BFA" radius={[4, 4, 0, 0]} />
              <Bar dataKey="partners" name="Total Ativos" fill="#60A5FA" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11, color: MUTED, paddingTop: 8 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Composição da base */}
      <div className="rounded-2xl border border-white/5 p-4" style={{ background: NAVY_CARD }}>
        <p className="text-sm font-semibold text-white mb-4">Composição da Base</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Partner (30%)", count: data.ativosPartner, color: "#60A5FA", pct: data.totalAtivos ? Math.round(data.ativosPartner / data.totalAtivos * 100) : 0 },
            { label: "Partner PRO (50%)", count: data.ativosPro, color: GOLD, pct: data.totalAtivos ? Math.round(data.ativosPro / data.totalAtivos * 100) : 0 },
            { label: "Total cadastros", count: data.totalPartners, color: "#A78BFA", pct: 100 },
            { label: "Taxa de ativos", count: data.totalPartners > 0 ? `${Math.round(data.totalAtivos / data.totalPartners * 100)}%` : "—", color: "#34D399", pct: data.totalPartners > 0 ? Math.round(data.totalAtivos / data.totalPartners * 100) : 0 },
          ].map(item => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: MUTED }}>{item.label}</span>
                <span className="text-sm font-bold text-white">{item.count}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${item.pct}%`, background: item.color }}
                />
              </div>
              <p className="text-[10px]" style={{ color: MUTED }}>{item.pct}% da base</p>
            </div>
          ))}
        </div>
      </div>

      {/* Metas sugeridas */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ background: `${GOLD}08`, borderColor: `${GOLD}30` }}>
        <p className="text-sm font-semibold" style={{ color: GOLD }}>Metas Sugeridas para Escala</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { fase: "Fase 1 (0–3m)", meta: "50 ativos · MRR R$25k", cor: "#34D399" },
            { fase: "Fase 2 (3–6m)", meta: "150 ativos · MRR R$75k", cor: GOLD },
            { fase: "Fase 3 (6–12m)", meta: "400 ativos · MRR R$200k", cor: "#F59E0B" },
          ].map(m => (
            <div key={m.fase} className="rounded-xl border border-white/5 p-3" style={{ background: "#0F1E35" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: m.cor }}>{m.fase}</p>
              <p className="text-sm font-semibold text-white">{m.meta}</p>
              <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round(data.totalAtivos / (m.fase.includes("1") ? 50 : m.fase.includes("2") ? 150 : 400) * 100))}%`,
                    background: m.cor,
                  }}
                />
              </div>
              <p className="text-[10px] mt-1" style={{ color: MUTED }}>
                {data.totalAtivos} / {m.fase.includes("1") ? 50 : m.fase.includes("2") ? 150 : 400} partners
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
