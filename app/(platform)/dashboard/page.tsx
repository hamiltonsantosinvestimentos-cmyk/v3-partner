import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { cookies } from "next/headers";
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profileData } = await supabase
    .from("profiles").select("role, full_name, created_at").eq("id", user.id).single() as {
      data: { role: string; full_name: string | null; created_at: string | null } | null
    };

  const role = profileData?.role || "PARTNER";
  const since = periodToDate(period);
  const adminRoles = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
  const isAdmin = adminRoles.includes(role);
  const uid = user.id;

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

  const [
    { count: totalSplits },
    { count: totalDeals },
    { count: totalTickets },
    { count: totalProposals },
  ] = await Promise.all([splitCountQ, dealCountQ, ticketCountQ, propCountQ]);

  // Recentes — mesmo filtro
  let splitsQ = svc.from("split_fiscal").select("id, code, title, status, total_value, created_at").order("created_at", { ascending: false }).limit(5);
  let dealsQ  = svc.from("ma_deals").select("id, code, title, stage, deal_value, target_company, created_at").order("created_at", { ascending: false }).limit(5);

  if (!isAdmin) {
    splitsQ = splitsQ.or(`created_by.eq.${uid},partner_id.eq.${uid}`) as typeof splitsQ;
    dealsQ  = dealsQ.or(`created_by.eq.${uid},assigned_to.eq.${uid}`) as typeof dealsQ;
  }
  if (since) {
    splitsQ = splitsQ.gte("created_at", since) as typeof splitsQ;
    dealsQ  = dealsQ.gte("created_at", since) as typeof dealsQ;
  }

  const { data: recentSplits } = await splitsQ;
  const { data: recentDeals }  = await dealsQ;

  return (
    <DashboardClient
      role={role}
      userName={profileData?.full_name || "Usuário"}
      period={period}
      kpis={{
        totalSplits: totalSplits ?? 0,
        totalDeals: totalDeals ?? 0,
        openTickets: totalTickets ?? 0,
        pendingProposals: totalProposals ?? 0,
      }}
      recentSplits={(recentSplits ?? []) as Parameters<typeof DashboardClient>[0]["recentSplits"]}
      recentDeals={(recentDeals ?? []) as Parameters<typeof DashboardClient>[0]["recentDeals"]}
      userCreatedAt={profileData?.created_at ?? null}
    />
  );
}
