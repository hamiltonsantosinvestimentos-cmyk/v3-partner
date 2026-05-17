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
  Users,
  DollarSign,
  Crown,
  AlertCircle,
  Phone,
  Download,
  CalendarDays,
  ShoppingBag,
  Target,
  Trophy,
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
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";


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
            Renove sua assinatura para continuar usando a plataforma.
          </p>
        </div>
        <a href="/minha-assinatura"
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/30 transition-colors">
          <CreditCard className="w-3.5 h-3.5" />
          Renovar
        </a>
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
        </p>
      </div>
      {isUrgent || isWarning ? (
        <a href="/minha-assinatura"
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            isUrgent
              ? "bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
              : "bg-amber-400/20 border border-amber-400/40 text-amber-400 hover:bg-amber-400/30"
          }`}>
          <CreditCard className="w-3.5 h-3.5" />
          Renovar
        </a>
      ) : null}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

interface RedeHealth {
  partnersAtivos: number;
  partnersPRO: number;
  mrr: number;
  comissoesPendentes: number;
  vencendo7d: number;
}

interface MetaMes {
  goal_proposals: number;
  goal_approvals: number;
  goal_volume: number;
  goal_deals: number;
  atual_proposals: number;
  atual_approvals: number;
  atual_volume: number;
  atual_deals: number;
}

interface DashboardClientProps {
  role: string;
  userName: string;
  period?: string;
  userCreatedAt?: string | null;
  revenueData?: Array<{ month: string; value: number }>;
  redeHealth?: RedeHealth | null;
  kpis: {
    totalSplits: number;
    totalDeals: number;
    openTickets: number;
    pendingProposals: number;
  };
  kpiChanges?: {
    splits?: number;
    deals?: number;
    proposals?: number;
  };
  marketplaceLeads?: number;
  comissoesAPagar?: number;
  metaMes?: MetaMes | null;
  topPartners?: Array<{ id: string; full_name: string; count: number }>;
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
  recentProposals?: Array<{
    id: string;
    code: string;
    title: string;
    client_name: string;
    requested_value: number;
    current_level: string;
    status: string;
    created_at: string;
  }>;
  followUps?: Array<{
    id: string;
    name: string;
    phone: string | null;
    next_contact: string;
    status: string;
    segment: string | null;
  }>;
}

export function DashboardClient({
  role,
  userName,
  period = "30d",
  userCreatedAt,
  revenueData = [],
  redeHealth,
  kpis,
  kpiChanges,
  marketplaceLeads = 0,
  comissoesAPagar = 0,
  metaMes,
  topPartners = [],
  recentSplits,
  recentDeals,
  recentProposals = [],
  followUps = [],
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

      {/* Onboarding Guiado — primeiros passos para partners */}
      <OnboardingBanner role={role} hasFullName={!!userName && userName !== "Usuário"} />

      {/* Trial Banner — apenas para PARTNER e PARTNER_PRO */}
      {userCreatedAt && (
        <TrialBanner createdAt={userCreatedAt} role={role} />
      )}

      {/* Próximos Passos — apenas para partners */}
      {["PARTNER", "PARTNER_PRO"].includes(role) && (
        <div className="rounded-xl border border-[#243A66] bg-[#111F35] p-4">
          <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-3">Comece por aqui</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: "/mesa-credito", icon: <CreditCard className="w-4 h-4" />, label: "Enviar Proposta de Crédito", desc: "Indique um cliente para a mesa" },
              { href: "/marketplace", icon: <ShoppingBag className="w-4 h-4" />, label: "Explorar Marketplace", desc: "Produtos com comissão para vender" },
              { href: "/crm", icon: <Users className="w-4 h-4" />, label: "Gerenciar CRM", desc: "Seus leads e follow-ups" },
              { href: "/academy", icon: <Crown className="w-4 h-4" />, label: "Academy V3", desc: "Treinamentos e certificações" },
            ].map(item => (
              <a key={item.href} href={item.href}
                className="group flex items-start gap-3 p-3 rounded-lg bg-[#09081A] border border-[#243A66] hover:border-[#C9A84C]/40 transition-all cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0 text-[#C9A84C] group-hover:bg-[#C9A84C]/20 transition-colors">
                  {item.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#F0ECE4] leading-tight">{item.label}</p>
                  <p className="text-[10px] text-[#7A8FA8] mt-0.5 leading-tight">{item.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
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
          change={kpiChanges?.splits}
        />
        <KpiCard
          title="Deals M&A"
          value={kpis.totalDeals}
          icon={<Building2 className="w-5 h-5 text-purple-400" />}
          color="bg-purple-500/20"
          subtitle="em pipeline"
          change={kpiChanges?.deals}
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
          change={kpiChanges?.proposals}
        />
      </div>

      {/* KPI extra — Marketplace + Comissões (partners) */}
      {["PARTNER", "PARTNER_PRO"].includes(role) && (
        <div className="grid grid-cols-2 gap-4">
          <KpiCard
            title="Leads Marketplace"
            value={marketplaceLeads}
            icon={<ShoppingBag className="w-5 h-5 text-emerald-400" />}
            color="bg-emerald-500/20"
            subtitle="leads enviados"
          />
          <KpiCard
            title="Comissões a Receber"
            value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(comissoesAPagar)}
            icon={<DollarSign className="w-5 h-5 text-amber-400" />}
            color="bg-amber-500/20"
            subtitle="aguardando pagamento"
          />
        </div>
      )}

      {/* Saúde da Rede — só para ADMIN/GESTAO */}
      {redeHealth && ["ADMIN", "GESTAO", "FINANCEIRO"].includes(role) && (
        <div className="rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 p-4">
          <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-3">Saúde da Rede de Partners</p>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{redeHealth.partnersAtivos}</p>
                <p className="text-[10px] text-muted-foreground">Partners Ativos</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Crown className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{redeHealth.partnersPRO}</p>
                <p className="text-[10px] text-muted-foreground">Partners PRO</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-[#C9A84C]" />
              </div>
              <div>
                <p className="text-lg font-bold text-[#C9A84C]">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(redeHealth.mrr)}</p>
                <p className="text-[10px] text-muted-foreground">MRR</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(redeHealth.comissoesPendentes)}</p>
                <p className="text-[10px] text-muted-foreground">Comissões Pendentes</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${redeHealth.vencendo7d > 0 ? "bg-red-500/20" : "bg-secondary"}`}>
                <AlertCircle className={`w-4 h-4 ${redeHealth.vencendo7d > 0 ? "text-red-400" : "text-muted-foreground"}`} />
              </div>
              <div>
                <p className={`text-lg font-bold ${redeHealth.vencendo7d > 0 ? "text-red-400" : "text-white"}`}>{redeHealth.vencendo7d}</p>
                <p className="text-[10px] text-muted-foreground">Vencendo em 7d</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Widget de Metas do Mês — partners */}
      {metaMes && ["PARTNER", "PARTNER_PRO"].includes(role) && (
        <div className="rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 p-4">
          <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Metas do Mês
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Propostas", atual: metaMes.atual_proposals, meta: metaMes.goal_proposals, color: "#60A5FA" },
              { label: "Aprovações", atual: metaMes.atual_approvals, meta: metaMes.goal_approvals, color: "#34D399" },
              { label: "Volume", atual: metaMes.atual_volume, meta: metaMes.goal_volume, color: "#C9A84C", isCurrency: true },
              { label: "Deals M&A", atual: metaMes.atual_deals, meta: metaMes.goal_deals, color: "#A78BFA" },
            ].map(m => {
              if (m.meta === 0) return null;
              const pct = Math.min(100, m.meta > 0 ? Math.round((m.atual / m.meta) * 100) : 0);
              const fmtVal = (v: number) => m.isCurrency
                ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v)
                : v.toString();
              return (
                <div key={m.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                    <span className="text-xs font-bold" style={{ color: m.color }}>{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: m.color }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {fmtVal(m.atual)} / {fmtVal(m.meta)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ranking rápido — top 5 partners (admin) */}
      {topPartners.length > 0 && ["ADMIN", "GESTAO"].includes(role) && (
        <div className="rounded-xl border border-[#243A66] bg-[#111F35] p-4">
          <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Top Partners — Propostas no Mês
          </p>
          <div className="space-y-2">
            {topPartners.map((p, idx) => {
              const max = topPartners[0].count;
              const pct = max > 0 ? Math.round((p.count / max) * 100) : 0;
              const medals = ["🥇", "🥈", "🥉"];
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="text-base w-6 flex-shrink-0">{medals[idx] ?? `${idx + 1}.`}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground truncate">{p.full_name}</span>
                      <span className="text-xs font-bold text-[#C9A84C] ml-2 flex-shrink-0">{p.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full rounded-full bg-[#C9A84C]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <a href="/ranking" className="text-xs text-[#C9A84C] hover:text-[#E8C97A] transition-colors mt-3 block">
            Ver ranking completo →
          </a>
        </div>
      )}

      {/* Exportar Relatório Gerencial — apenas ADMIN/GESTAO/FINANCEIRO */}
      {["ADMIN", "GESTAO", "FINANCEIRO"].includes(role) && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              const rows = [
                ["Métrica", "Valor"],
                ["Split Fiscal", kpis.totalSplits],
                ["Deals M&A", kpis.totalDeals],
                ["Tickets Abertos", kpis.openTickets],
                ["Propostas Crédito", kpis.pendingProposals],
                ...(redeHealth ? [
                  ["Partners Ativos", redeHealth.partnersAtivos],
                  ["Partners PRO", redeHealth.partnersPRO],
                  ["MRR (R$)", redeHealth.mrr],
                  ["Comissões Pendentes (R$)", redeHealth.comissoesPendentes],
                  ["Vencendo 7d", redeHealth.vencendo7d],
                ] : []),
              ];
              const now = new Date().toLocaleDateString("pt-BR");
              const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>Relatório V3 Partners</title>
              <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1a1a2e;background:#fff}
              .header{background:linear-gradient(135deg,#09081A,#111F35);color:#F0ECE4;padding:24px 32px;display:flex;justify-content:space-between;align-items:center}
              .header h1{font-size:18px;font-weight:700;color:#C9A84C}.header .sub{font-size:11px;color:#7A8FA8;margin-top:4px}
              table{width:100%;border-collapse:collapse;margin:24px 32px;width:calc(100% - 64px)}
              th{background:#111F35;color:#C9A84C;font-size:10px;text-transform:uppercase;letter-spacing:.1em;padding:10px 14px;text-align:left}
              td{padding:10px 14px;border-bottom:1px solid #e5e7eb;font-size:12px}tr:nth-child(even)td{background:#f9fafb}
              .footer{margin:24px 32px;font-size:9px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
              @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
              <body><div class="header"><div><h1>Relatório Gerencial — V3 Partners</h1><div class="sub">Período: ${PERIOD_LABELS[period] ?? period} · Gerado em ${now}</div></div></div>
              <table><thead><tr>${rows[0].map(h => `<th>${h}</th>`).join("")}</tr></thead>
              <tbody>${rows.slice(1).map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
              <div class="footer">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br</div></body></html>`;
              const win = window.open("", "_blank");
              if (win) { win.document.write(html); win.document.close(); win.print(); }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-[#C9A84C]/30 text-[#C9A84C] bg-[#C9A84C]/5 hover:bg-[#C9A84C]/15 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar Relatório
          </button>
        </div>
      )}

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
                <a
                  key={deal.id}
                  href={`/ma/${deal.id}`}
                  className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 hover:bg-secondary/40 rounded px-1 -mx-1 transition-colors cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-[#E8C97A] transition-colors">
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
                </a>
              ))
            )}
          </CardContent>
        </Card>

        {/* Follow-ups da Semana — CRM */}
        {followUps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-amber-400" /> Follow-ups da Semana</span>
                <a href="/crm" className="text-xs text-[#C9A84C] hover:text-[#E8C97A] transition-colors">Ver CRM →</a>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {followUps.map((lead) => {
                const d = new Date(lead.next_contact + "T00:00:00");
                const hoje = new Date(); hoje.setHours(0,0,0,0);
                const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000);
                const urgente = dias === 0;
                const amanha = dias === 1;
                return (
                  <a key={lead.id} href="/crm"
                    className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 hover:bg-secondary/40 rounded px-1 -mx-1 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-[#E8C97A] transition-colors">{lead.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {lead.phone && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{lead.phone}</span>}
                        {lead.segment && <span className="text-[10px] text-muted-foreground">{lead.segment}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${urgente ? "bg-red-500/20 text-red-400" : amanha ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                        {urgente ? "Hoje" : amanha ? "Amanhã" : `${dias}d`}
                      </span>
                    </div>
                  </a>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Recent Credit Proposals */}
        {recentProposals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span>Propostas de Crédito Recentes</span>
                <a href="/mesa-credito" className="text-xs text-[#C9A84C] hover:text-[#E8C97A] transition-colors">
                  Ver mesa →
                </a>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentProposals.map((p) => {
                const nivelMap: Record<string, string> = {
                  NIVEL_1: "/mesa-credito/nivel-1",
                  NIVEL_2: "/mesa-credito/nivel-2",
                  NIVEL_3: "/mesa-credito/nivel-3",
                };
                const nivelLabel: Record<string, string> = {
                  NIVEL_1: "N1 Varejo",
                  NIVEL_2: "N2 Estruturado",
                  NIVEL_3: "N3 High Ticket",
                };
                const href = nivelMap[p.current_level] ?? "/mesa-credito";
                return (
                  <a
                    key={p.id}
                    href={href}
                    className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 hover:bg-secondary/40 rounded px-1 -mx-1 transition-colors cursor-pointer group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate group-hover:text-[#E8C97A] transition-colors">
                        {p.client_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.code} · {formatDate(p.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <span className="text-sm font-semibold text-white">
                        {formatCurrency(p.requested_value)}
                      </span>
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded whitespace-nowrap">
                        {nivelLabel[p.current_level] ?? p.current_level}
                      </span>
                      <Badge className={`text-[10px] ${STATUS_COLORS[p.status as OperationStatus]}`}>
                        {STATUS_LABELS[p.status as OperationStatus]}
                      </Badge>
                    </div>
                  </a>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
