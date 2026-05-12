import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DEMO_SPLITS, DEMO_DEALS, DEMO_CREDIT_PROPOSALS, DEMO_TICKETS
} from "@/lib/demo-data";

export const dynamic = "force-dynamic";

const IS_DEMO = false;

type Period = "7d" | "30d" | "90d" | "all";

function periodToDate(period: Period): string | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = (["7d", "30d", "90d", "all"].includes(params.period ?? "")
    ? params.period
    : "30d") as Period;

  if (IS_DEMO) {
    const cookieStore = await cookies();
    const session = JSON.parse(
      cookieStore.get("v3_demo_session")?.value || "{}"
    );

    return (
      <DashboardClient
        role={session.role || "PARTNER"}
        userName={session.full_name || "Usuário"}
        period={period}
        kpis={{
          totalSplits: DEMO_SPLITS.length,
          totalDeals: DEMO_DEALS.length,
          openTickets: DEMO_TICKETS.filter((t) =>
            ["PENDING", "IN_REVIEW"].includes(t.status)
          ).length,
          pendingProposals: DEMO_CREDIT_PROPOSALS.filter((p) =>
            ["PENDING", "IN_REVIEW"].includes(p.status)
          ).length,
        }}
        recentSplits={DEMO_SPLITS.slice(0, 5).map((s) => ({
          id: s.id, code: s.code, title: s.title,
          status: s.status, total_value: s.total_value, created_at: s.created_at,
        }))}
        recentDeals={DEMO_DEALS.slice(0, 5).map((d) => ({
          id: d.id, code: d.code, title: d.title,
          stage: d.stage, deal_value: d.deal_value,
          target_company: d.target_company, created_at: d.created_at,
        }))}
      />
    );
  }

  // Production mode
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data: profileData } = await supabase
    .from("profiles").select("role, full_name, created_at").eq("id", user.id).single() as {
      data: { role: string; full_name: string | null; created_at: string | null } | null
    };

  const role = profileData?.role || "PARTNER";
  const since = periodToDate(period);
  const adminRoles = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
  const isAdmin = adminRoles.includes(role);
  // Sanitiza uid: garante que é UUID válido antes de usar em queries string
  const uidRaw = user.id;
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(uidRaw)) {
    return redirect("/unauthorized");
  }
  const uid = uidRaw;

  // Usa serviceClient para garantir leitura mesmo com RLS restritivo
  const { createClient: sc } = await import("@supabase/supabase-js");
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Contadores — partner vê só os seus, admin vê todos
  let splitCountQ = svc.from("split_fiscal").select("*", { count: "exact", head: true });
  let dealCountQ  = svc.from("ma_deals").select("*", { count: "exact", head: true });
  let propCountQ  = svc.from("credit_desk_proposals").select("*", { count: "exact", head: true }).in("status", ["PENDING", "IN_REVIEW"]);
  let ticketCountQ = svc.from("operational_tickets").select("*", { count: "exact", head: true }).in("status", ["PENDING", "IN_REVIEW"]);

  if (!isAdmin) {
    splitCountQ = splitCountQ.or(`created_by.eq.${uid},partner_id.eq.${uid}`) as typeof splitCountQ;
    dealCountQ  = dealCountQ.or(`created_by.eq.${uid},assigned_to.eq.${uid}`) as typeof dealCountQ;
    propCountQ  = propCountQ.eq("partner_id", uid) as typeof propCountQ;
    ticketCountQ = ticketCountQ.eq("created_by", uid) as typeof ticketCountQ;
  }
  if (since) {
    splitCountQ  = splitCountQ.gte("created_at", since) as typeof splitCountQ;
    dealCountQ   = dealCountQ.gte("created_at", since) as typeof dealCountQ;
    propCountQ   = propCountQ.gte("created_at", since) as typeof propCountQ;
  }

  const countsResult = await Promise.allSettled([splitCountQ, dealCountQ, ticketCountQ, propCountQ]);
  const totalSplits   = countsResult[0].status === "fulfilled" ? (countsResult[0].value.count ?? 0) : 0;
  const totalDeals    = countsResult[1].status === "fulfilled" ? (countsResult[1].value.count ?? 0) : 0;
  const totalTickets  = countsResult[2].status === "fulfilled" ? (countsResult[2].value.count ?? 0) : 0;
  const totalProposals = countsResult[3].status === "fulfilled" ? (countsResult[3].value.count ?? 0) : 0;

  // Recentes — mesmo filtro
  let splitsQ = svc.from("split_fiscal").select("id, code, title, status, total_value, created_at").order("created_at", { ascending: false }).limit(5);
  let dealsQ  = svc.from("ma_deals").select("id, code, title, stage, deal_value, target_company, created_at").order("created_at", { ascending: false }).limit(5);
  let propsQ  = svc.from("credit_desk_proposals").select("id, code, title, client_name, requested_value, current_level, status, created_at").order("created_at", { ascending: false }).limit(5);

  if (!isAdmin) {
    splitsQ = splitsQ.or(`created_by.eq.${uid},partner_id.eq.${uid}`) as typeof splitsQ;
    dealsQ  = dealsQ.or(`created_by.eq.${uid},assigned_to.eq.${uid}`) as typeof dealsQ;
    propsQ  = propsQ.eq("partner_id", uid) as typeof propsQ;
  }
  if (since) {
    splitsQ = splitsQ.gte("created_at", since) as typeof splitsQ;
    dealsQ  = dealsQ.gte("created_at", since) as typeof dealsQ;
    propsQ  = propsQ.gte("created_at", since) as typeof propsQ;
  }

  const [splitsResult, dealsResult, propsResult] = await Promise.allSettled([splitsQ, dealsQ, propsQ]);
  const recentSplits    = splitsResult.status === "fulfilled" ? (splitsResult.value.data ?? []) : [];
  const recentDeals     = dealsResult.status  === "fulfilled" ? (dealsResult.value.data  ?? []) : [];
  const recentProposals = propsResult.status  === "fulfilled" ? (propsResult.value.data  ?? []) : [];

  // Busca propostas dos últimos 12 meses para montar o gráfico de volume
  const dozeAtras = new Date();
  dozeAtras.setMonth(dozeAtras.getMonth() - 11);
  dozeAtras.setDate(1);
  dozeAtras.setHours(0, 0, 0, 0);

  let revenueQ = svc
    .from("credit_desk_proposals")
    .select("created_at, requested_value")
    .gte("created_at", dozeAtras.toISOString())
    .order("created_at", { ascending: true });

  if (!isAdmin) revenueQ = revenueQ.eq("partner_id", uid) as typeof revenueQ;

  const revenueResult = await Promise.allSettled([revenueQ]);
  const revenueRaw = revenueResult[0].status === "fulfilled" ? (revenueResult[0].value.data ?? []) : [];

  // Agrupa por mês e soma o requested_value
  const monthMap: Record<string, number> = {};
  const mesesPT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = 0;
  }

  for (const row of revenueRaw) {
    const d = new Date(row.created_at as string);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in monthMap) monthMap[key] += (row.requested_value as number) ?? 0;
  }

  const revenueData = Object.entries(monthMap).map(([key, value]) => {
    const [, m] = key.split("-");
    return { month: mesesPT[parseInt(m) - 1], value };
  });

  // Saúde da rede — só para ADMIN/GESTAO/FINANCEIRO
  let redeHealth = null;
  if (["ADMIN", "GESTAO", "FINANCEIRO"].includes(role)) {
    try {
      const [partnersRes, comissoesRes] = await Promise.allSettled([
        svc.from("profiles").select("id, role, trial_expires_at, created_at, is_active").in("role", ["PARTNER", "PARTNER_PRO"]),
        svc.from("commissions").select("commission_value, status").eq("status", "A_PAGAR"),
      ]);

      const partners = partnersRes.status === "fulfilled" ? (partnersRes.value.data ?? []) : [];
      const comissoes = comissoesRes.status === "fulfilled" ? (comissoesRes.value.data ?? []) : [];

      const now = Date.now();
      const ativos = partners.filter((p: { is_active: boolean; trial_expires_at: string | null; created_at: string }) => {
        if (!p.is_active) return false;
        const exp = p.trial_expires_at
          ? new Date(p.trial_expires_at).getTime()
          : new Date(p.created_at).getTime() + 30 * 86400000;
        return exp > now;
      });
      const vencendo7d = partners.filter((p: { is_active: boolean; trial_expires_at: string | null; created_at: string }) => {
        if (!p.is_active) return false;
        const exp = p.trial_expires_at
          ? new Date(p.trial_expires_at).getTime()
          : new Date(p.created_at).getTime() + 30 * 86400000;
        const dias = Math.floor((exp - now) / 86400000);
        return dias >= 0 && dias <= 7;
      }).length;

      redeHealth = {
        partnersAtivos: ativos.length,
        partnersPRO: ativos.filter((p: { role: string }) => p.role === "PARTNER_PRO").length,
        mrr: ativos.reduce((s: number, p: { role: string }) => s + (p.role === "PARTNER_PRO" ? 397 : 197), 0),
        comissoesPendentes: comissoes.reduce((s: number, c: { commission_value: number }) => s + c.commission_value, 0),
        vencendo7d,
      };
    } catch {
      redeHealth = null;
    }
  }

  // Follow-ups da semana — leads do CRM com next_contact nos próximos 7 dias
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const em7dias = new Date(hoje); em7dias.setDate(hoje.getDate() + 7);
  let followUpsQ = svc
    .from("crm_leads")
    .select("id, name, phone, next_contact, status, segment")
    .gte("next_contact", hoje.toISOString().split("T")[0])
    .lte("next_contact", em7dias.toISOString().split("T")[0])
    .order("next_contact", { ascending: true })
    .limit(5);
  if (!isAdmin) followUpsQ = followUpsQ.eq("created_by", uid) as typeof followUpsQ;
  const followUpsResult = await followUpsQ;
  const followUps = followUpsResult.data ?? [];

  return (
    <DashboardClient
      role={role}
      userName={profileData?.full_name || "Usuário"}
      period={period}
      revenueData={revenueData}
      redeHealth={redeHealth}
      kpis={{
        totalSplits: totalSplits,
        totalDeals: totalDeals,
        openTickets: totalTickets,
        pendingProposals: totalProposals,
      }}
      recentSplits={recentSplits as Parameters<typeof DashboardClient>[0]["recentSplits"]}
      recentDeals={recentDeals as Parameters<typeof DashboardClient>[0]["recentDeals"]}
      recentProposals={recentProposals as Parameters<typeof DashboardClient>[0]["recentProposals"]}
      followUps={followUps as Parameters<typeof DashboardClient>[0]["followUps"]}
      userCreatedAt={profileData?.created_at ?? null}
    />
  );
}
