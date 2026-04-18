import { RankingClient } from "@/components/ranking/ranking-client";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DEMO_DEALS, DEMO_CREDIT_PROPOSALS } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

const IS_DEMO = false;

type Period = "semana" | "mes" | "trim" | "ano";

function periodToDate(period: Period): string {
  const d = new Date();
  if (period === "semana") d.setDate(d.getDate() - 7);
  else if (period === "mes")   d.setDate(1);
  else if (period === "trim")  d.setMonth(d.getMonth() - 3);
  else                         d.setMonth(0, 1);
  return d.toISOString();
}

function getAvatar(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
}

// Score: propostas(1pt) + aprovadas(5pt) + volume(1pt/100K) + deals MA(10pt) + comissoes pagas(2pt)
function calcScore(proposals: number, approvals: number, volume: number, deals: number, commissionsPaid: number) {
  return Math.round(
    proposals * 1 +
    approvals * 5 +
    (volume / 100_000) * 1 +
    deals * 10 +
    commissionsPaid * 2
  );
}

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const period = (["semana", "mes", "trim", "ano"].includes(params.period ?? "")
    ? params.period : "mes") as Period;
  const since = periodToDate(period);

  // ─── DEMO MODE ────────────────────────────────────────────────────────────────
  if (IS_DEMO) {
    const cookieStore = await cookies();
    const session = JSON.parse(cookieStore.get("v3_demo_session")?.value || "{}");
    if (!session?.id) redirect("/login");

    const demoPartners = [
      { id: "demo-1", name: "Hamilton Santos", role: "PARTNER" },
      { id: "demo-2", name: "Ana Oliveira",    role: "PARTNER" },
      { id: "demo-3", name: "Carlos Mendes",   role: "PARTNER" },
    ];

    const rankingData = buildRankingData(
      demoPartners,
      DEMO_CREDIT_PROPOSALS.map(p => ({ partner_id: "demo-1", approved_value: p.approved_value, requested_value: p.requested_value, status: p.status, created_at: p.created_at })),
      DEMO_DEALS.map(d => ({ assigned_to: "demo-1", deal_value: d.deal_value, stage: d.stage, created_at: d.created_at })),
      [],
    );

    return (
      <RankingClient
        userRole={session.role ?? "PARTNER"}
        userName={session.full_name ?? "Usuário"}
        rankingData={rankingData}
        period={period}
      />
    );
  }

  // ─── PRODUCTION ───────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "FINANCEIRO", "MESA_OPERACIONAL"].includes(profile?.role ?? "")) redirect("/unauthorized");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Busca todos os partners
  const { data: partners } = await svc
    .from("profiles").select("id, full_name, role")
    .in("role", ["PARTNER", "PARTNER_PRO"]);

  // Busca dados de todos os módulos filtrados pelo período
  const [
    { data: proposals },
    { data: deals },
    { data: commissions },
  ] = await Promise.all([
    svc.from("credit_desk_proposals")
      .select("partner_id, requested_value, approved_value, status, created_at")
      .gte("created_at", since),
    svc.from("ma_deals")
      .select("assigned_to, deal_value, stage, created_at")
      .gte("created_at", since),
    svc.from("commissions")
      .select("partner_id, commission_value, status, created_at")
      .gte("created_at", since),
  ]);

  const rankingData = buildRankingData(
    partners ?? [],
    (proposals ?? []).map(p => ({ partner_id: p.partner_id, approved_value: p.approved_value, requested_value: p.requested_value, status: p.status, created_at: p.created_at })),
    (deals ?? []).map(d => ({ assigned_to: d.assigned_to, deal_value: d.deal_value, stage: d.stage, created_at: d.created_at })),
    (commissions ?? []).map(c => ({ partner_id: c.partner_id, commission_value: c.commission_value, status: c.status })),
  );

  // Busca metas do mês atual
  const now = new Date();
  const { data: goals } = await svc
    .from("partner_goals")
    .select("partner_id, goal_proposals, goal_approvals, goal_volume, goal_deals")
    .eq("year", now.getFullYear())
    .eq("month", now.getMonth() + 1);

  return (
    <RankingClient
      userRole={profile?.role ?? "PARTNER"}
      userName={profile?.full_name ?? "Usuário"}
      rankingData={rankingData}
      period={period}
      goals={goals ?? []}
    />
  );
}

// ─── Aggregation helper ───────────────────────────────────────────────────────
function buildRankingData(
  partners: Array<{ id: string; name?: string | null; full_name?: string | null; role?: string }>,
  proposals: Array<{ partner_id: string | null; approved_value: number | null; requested_value: number | null; status: string | null; created_at?: string }>,
  deals: Array<{ assigned_to: string | null; deal_value: number | null; stage: string | null; created_at?: string }>,
  commissions: Array<{ partner_id: string | null; commission_value: number | null; status: string | null }>,
) {
  type Agg = {
    id: string; name: string; avatar: string;
    proposals: number; approvals: number; volume: number;
    deals: number; commissionsPaid: number; score: number;
  };

  const map = new Map<string, Agg>();

  for (const p of partners) {
    const name = p.full_name ?? p.name ?? "Partner";
    map.set(p.id, {
      id: p.id, name, avatar: getAvatar(name),
      proposals: 0, approvals: 0, volume: 0,
      deals: 0, commissionsPaid: 0, score: 0,
    });
  }

  for (const p of proposals) {
    if (!p.partner_id) continue;
    const agg = map.get(p.partner_id);
    if (!agg) continue;
    agg.proposals++;
    const isApproved = (p.approved_value && p.approved_value > 0) || p.status?.toUpperCase().includes("APROV");
    if (isApproved) {
      agg.approvals++;
      agg.volume += p.approved_value ?? p.requested_value ?? 0;
    }
  }

  for (const d of deals) {
    if (!d.assigned_to) continue;
    const agg = map.get(d.assigned_to);
    if (!agg) continue;
    if (["CLOSING", "CLOSED_WON"].includes(d.stage ?? "")) {
      agg.deals++;
    }
  }

  for (const c of commissions) {
    if (!c.partner_id) continue;
    const agg = map.get(c.partner_id);
    if (!agg) continue;
    if (c.status === "PAGA") agg.commissionsPaid++;
  }

  // Calcula score
  for (const agg of map.values()) {
    agg.score = calcScore(agg.proposals, agg.approvals, agg.volume, agg.deals, agg.commissionsPaid);
  }

  const aggs = Array.from(map.values()).filter(a =>
    a.proposals > 0 || a.approvals > 0 || a.deals > 0 || a.commissionsPaid > 0 || a.score > 0
  );

  return {
    score: [...aggs].sort((a, b) => b.score - a.score).map(a => ({
      id: a.id, name: a.name, avatar: a.avatar, role: "Partner",
      score: a.score, proposals: a.proposals, approvals: a.approvals,
      deals: a.deals, volume: a.volume,
    })),
    propostas: [...aggs].sort((a, b) => b.proposals - a.proposals).map(a => ({
      id: a.id, name: a.name, avatar: a.avatar, role: "Partner",
      proposals: a.proposals, growth: 0, region: "",
    })),
    aprovacoes: [...aggs].sort((a, b) => b.approvals - a.approvals).map(a => ({
      id: a.id, name: a.name, avatar: a.avatar, role: "Partner",
      approved: a.approvals,
      rate: a.proposals > 0 ? Math.round((a.approvals / a.proposals) * 100) : 0,
      volume: a.volume,
    })),
    volume: [...aggs].sort((a, b) => b.volume - a.volume).map(a => ({
      id: a.id, name: a.name, avatar: a.avatar, role: "Partner",
      volume: a.volume,
      deals: a.approvals,
      avg: a.approvals > 0 ? Math.round(a.volume / a.approvals) : 0,
    })),
  };
}
