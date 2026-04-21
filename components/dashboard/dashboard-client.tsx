"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  Building2,
  Headphones,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  ShieldOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, type OperationStatus } from "@/lib/constants";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { MarketTicker } from "@/components/dashboard/market-ticker";
import { NotificationBell } from "@/components/dashboard/notification-bell";


interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: number;
  color: string;
  subtitle?: string;
}

function KpiCard({ title, value, icon, change, color, subtitle }: KpiCardProps) {
  return (
    <div className="kpi-card group hover:border-border transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              change >= 0 ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {change >= 0 ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

const PERIOD_LABELS: Record<string, string> = {
  "7d":  "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  "all": "Tudo",
};

// ─── Trial Banner (30 dias) ───────────────────────────────────────────────────
const TRIAL_DAYS = 30;

function getDaysLeft(createdAt: string): number {
  if (typeof window === "undefined") return TRIAL_DAYS; // SSR: valor neutro
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  return Math.max(TRIAL_DAYS - elapsed, 0);
}

function TrialBanner({ createdAt, role }: { createdAt: string; role: string }) {
  const partnerRoles = ["PARTNER", "PARTNER_PRO"];
  if (!partnerRoles.includes(role)) return null;

  const daysLeft = getDaysLeft(createdAt);
  const pct = Math.round((daysLeft / TRIAL_DAYS) * 100);
  const expired = daysLeft === 0;

  if (expired) {
    return (
      <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-red-500/30 bg-red-500/8">
        <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
          <ShieldOff className="w-5 h-5 text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-red-400">Seu período de acesso expirou.</p>
          <p className="text-xs text-red-400/70 mt-0.5">
            Entre em contato com o administrador para reativar sua conta.
          </p>
        </div>
      </div>
    );
  }

  const isUrgent = daysLeft <= 5;
  const isWarning = daysLeft <= 10 && daysLeft > 5;
  const barColor = isUrgent ? "bg-red-500" : isWarning ? "bg-amber-400" : "bg-emerald-500";
  const borderColor = isUrgent ? "border-red-500/30" : isWarning ? "border-amber-400/30" : "border-emerald-500/20";
  const bgColor = isUrgent ? "bg-red-500/8" : isWarning ? "bg-amber-400/8" : "bg-emerald-500/8";
  const iconColor = isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400";
  const textColor = isUrgent ? "text-red-400" : isWarning ? "text-amber-400" : "text-emerald-400";
  const Icon = isUrgent ? AlertTriangle : Clock;

  return (
    <div className={`flex items-center gap-4 px-5 py-4 rounded-xl border ${borderColor} ${bgColor}`}>
      <div className={`w-10 h-10 rounded-xl ${isUrgent ? "bg-red-500/15" : isWarning ? "bg-amber-400/15" : "bg-emerald-500/15"} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <p className={`text-sm font-bold ${textColor}`}>
            {isUrgent
              ? `⚠️ Apenas ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} restantes no seu bônus de 30 dias!`
              : `Faltam ${daysLeft} dias para o seu bônus de 30 dias acabar.`}
          </p>
          <span className={`text-xs font-semibold ${textColor} ml-4 flex-shrink-0`}>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Expira em {new Date(new Date(createdAt).getTime() + TRIAL_DAYS * 86400000).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          {" · "}Fale com seu administrador para renovar o acesso.
        </p>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

interface DashboardClientProps {
  role: string;
  userName: string;
  period?: string;
  userCreatedAt?: string | null;
  revenueData?: Array<{ month: string; value: number }>;
  kpis: {
    totalSplits: number;
    totalDeals: number;
    openTickets: number;
    pendingProposals: number;
  };
  recentSplits: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
    total_value: number;
    created_at: string;
  }>;
  recentDeals: Array<{
    id: string;
    code: string;
    title: string;
    stage: string;
    deal_value: number | null;
    target_company: string;
    created_at: string;
  }>;
}

export function DashboardClient({
  role,
  userName,
  period = "30d",
  userCreatedAt,
  revenueData = [],
  kpis,
  recentSplits,
  recentDeals,
}: DashboardClientProps) {
  const router = useRouter();
  const [greeting, setGreeting] = useState("Olá");
  const [dateStr, setDateStr] = useState("");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite");
    setDateStr(new Date().toLocaleDateString("pt-BR", {
      weekday: "long", day: "numeric", month: "long",
    }));
  }, []);

  function setPeriod(p: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("period", p);
    router.push(url.pathname + url.search);
  }

  const operationsData = [
    { name: "Split Fiscal", valor: kpis.totalSplits },
    { name: "M&A", valor: kpis.totalDeals },
    { name: "Mesa Crédito", valor: kpis.pendingProposals },
    { name: "Tickets", valor: kpis.openTickets },
  ];

  const totalOperacoes = kpis.totalSplits + kpis.totalDeals + kpis.pendingProposals + kpis.openTickets;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Market Ticker */}
      <MarketTicker />

      {/* Trial Banner — apenas para PARTNER e PARTNER_PRO */}
      {userCreatedAt && (
        <TrialBanner createdAt={userCreatedAt} role={role} />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {greeting},{" "}
            <span className="gradient-text">{userName.split(" ")[0]}</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Aqui está o resumo da sua plataforma —{" "}
            {dateStr}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Filtro de período */}
          <div className="flex items-center gap-1 bg-[#0D1929] border border-border rounded-lg p-1">
            {Object.entries(PERIOD_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  period === key
                    ? "bg-[#C4922E] text-[#070E1A]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Sino de notificações */}
          <NotificationBell />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Split Fiscal"
          value={kpis.totalSplits}
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
          color="bg-blue-500/20"
          subtitle="operações totais"
        />
        <KpiCard
          title="Deals M&A"
          value={kpis.totalDeals}
          icon={<Building2 className="w-5 h-5 text-purple-400" />}
          color="bg-purple-500/20"
          subtitle="em pipeline"
        />
        <KpiCard
          title="Tickets Abertos"
          value={kpis.openTickets}
          icon={<Headphones className="w-5 h-5 text-amber-400" />}
          color="bg-amber-500/20"
          subtitle="pendentes/análise"
        />
        <KpiCard
          title="Propostas Crédito"
          value={kpis.pendingProposals}
          icon={<CreditCard className="w-5 h-5 text-emerald-400" />}
          color="bg-emerald-500/20"
          subtitle="em análise"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Volume de Operações
            </CardTitle>
            <p className="text-2xl font-bold text-white mt-1">
              {totalOperacoes}
            </p>
            <p className="text-xs text-muted-foreground">
              operações cadastradas na plataforma
            </p>
          </CardHeader>
          <CardContent>
            {revenueData.every(d => d.value === 0) ? (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">
                Nenhuma operação registrada no período
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#122036" />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#7A8FA8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#7A8FA8", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `R$${(v / 1000000).toFixed(1)}M`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#091221",
                    border: "1px solid rgba(196,146,46,0.2)",
                    borderRadius: "10px",
                    color: "#E8EDF5",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [formatCurrency(value), "Volume"]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#C9A84C"
                  strokeWidth={2}
                  fill="url(#goldGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Operations Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Por Módulo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={operationsData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#122036" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#7A8FA8", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#8BA4BE", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#091221",
                    border: "1px solid rgba(196,146,46,0.2)",
                    borderRadius: "10px",
                    color: "#E8EDF5",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="valor" fill="#C9A84C" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Splits */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Últimas Operações Split Fiscal</span>
              <a href="/split-fiscal" className="text-xs text-[#C9A84C] hover:text-[#E8C97A] transition-colors">
                Ver todas →
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentSplits.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm">Nenhuma operação encontrada</p>
              </div>
            ) : (
              recentSplits.map((split) => (
                <div
                  key={split.id}
                  className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {split.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {split.code} · {formatDate(split.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-sm font-semibold text-white">
                      {formatCurrency(split.total_value)}
                    </span>
                    <Badge
                      className={`text-[10px] ${STATUS_COLORS[split.status as OperationStatus]}`}
                    >
                      {STATUS_LABELS[split.status as OperationStatus]}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent M&A */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <span>Pipeline M&A</span>
              <a href="/ma" className="text-xs text-[#C9A84C] hover:text-[#E8C97A] transition-colors">
                Ver pipeline →
              </a>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentDeals.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground text-sm">Nenhum deal encontrado</p>
              </div>
            ) : (
              recentDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {deal.target_company}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {deal.code} · {formatDate(deal.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {deal.deal_value && (
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(deal.deal_value)}
                      </span>
                    )}
                    <span className="text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded">
                      {deal.stage}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
