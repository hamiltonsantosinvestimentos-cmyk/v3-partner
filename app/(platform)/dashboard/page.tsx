import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { cookies } from "next/headers";
import {
  DEMO_SPLITS, DEMO_DEALS, DEMO_CREDIT_PROPOSALS, DEMO_TICKETS
} from "@/lib/demo-data";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function DashboardPage() {
  if (IS_DEMO) {
    const cookieStore = await cookies();
    const session = JSON.parse(
      cookieStore.get("v3_demo_session")?.value || "{}"
    );

    return (
      <DashboardClient
        role={session.role || "PARTNER"}
        userName={session.full_name || "Usuário"}
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

  const [
    { count: totalSplits },
    { count: totalDeals },
    { count: totalTickets },
    { count: totalProposals },
  ] = await Promise.all([
    supabase.from("split_fiscal").select("*", { count: "exact", head: true }),
    supabase.from("ma_deals").select("*", { count: "exact", head: true }),
    supabase.from("operational_tickets").select("*", { count: "exact", head: true }).in("status", ["PENDING", "IN_REVIEW"]),
    supabase.from("credit_desk_proposals").select("*", { count: "exact", head: true }).in("status", ["PENDING", "IN_REVIEW"]),
  ]);

  const { data: recentSplits } = await supabase
    .from("split_fiscal").select("id, code, title, status, total_value, created_at")
    .order("created_at", { ascending: false }).limit(5);

  const { data: recentDeals } = await supabase
    .from("ma_deals").select("id, code, title, stage, deal_value, target_company, created_at")
    .order("created_at", { ascending: false }).limit(5);

  return (
    <DashboardClient
      role={role}
      userName={profileData?.full_name || "Usuário"}
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
