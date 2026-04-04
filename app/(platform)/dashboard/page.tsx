import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { cookies } from "next/headers";
import {
  DEMO_SPLITS, DEMO_DEALS, DEMO_CREDIT_PROPOSALS, DEMO_TICKETS
} from "@/lib/demo-data";

export const dynamic = "force-dynamic";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

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
    .from("profiles").select("role, full_name").eq("id", user.id).single() as {
      data: { role: string; full_name: string | null } | null
    };

  const role = profileData?.role || "PARTNER";
  const since = periodToDate(period);

  const addPeriod = <T extends ReturnType<typeof supabase.from>>(q: T) =>
    since ? (q as unknown as { gte: (col: string, val: string) => T }).gte("created_at", since) : q;

  const [
    { count: totalSplits },
    { count: totalDeals },
    { count: totalTickets },
    { count: totalProposals },
  ] = await Promise.all([
    addPeriod(supabase.from("split_fiscal").select("*", { count: "exact", head: true })),
    addPeriod(supabase.from("ma_deals").select("*", { count: "exact", head: true })),
    supabase.from("operational_tickets").select("*", { count: "exact", head: true }).in("status", ["PENDING", "IN_REVIEW"]),
    supabase.from("credit_desk_proposals").select("*", { count: "exact", head: true }).in("status", ["PENDING", "IN_REVIEW"]),
  ]);

  const recentQuery = supabase
    .from("split_fiscal").select("id, code, title, status, total_value, created_at")
    .order("created_at", { ascending: false }).limit(5);
  const { data: recentSplits } = since
    ? await recentQuery.gte("created_at", since)
    : await recentQuery;

  const dealQuery = supabase
    .from("ma_deals").select("id, code, title, stage, deal_value, target_company, created_at")
    .order("created_at", { ascending: false }).limit(5);
  const { data: recentDeals } = since
    ? await dealQuery.gte("created_at", since)
    : await dealQuery;

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
    />
  );
}
