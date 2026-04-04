"use client";

import React from "react";
import {
  TrendingUp,
  Building2,
  Headphones,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  CircleDot,
  CheckCircle2,
  Clock,
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

const revenueData = [
  { month: "Out", value: 4200000 },
  { month: "Nov", value: 5800000 },
  { month: "Dez", value: 4900000 },
  { month: "Jan", value: 7100000 },
  { month: "Fev", value: 6300000 },
  { month: "Mar", value: 8900000 },
];

const operationsData = [
  { name: "Split Fiscal", valor: 42 },
  { name: "M&A", valor: 18 },
  { name: "Mesa Crédito", valor: 67 },
  { name: "Operacional", valor: 31 },
];

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

interface DashboardClientProps {
  role: string;
  userName: string;
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
  kpis,
  recentSplits,
  recentDeals,
}: DashboardClientProps) {
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Market Ticker */}
      <MarketTicker />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          {greeting},{" "}
          <span className="gradient-text">{userName.split(" ")[0]}</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Aqui está o resumo da sua plataforma —{" "}
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Split Fiscal"
          value={kpis.totalSplits}
          icon={<TrendingUp className="w-5 h-5 text-blue-400" />}
          change={12}
          color="bg-blue-500/20"
          subtitle="operações totais"
        />
        <KpiCard
          title="Deals M&A"
          value={kpis.totalDeals}
          icon={<Building2 className="w-5 h-5 text-purple-400" />}
          change={8}
          color="bg-purple-500/20"
          subtitle="em pipeline"
        />
        <KpiCard
          title="Tickets Abertos"
          value={kpis.openTickets}
          icon={<Headphones className="w-5 h-5 text-amber-400" />}
          change={-3}
          color="bg-amber-500/20"
          subtitle="pendentes/análise"
        />
        <KpiCard
          title="Propostas Crédito"
          value={kpis.pendingProposals}
          icon={<CreditCard className="w-5 h-5 text-emerald-400" />}
          change={15}
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
              {formatCurrency(8900000)}
            </p>
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              +41% vs mês anterior
            </p>
          </CardHeader>
          <CardContent>
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
