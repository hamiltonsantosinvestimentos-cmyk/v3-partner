import Link from "next/link";
import {
  CreditCard,
  Home,
  Users,
  Building2,
  ArrowRight,
  TrendingUp,
  FileText,
  CheckCircle,
  Clock,
  DollarSign,
  Handshake,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cookies } from "next/headers";

const IS_DEMO = false;

interface LevelMetrics {
  total: number;
  volume: number;
  approved: number;
  thisMonth: number;
}

export default async function MesaCreditoPage() {
  let role = "ADMIN";
  let metrics: Record<"NIVEL_1" | "NIVEL_2" | "NIVEL_3", LevelMetrics> = {
    NIVEL_1: { total: 0, volume: 0, approved: 0, thisMonth: 0 },
    NIVEL_2: { total: 0, volume: 0, approved: 0, thisMonth: 0 },
    NIVEL_3: { total: 0, volume: 0, approved: 0, thisMonth: 0 },
  };
  let totalProposals = 0;
  let totalVolume = 0;
  let pendingCount = 0;
  let pendingPartnerOrders = 0;

  if (IS_DEMO) {
    try {
      const cookieStore = await cookies();
      const session = cookieStore.get("v3_demo_session")?.value;
      if (session) role = JSON.parse(session).role ?? "ADMIN";
    } catch {}
  } else {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user?.id ?? "")
        .single();
      role = (profileData as { role: string } | null)?.role || "PARTNER";

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [allResult, monthResult] = await Promise.allSettled([
        supabase
          .from("credit_desk_proposals")
          .select("current_level, status, requested_value"),
        supabase
          .from("credit_desk_proposals")
          .select("current_level, status, requested_value")
          .gte("created_at", monthStart),
      ]);

      if (allResult.status === "fulfilled" && allResult.value.data) {
        const rows = allResult.value.data as Array<{
          current_level: string;
          status: string;
          requested_value: number;
        }>;

        for (const row of rows) {
          const lvl = row.current_level as keyof typeof metrics;
          if (!metrics[lvl]) continue;
          metrics[lvl].total++;
          metrics[lvl].volume += row.requested_value ?? 0;
          if (row.status === "APPROVED" || row.status === "COMPLETED") {
            metrics[lvl].approved++;
          }
          totalProposals++;
          totalVolume += row.requested_value ?? 0;
          if (
            row.status !== "APPROVED" &&
            row.status !== "REJECTED" &&
            row.status !== "COMPLETED" &&
            row.status !== "CANCELLED"
          ) {
            pendingCount++;
          }
        }
      }

      if (monthResult.status === "fulfilled" && monthResult.value.data) {
        const monthRows = monthResult.value.data as Array<{
          current_level: string;
        }>;
        for (const row of monthRows) {
          const lvl = row.current_level as keyof typeof metrics;
          if (metrics[lvl]) metrics[lvl].thisMonth++;
        }
      }

      const { count: ordersCount } = await supabase
        .from("partner_service_orders")
        .select("id, partner_service_links!inner(service_type)", { count: "exact", head: true })
        .eq("status", "PAID")
        .is("report_delivered_at", null)
        .eq("partner_service_links.service_type", "credit_analysis");
      pendingPartnerOrders = ordersCount ?? 0;
    } catch {}
  }

  const fmt = (v: number) =>
    v >= 1_000_000
      ? `R$ ${(v / 1_000_000).toFixed(1)}M`
      : v >= 1_000
      ? `R$ ${(v / 1_000).toFixed(0)}K`
      : `R$ ${v.toFixed(0)}`;

  const convRate = (m: LevelMetrics) =>
    m.total > 0 ? Math.round((m.approved / m.total) * 100) : 0;

  const levels = [
    {
      href: "/mesa-credito/nivel-1",
      level: "Nível 1",
      levelKey: "NIVEL_1" as const,
      title: "Crédito Varejo",
      description: "Home Equity, HE Estressado e Aval — operações de varejo com garantias reais e pessoais",
      icon: Home,
      color: "from-blue-500 to-blue-600",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      textColor: "text-blue-400",
      products: ["Home Equity", "HE Estressado", "Aval", "Fundo Construção Residencial"],
      minValue: "A partir de R$ 10.000",
      allowed: true,
    },
    {
      href: "/mesa-credito/nivel-2",
      level: "Nível 2",
      levelKey: "NIVEL_2" as const,
      title: "Crédito Estruturado",
      description: "Operações complexas com estrutura especializada, garantias e instrumentos de mercado de capitais",
      icon: TrendingUp,
      color: "from-amber-500 to-orange-600",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/20",
      textColor: "text-amber-400",
      products: ["FIDC", "CRI", "CRA", "Debêntures", "Capital de Giro Estruturado"],
      minValue: "A partir de R$ 500.000",
      allowed: ["ADMIN", "MESA_OPERACIONAL", "GESTAO"].includes(role),
    },
    {
      href: "/mesa-credito/nivel-3",
      level: "Nível 3",
      levelKey: "NIVEL_3" as const,
      title: "High Ticket",
      description: "Operações de grande porte — project finance, M&A e real estate de alto valor",
      icon: Building2,
      color: "from-purple-500 to-violet-600",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
      textColor: "text-purple-400",
      products: ["Project Finance", "Infrastructure", "Real Estate", "Fusões & Aquisições"],
      minValue: "A partir de R$ 5.000.000",
      allowed: ["ADMIN", "GESTAO"].includes(role),
    },
  ];

  const summaryCards = [
    {
      label: "Total de Propostas",
      value: String(totalProposals),
      icon: FileText,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Volume Total",
      value: fmt(totalVolume),
      icon: DollarSign,
      color: "text-[#C9A84C]",
      bg: "bg-[#C9A84C]/10",
    },
    {
      label: "Em Andamento",
      value: String(pendingCount),
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Novas este Mês",
      value: String(
        metrics.NIVEL_1.thisMonth + metrics.NIVEL_2.thisMonth + metrics.NIVEL_3.thisMonth
      ),
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Mesa de Crédito</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestão de propostas de crédito em 3 níveis de complexidade
        </p>
      </div>

      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className={`flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card`}>
              <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">{card.label}</p>
                <p className={`text-lg font-bold ${card.color} leading-tight`}>{card.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Level Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="relative">
          {!["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(role) && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
              <div className="text-center">
                <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Acesso restrito</p>
              </div>
            </div>
          )}
          <Link href={["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(role) ? "/mesa-operacional/pedidos" : "#"}>
            <Card className="h-full hover:border-teal-400 transition-all duration-200 cursor-pointer group">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg">
                    <Handshake className="w-6 h-6 text-white" />
                  </div>
                  {pendingPartnerOrders > 0 && (
                    <span className="text-xs font-bold px-2 py-1 rounded-md bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      {pendingPartnerOrders} pendente{pendingPartnerOrders > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Pedidos de Partners</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Análises de crédito vendidas por partners e pagas pelo cliente, aguardando processamento e entrega do relatório
                  </p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Análise de Crédito Empresarial</span>
                  <ArrowRight className="w-4 h-4 text-teal-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
        {levels.map((level) => {
          const Icon = level.icon;
          const m = metrics[level.levelKey];
          return (
            <div key={level.href} className="relative">
              {!level.allowed && (
                <div className="absolute inset-0 bg-background/60 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
                  <div className="text-center">
                    <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Acesso restrito</p>
                  </div>
                </div>
              )}
              <Link href={level.allowed ? level.href : "#"}>
                <Card className={`h-full hover:border-${level.textColor} transition-all duration-200 cursor-pointer group`}>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${level.color} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${level.bgColor} ${level.textColor} border ${level.borderColor}`}>
                        {level.level}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white">{level.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{level.description}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {level.products.map((product) => (
                        <span key={product} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
                          {product}
                        </span>
                      ))}
                    </div>

                    {/* ── Métricas por nível ── */}
                    {m.total > 0 && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
                        <div className="text-center">
                          <p className={`text-sm font-bold ${level.textColor}`}>{m.total}</p>
                          <p className="text-[9px] text-muted-foreground">Total</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-bold ${level.textColor}`}>{fmt(m.volume)}</p>
                          <p className="text-[9px] text-muted-foreground">Volume</p>
                        </div>
                        <div className="text-center">
                          <p className={`text-sm font-bold ${level.textColor}`}>{convRate(m)}%</p>
                          <p className="text-[9px] text-muted-foreground">Aprovação</p>
                        </div>
                      </div>
                    )}

                    {m.total === 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <span className="text-xs text-muted-foreground">{level.minValue}</span>
                        <ArrowRight className={`w-4 h-4 ${level.textColor} group-hover:translate-x-1 transition-transform`} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </div>
          );
        })}
      </div>

      {/* ── Resumo de conversão ── */}
      {totalProposals > 0 && (
        <div className="rounded-xl border border-border/50 bg-card p-5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Taxa de Conversão por Nível</p>
          <div className="space-y-3">
            {levels.map((level) => {
              const m = metrics[level.levelKey];
              const rate = convRate(m);
              return (
                <div key={level.levelKey} className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold w-14 flex-shrink-0 ${level.textColor}`}>{level.level}</span>
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${level.color} transition-all duration-700`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-white w-10 text-right flex-shrink-0">{rate}%</span>
                  <span className="text-[10px] text-muted-foreground w-20 text-right flex-shrink-0">
                    {m.approved}/{m.total} propostas
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
