"use client";

import React, { useEffect, useState } from "react";
import {
  TrendingUp, TrendingDown, Users, DollarSign,
  BarChart3, Activity, RefreshCw, AlertCircle,
  ArrowUpRight, ArrowDownRight, Crown, UserCheck,
  Bell, ChevronDown, ChevronUp, Clock,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ComposedChart, Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const GOLD = "#C9A84C";
const NAVY_CARD = "#162744";
const MUTED = "#7A8FA8";

interface ParceiroVencendo {
  id: string;
  full_name: string;
  email: string | null;
  role: string;
  trial_expires_at: string;
  diasRestantes: number;
}

interface Metricas {
  mrr: number;
  arr: number;
  churnRate: number;
  crescimentoMoM: number;
  crescimentoPartnersM: number;
  crescimentoTicketM: number;
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
  parceirosVencendo30: ParceiroVencendo[];
  totalVencendo7d: number;
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
          {p.name}: {(p.name.toLowerCase().includes("mrr") || p.name.toLowerCase().includes("receita") || p.name.toLowerCase().includes("ticket") || p.name.toLowerCase().includes("ltv") || p.name.toLowerCase().includes("projeção") || p.name.toLowerCase().includes("valor"))
            ? fmt(p.value)
            : p.value}
        </p>
      ))}
    </div>
  );
};

// ─── Seção: Inadimplência / Vencendo ─────────────────────────────────────────
function InadimplenciaSection({ data }: { data: Metricas }) {
  const [expanded, setExpanded] = useState(false);
  const [notificando, setNotificando] = useState<number | null>(null);
  const [notifResult, setNotifResult] = useState<string | null>(null);

  async function notificar(dias: number) {
    setNotificando(dias);
    setNotifResult(null);
    try {
      const res = await fetch("/api/financeiro/notificar-vencendo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dias }),
      });
      const json = await res.json();
      setNotifResult(`✅ ${json.notificados} notificações enviadas (≤${dias}d)`);
    } catch {
      setNotifResult("❌ Erro ao enviar notificações");
    } finally {
      setNotificando(null);
      setTimeout(() => setNotifResult(null), 4000);
    }
  }

  const urgentes = data.parceirosVencendo30.filter(p => p.diasRestantes <= 7);
  const proximos = data.parceirosVencendo30.filter(p => p.diasRestantes > 7 && p.diasRestantes <= 15);
  const demais = data.parceirosVencendo30.filter(p => p.diasRestantes > 15);

  return (
    <div className="rounded-2xl border p-4 space-y-4" style={{ borderColor: data.totalVencendo7d > 0 ? "#F8717130" : "#ffffff10", background: NAVY_CARD }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: data.totalVencendo7d > 0 ? "#F8717120" : "#ffffff10" }}>
            <AlertCircle className="w-4 h-4" style={{ color: data.totalVencendo7d > 0 ? "#F87171" : MUTED }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Régua de Cobrança</p>
            <p className="text-xs" style={{ color: MUTED }}>
              {data.parceirosVencendo30.length === 0
                ? "Nenhum partner vencendo nos próximos 30 dias"
                : `${data.parceirosVencendo30.length} partner${data.parceirosVencendo30.length > 1 ? "s" : ""} vencendo em 30 dias — ${urgentes.length} urgentes (≤7d)`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {notifResult && (
            <span className="text-xs" style={{ color: notifResult.startsWith("✅") ? "#34D399" : "#F87171" }}>{notifResult}</span>
          )}
          {data.parceirosVencendo30.length > 0 && (
            <>
              <button
                onClick={() => notificar(7)}
                disabled={!!notificando}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                style={{ borderColor: "#F8717130", color: "#F87171", background: notificando === 7 ? "#F8717120" : "transparent" }}
              >
                {notificando === 7 ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                Notificar ≤7d
              </button>
              <button
                onClick={() => notificar(30)}
                disabled={!!notificando}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                style={{ borderColor: `${GOLD}40`, color: GOLD, background: notificando === 30 ? `${GOLD}20` : "transparent" }}
              >
                {notificando === 30 ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />}
                Notificar ≤30d
              </button>
            </>
          )}
          {data.parceirosVencendo30.length > 0 && (
            <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" style={{ color: MUTED }}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Resumo visual */}
      {data.parceirosVencendo30.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Urgente (≤7d)", count: urgentes.length, color: "#F87171" },
            { label: "Atenção (8–15d)", count: proximos.length, color: "#FBBF24" },
            { label: "Aviso (16–30d)", count: demais.length, color: GOLD },
          ].map(g => (
            <div key={g.label} className="rounded-xl p-3 text-center" style={{ background: `${g.color}10`, border: `1px solid ${g.color}20` }}>
              <p className="text-xl font-bold" style={{ color: g.color }}>{g.count}</p>
              <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>{g.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lista expandida */}
      {expanded && data.parceirosVencendo30.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: "#ffffff10" }}>
                {["Partner", "Plano", "E-mail", "Vence em"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.parceirosVencendo30.map(p => (
                <tr key={p.id} className="border-b" style={{ borderColor: "#ffffff05" }}>
                  <td className="px-3 py-2 font-medium text-white">{p.full_name}</td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ background: p.role === "PARTNER_PRO" ? `${GOLD}20` : "#60A5FA20", color: p.role === "PARTNER_PRO" ? GOLD : "#60A5FA" }}>
                      {p.role === "PARTNER_PRO" ? "PRO" : "Partner"}
                    </span>
                  </td>
                  <td className="px-3 py-2" style={{ color: MUTED }}>{p.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1 font-semibold" style={{ color: p.diasRestantes <= 7 ? "#F87171" : p.diasRestantes <= 15 ? "#FBBF24" : GOLD }}>
                      <Clock className="w-3 h-3" />
                      {p.diasRestantes === 0 ? "Hoje" : `${p.diasRestantes}d`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
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

  // Projeção MRR: pegar últimos 3 meses e calcular crescimento médio
  const serieComProjecao = (() => {
    const s = [...data.serie];
    if (s.length >= 2) {
      const ultimos = s.slice(-3);
      const taxaMedia = ultimos.length > 1
        ? ultimos.slice(1).reduce((acc, curr, i) => {
            const prev = ultimos[i];
            return acc + (prev.mrr > 0 ? (curr.mrr - prev.mrr) / prev.mrr : 0);
          }, 0) / (ultimos.length - 1)
        : 0;
      const mesesPT = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
      const ultimo = s[s.length - 1];
      let ultimoMrrProj = ultimo.mrr;
      // Projeta 3 meses à frente
      for (let i = 1; i <= 3; i++) {
        const now = new Date();
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        ultimoMrrProj = Math.round(ultimoMrrProj * (1 + taxaMedia));
        s.push({ mes: mesesPT[d.getMonth()], mrr: 0, partners: 0, novos: 0, projecao: ultimoMrrProj } as typeof s[0] & { projecao?: number });
      }
      // Adiciona projecao: null nos pontos reais e o valor nos projetados
      return s.map((p, idx) => ({
        ...p,
        projecao: (p as typeof p & { projecao?: number }).projecao ?? (idx === s.length - 4 ? p.mrr : undefined),
      }));
    }
    return s;
  })();

  // Combinar serie MRR com pagamentosHistorico para gráfico duplo
  const receitaMap = Object.fromEntries(data.pagamentosHistorico.map(p => [p.mes, p.valor]));
  const serieComReceita = data.serie.map(s => ({
    ...s,
    receitaReal: receitaMap[s.mes] ?? null,
  }));

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
          trend={data.crescimentoMoM}
          trendLabel="vs mês ant."
        />
        <MetricCard
          label="Partners Ativos"
          value={data.totalAtivos.toString()}
          sub={`${data.ativosPartner} Partner · ${data.ativosPro} PRO`}
          icon={Users}
          color="#A78BFA"
          trend={data.crescimentoPartnersM}
          trendLabel="vs mês ant."
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
          trend={data.crescimentoTicketM}
          trendLabel="vs mês ant."
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

      {/* Régua de Cobrança / Inadimplência */}
      <InadimplenciaSection data={data} />

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* MRR histórico + Projeção */}
        <div className="rounded-2xl border border-white/5 p-4" style={{ background: NAVY_CARD }}>
          <p className="text-sm font-semibold text-white mb-1">MRR — Histórico + Projeção</p>
          <p className="text-[10px] mb-4" style={{ color: MUTED }}>Linha sólida = real · Tracejada = projeção (3 meses)</p>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={serieComProjecao} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="projecao"
                name="Projeção"
                stroke={GOLD}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* MRR vs Receita Real */}
        <div className="rounded-2xl border border-white/5 p-4" style={{ background: NAVY_CARD }}>
          <p className="text-sm font-semibold text-white mb-1">MRR vs Receita Real</p>
          <p className="text-[10px] mb-4" style={{ color: MUTED }}>Ouro = MRR esperado · Azul = pagamentos registrados</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={serieComReceita} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
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
              <Bar dataKey="mrr" name="MRR Esperado" fill={GOLD} radius={[4, 4, 0, 0]} opacity={0.7} />
              <Bar dataKey="receitaReal" name="Receita Real" fill="#60A5FA" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11, color: MUTED, paddingTop: 8 }} />
            </BarChart>
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

        {/* Composição da base */}
        <div className="rounded-2xl border border-white/5 p-4" style={{ background: NAVY_CARD }}>
          <p className="text-sm font-semibold text-white mb-4">Composição da Base</p>
          <div className="space-y-4">
            {[
              { label: "Partner (30%)", count: data.ativosPartner, color: "#60A5FA", pct: data.totalAtivos ? Math.round(data.ativosPartner / data.totalAtivos * 100) : 0 },
              { label: "Partner PRO (50%)", count: data.ativosPro, color: GOLD, pct: data.totalAtivos ? Math.round(data.ativosPro / data.totalAtivos * 100) : 0 },
              { label: "Total cadastros", count: data.totalPartners, color: "#A78BFA", pct: 100 },
              { label: "Taxa de ativos", count: data.totalPartners > 0 ? `${Math.round(data.totalAtivos / data.totalPartners * 100)}%` : "—", color: "#34D399", pct: data.totalPartners > 0 ? Math.round(data.totalAtivos / data.totalPartners * 100) : 0 },
            ].map(item => (
              <div key={item.label} className="space-y-1.5">
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
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metas sugeridas */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ background: `${GOLD}08`, borderColor: `${GOLD}30` }}>
        <p className="text-sm font-semibold" style={{ color: GOLD }}>Metas Sugeridas para Escala</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { fase: "Fase 1 (0–3m)", meta: "50 ativos · MRR R$25k", alvo: 50, mrrAlvo: 25000, cor: "#34D399" },
            { fase: "Fase 2 (3–6m)", meta: "150 ativos · MRR R$75k", alvo: 150, mrrAlvo: 75000, cor: GOLD },
            { fase: "Fase 3 (6–12m)", meta: "400 ativos · MRR R$200k", alvo: 400, mrrAlvo: 200000, cor: "#F59E0B" },
          ].map(m => (
            <div key={m.fase} className="rounded-xl border border-white/5 p-3" style={{ background: "#0F1E35" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: m.cor }}>{m.fase}</p>
              <p className="text-sm font-semibold text-white">{m.meta}</p>
              <div className="mt-2 space-y-1.5">
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5" style={{ color: MUTED }}>
                    <span>Partners</span>
                    <span>{data.totalAtivos}/{m.alvo}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(data.totalAtivos / m.alvo * 100))}%`, background: m.cor }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5" style={{ color: MUTED }}>
                    <span>MRR</span>
                    <span>{Math.round(data.mrr / 1000)}k/{Math.round(m.mrrAlvo / 1000)}k</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.round(data.mrr / m.mrrAlvo * 100))}%`, background: m.cor }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
