"use client";

import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Building2, BarChart3, Layers, AlertTriangle } from "lucide-react";

// ─── Paleta V3 ────────────────────────────────────────────────────────────────
const V3 = {
  gold: "#C9A84C", goldLt: "#E8C97A",
  navy: "#09081A", navyMid: "#162744", navyBrd: "#243A66",
  cream: "#F0ECE4", muted: "#7A8FA8",
  green: "#4CAF7D", amber: "#E89B3A", red: "#E05555",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type RevenuePoint    = { ano: number; valor: number; tipo: string };
type Scenario        = { noi_anual: number | null; cap_rate: number | null; valuation: number | null };
type VacancyItem     = { pavimento: string; pct: number };
type DespesaItem     = { name: string; valor: number };

type Projections = {
  receita?:            RevenuePoint[];
  scenarios?:          { base?: Scenario; estabilizado?: Scenario; expansao?: Scenario };
  vacancia_pct?:       VacancyItem[];
  despesas_breakdown?: Record<string, number>;
  noi_mensal?:         Array<{ mes: string; valor: number }>;
  last_updated?:       string;
};

type ProjectionsResponse = {
  deal_id: string; code: string; target_company: string;
  sector: string; deal_value: number;
  projections: Projections; has_structured_data: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mkFmt = (fn: (v: number) => string) => fn as any;

const TOOLTIP_STYLE = {
  backgroundColor: V3.navyMid,
  border: `1px solid ${V3.navyBrd}`,
  borderRadius: 8,
  color: V3.cream,
  fontSize: 12,
};

const PIE_COLORS = [V3.gold, V3.green, V3.amber, V3.muted, V3.red, V3.goldLt];

// ─── Props ────────────────────────────────────────────────────────────────────
interface DealAnalyticsPanelProps { dealId: string }

// ─── Component ────────────────────────────────────────────────────────────────
export function DealAnalyticsPanel({ dealId }: DealAnalyticsPanelProps) {
  const [data, setData] = useState<ProjectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);
    fetch(`/api/ma/projections/${dealId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Erro ao carregar projeções"); setLoading(false); });
  }, [dealId]);

  if (loading) return (
    <div className="flex items-center justify-center h-48 gap-2" style={{ color: V3.muted }}>
      <BarChart3 className="w-5 h-5 animate-pulse" style={{ color: V3.gold }} />
      <span className="text-sm">Carregando analytics...</span>
    </div>
  );

  if (error || !data) return (
    <div className="flex items-center gap-2 p-4 rounded-lg"
      style={{ background: `${V3.red}15`, border: `1px solid ${V3.red}30`, color: V3.red }}>
      <AlertTriangle className="w-4 h-4" />
      <span className="text-sm">{error ?? "Sem dados disponíveis."}</span>
    </div>
  );

  const proj = data.projections;

  const receitaData = (proj.receita ?? []).map(r => ({ ano: String(r.ano), valor: r.valor }));

  const scenarioData = [
    { name: "Base",        noi: (proj.scenarios?.base?.noi_anual ?? 0) / 1e6,        val: (proj.scenarios?.base?.valuation ?? data.deal_value) / 1e6 },
    { name: "Estabilizado",noi: (proj.scenarios?.estabilizado?.noi_anual ?? 0) / 1e6, val: (proj.scenarios?.estabilizado?.valuation ?? 0) / 1e6 },
    { name: "Expansão",    noi: (proj.scenarios?.expansao?.noi_anual ?? 0) / 1e6,     val: (proj.scenarios?.expansao?.valuation ?? 0) / 1e6 },
  ].filter(s => s.noi > 0 || s.val > 0);

  const vacanciaData = (proj.vacancia_pct ?? []).map(v => ({
    name: v.pavimento.charAt(0).toUpperCase() + v.pavimento.slice(1),
    value: Math.round(v.pct * 100),
  }));

  const despesasData: DespesaItem[] = Object.entries(proj.despesas_breakdown ?? {})
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => ({ name: k.replace(/_/g, " "), valor: v }));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4" style={{ color: V3.gold }} />
          <span className="text-sm font-semibold" style={{ color: V3.cream }}>Analytics Financeiro</span>
          {!data.has_structured_data && (
            <Badge style={{ background: `${V3.amber}20`, color: V3.amber, border: `1px solid ${V3.amber}40`, fontSize: 10 }}>
              Dados básicos
            </Badge>
          )}
        </div>
        {proj.last_updated && (
          <span className="text-xs" style={{ color: V3.muted }}>
            Atualizado: {new Date(proj.last_updated).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Valuation",    value: fmtBRL(data.deal_value),                              icon: <Building2 className="w-3.5 h-3.5" /> },
          { label: "NOI Base/ano", value: fmtBRL(proj.scenarios?.base?.noi_anual ?? null),       icon: <TrendingUp className="w-3.5 h-3.5" /> },
          { label: "Cap Rate",     value: fmtPct(proj.scenarios?.base?.cap_rate ?? null),        icon: <Layers className="w-3.5 h-3.5" /> },
        ].map(kpi => (
          <Card key={kpi.label} style={{ background: V3.navyMid, border: `1px solid ${V3.navyBrd}` }}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1" style={{ color: V3.muted }}>
                {kpi.icon}
                <span className="text-[10px] font-semibold uppercase tracking-wider">{kpi.label}</span>
              </div>
              <div className="text-lg font-bold" style={{ color: V3.gold }}>{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Receita anual */}
      {receitaData.length > 0 && (
        <Card style={{ background: V3.navyMid, border: `1px solid ${V3.navyBrd}` }}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold" style={{ color: V3.cream }}>Receita Anual</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={receitaData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="recGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={V3.gold} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={V3.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={V3.navyBrd} />
                <XAxis dataKey="ano" tick={{ fill: V3.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: V3.muted, fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={mkFmt(v => `R$${(v/1e6).toFixed(0)}M`)} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={mkFmt(v => fmtBRL(v))} />
                <Area type="monotone" dataKey="valor" stroke={V3.gold} strokeWidth={2}
                  fill="url(#recGrad)" dot={{ fill: V3.gold, r: 4 }} activeDot={{ r: 6, fill: V3.goldLt }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Cenários */}
        {scenarioData.length > 0 && (
          <Card style={{ background: V3.navyMid, border: `1px solid ${V3.navyBrd}` }}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold" style={{ color: V3.cream }}>Cenários de Retorno</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={scenarioData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={V3.navyBrd} />
                  <XAxis dataKey="name" tick={{ fill: V3.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: V3.muted, fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={mkFmt(v => `${v.toFixed(0)}M`)} />
                  <Tooltip contentStyle={TOOLTIP_STYLE}
                    formatter={mkFmt((v: number) => `R$ ${v.toFixed(1)}M`)} />
                  <Legend wrapperStyle={{ color: V3.muted, fontSize: 11 }} />
                  <Bar dataKey="val"  fill={V3.gold}  radius={[4,4,0,0]} name="Valuation (R$M)" />
                  <Bar dataKey="noi"  fill={V3.green} radius={[4,4,0,0]} name="NOI/ano (R$M)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Vacância */}
        {vacanciaData.length > 0 && (
          <Card style={{ background: V3.navyMid, border: `1px solid ${V3.navyBrd}` }}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold" style={{ color: V3.cream }}>Vacância por Pavimento (%)</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={vacanciaData} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                    dataKey="value" paddingAngle={3}>
                    {vacanciaData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={mkFmt((v: number) => `${v}%`)} />
                  <Legend wrapperStyle={{ color: V3.muted, fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Despesas */}
      {despesasData.length > 0 && (
        <Card style={{ background: V3.navyMid, border: `1px solid ${V3.navyBrd}` }}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold" style={{ color: V3.cream }}>Despesas Operacionais / mês</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            <ResponsiveContainer width="100%" height={Math.max(120, despesasData.length * 28)}>
              <BarChart data={despesasData} layout="vertical" margin={{ top: 0, right: 70, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={V3.navyBrd} horizontal={false} />
                <XAxis type="number" tick={{ fill: V3.muted, fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={mkFmt(v => `${(v/1000).toFixed(0)}K`)} />
                <YAxis type="category" dataKey="name" tick={{ fill: V3.muted, fontSize: 10 }}
                  axisLine={false} tickLine={false} width={90} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={mkFmt((v: number) => fmtBRL(v))} />
                <Bar dataKey="valor" fill={V3.amber} radius={[0,4,4,0]}
                  label={{ position: "right", fill: V3.muted, fontSize: 10,
                    formatter: mkFmt((v: number) => fmtBRL(v)) }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {!data.has_structured_data && (
        <p className="text-xs text-center py-3" style={{ color: V3.muted,
          background: V3.navyMid, border: `1px dashed ${V3.navyBrd}`, borderRadius: 8 }}>
          Adicione projeções via Q&A ou PATCH /api/ma/projections/{dealId} para gráficos completos.
        </p>
      )}
    </div>
  );
}
