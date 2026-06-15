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
    .select("created_at, requested_value, status")
    .gte("created_at", dozeAtras.toISOString())
    .order("created_at", { ascending: true });

  if (!isAdmin) revenueQ = revenueQ.eq("partner_id", uid) as typeof revenueQ;

  const revenueResult = await Promise.allSettled([revenueQ]);
  const revenueRaw = revenueResult[0].status === "fulfilled" ? (revenueResult[0].value.data ?? []) : [];

  // Agrupa por mês — total e em aprovação (PENDING + IN_REVIEW)
  const monthMap: Record<string, number> = {};
  const monthMapAprov: Record<string, number> = {};
  const mesesPT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthMap[key] = 0;
    monthMapAprov[key] = 0;
  }

  for (const row of revenueRaw) {
    const d = new Date(row.created_at as string);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in monthMap) {
      monthMap[key] += (row.requested_value as number) ?? 0;
      if (["PENDING", "IN_REVIEW"].includes(row.status as string)) {
        monthMapAprov[key] += (row.requested_value as number) ?? 0;
      }
    }
  }

  const revenueData = Object.entries(monthMap).map(([key, value]) => {
    const [, m] = key.split("-");
    return { month: mesesPT[parseInt(m) - 1], value, emAprovacao: monthMapAprov[key] ?? 0 };
  });

  // Saúde da rede — só para ADMIN/GESTAO/FINANCEIRO
  let redeHealth = null;
  if (["ADMIN", "GESTAO", "FINANCEIRO"].includes(role)) {
    try {
      const [partnersRes, comissoesRes] = await Promise.allSettled([
        svc.from("profiles").select("id, role, trial_expires_at, created_at, is_active").in("role", ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"]),
        svc.from("commissions").select("commission_value, status").eq("status", "A_PAGAR"),
      ]);

      const partners = partnersRes.status === "fulfilled" ? (partnersRes.value.data ?? []) : [];
      const comissoes = comissoesRes.status === "fulfilled" ? (comissoesRes.value.data ?? []) : [];

      // Preços contratados reais por partner (partner_subscriptions)
      const PLANO_PADRAO: Record<string, number> = { STARTER: 297, PARTNER: 497, PARTNER_PRO: 897, ENTERPRISE: 2500 };
      const subMapDash: Record<string, number> = {};
      try {
        const partnerIds = partners.map((p: { id: string }) => p.id);
        if (partnerIds.length > 0) {
          const { data: subsData } = await svc
            .from("partner_subscriptions")
            .select("partner_id, amount_cents, created_at")
            .in("partner_id", partnerIds)
            .order("created_at", { ascending: false });
          for (const s of (subsData ?? []) as { partner_id: string; amount_cents: number }[]) {
            if (!subMapDash[s.partner_id] && s.amount_cents > 0) {
              subMapDash[s.partner_id] = s.amount_cents / 100;
            }
          }
        }
      } catch { /* ignora */ }

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

      const porPlano = {
        STARTER:     ativos.filter((p: { role: string }) => p.role === "STARTER").length,
        PARTNER:     ativos.filter((p: { role: string }) => p.role === "PARTNER").length,
        PARTNER_PRO: ativos.filter((p: { role: string }) => p.role === "PARTNER_PRO").length,
        ENTERPRISE:  ativos.filter((p: { role: string }) => p.role === "ENTERPRISE").length,
      };

      // MRR usando valor real contratado de cada partner ativo
      const mrr = Math.round(
        ativos.reduce((sum: number, p: { id: string; role: string }) =>
          sum + (subMapDash[p.id] ?? PLANO_PADRAO[p.role] ?? 497), 0)
      );

      redeHealth = {
        partnersAtivos: ativos.length,
        partnersPRO: porPlano.PARTNER_PRO,
        porPlano,
        mrr,
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

  // Mês atual para comparativo
  const agora = new Date();
  const inicioMesAtual = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const inicioMesAnterior = new Date(agora.getFullYear(), agora.getMonth() - 1, 1).toISOString();
  const fimMesAnterior = new Date(agora.getFullYear(), agora.getMonth(), 0, 23, 59, 59).toISOString();

  // Contagens do mês anterior para comparativo MoM
  let splitsMesAntQ = svc.from("split_fiscal").select("*", { count: "exact", head: true }).gte("created_at", inicioMesAnterior).lte("created_at", fimMesAnterior);
  let dealsMesAntQ  = svc.from("ma_deals").select("*", { count: "exact", head: true }).gte("created_at", inicioMesAnterior).lte("created_at", fimMesAnterior);
  let propsMesAntQ  = svc.from("credit_desk_proposals").select("*", { count: "exact", head: true }).gte("created_at", inicioMesAnterior).lte("created_at", fimMesAnterior);

  let splitsMesAtualQ = svc.from("split_fiscal").select("*", { count: "exact", head: true }).gte("created_at", inicioMesAtual);
  let dealsMesAtualQ  = svc.from("ma_deals").select("*", { count: "exact", head: true }).gte("created_at", inicioMesAtual);
  let propsMesAtualQ  = svc.from("credit_desk_proposals").select("*", { count: "exact", head: true }).gte("created_at", inicioMesAtual);

  if (!isAdmin) {
    splitsMesAntQ = splitsMesAntQ.or(`created_by.eq.${uid},partner_id.eq.${uid}`) as typeof splitsMesAntQ;
    dealsMesAntQ  = dealsMesAntQ.or(`created_by.eq.${uid},assigned_to.eq.${uid}`) as typeof dealsMesAntQ;
    propsMesAntQ  = propsMesAntQ.eq("partner_id", uid) as typeof propsMesAntQ;
    splitsMesAtualQ = splitsMesAtualQ.or(`created_by.eq.${uid},partner_id.eq.${uid}`) as typeof splitsMesAtualQ;
    dealsMesAtualQ  = dealsMesAtualQ.or(`created_by.eq.${uid},assigned_to.eq.${uid}`) as typeof dealsMesAtualQ;
    propsMesAtualQ  = propsMesAtualQ.eq("partner_id", uid) as typeof propsMesAtualQ;
  }

  // Marketplace leads (apenas partner)
  let marketplaceLeads = 0;
  let comissoesAPagar = 0;
  let metaMes: Parameters<typeof DashboardClient>[0]["metaMes"] = null;
  let topPartners: Parameters<typeof DashboardClient>[0]["topPartners"] = [];

  const [
    followUpsResult,
    splitsMesAntResult, dealsMesAntResult, propsMesAntResult,
    splitsMesAtualResult, dealsMesAtualResult, propsMesAtualResult,
  ] = await Promise.allSettled([
    followUpsQ,
    splitsMesAntQ, dealsMesAntQ, propsMesAntQ,
    splitsMesAtualQ, dealsMesAtualQ, propsMesAtualQ,
  ]);

  const followUps = followUpsResult.status === "fulfilled" ? (followUpsResult.value.data ?? []) : [];
  const splitsMesAnt  = splitsMesAntResult.status === "fulfilled"  ? (splitsMesAntResult.value.count  ?? 0) : 0;
  const dealsMesAnt   = dealsMesAntResult.status === "fulfilled"   ? (dealsMesAntResult.value.count   ?? 0) : 0;
  const propsMesAnt   = propsMesAntResult.status === "fulfilled"   ? (propsMesAntResult.value.count   ?? 0) : 0;
  const splitsMesAtual = splitsMesAtualResult.status === "fulfilled" ? (splitsMesAtualResult.value.count ?? 0) : 0;
  const dealsMesAtual  = dealsMesAtualResult.status === "fulfilled"  ? (dealsMesAtualResult.value.count ?? 0) : 0;
  const propsMesAtual  = propsMesAtualResult.status === "fulfilled"  ? (propsMesAtualResult.value.count ?? 0) : 0;

  function momChange(atual: number, anterior: number) {
    if (anterior === 0) return undefined;
    return Math.round(((atual - anterior) / anterior) * 100);
  }

  const kpiChanges = {
    splits: momChange(splitsMesAtual, splitsMesAnt),
    deals:  momChange(dealsMesAtual,  dealsMesAnt),
    proposals: momChange(propsMesAtual, propsMesAnt),
  };

  // Dados extras paralelos
  const extraQueries = await Promise.allSettled([
    // Marketplace leads do partner
    !isAdmin
      ? svc.from("marketplace_leads").select("*", { count: "exact", head: true }).eq("partner_id", uid)
      : Promise.resolve({ count: 0 }),
    // Comissões a pagar do partner (ou total admin)
    isAdmin
      ? svc.from("commissions").select("commission_value, status").eq("status", "A_PAGAR")
      : svc.from("commissions").select("commission_value, status").eq("partner_id", uid).eq("status", "A_PAGAR"),
    // Metas do mês atual
    svc.from("partner_goals")
      .select("*")
      .eq("partner_id", uid)
      .eq("year", agora.getFullYear())
      .eq("month", agora.getMonth() + 1)
      .maybeSingle(),
    // Propostas do mês atual do partner (para actual vs goal)
    svc.from("credit_desk_proposals")
      .select("id, status, requested_value")
      .eq("partner_id", uid)
      .gte("created_at", inicioMesAtual),
    // Deals do mês atual do partner
    svc.from("ma_deals")
      .select("id")
      .or(`created_by.eq.${uid},assigned_to.eq.${uid}`)
      .gte("created_at", inicioMesAtual),
    // Top partners por volume de propostas (admin)
    isAdmin
      ? svc.from("credit_desk_proposals")
          .select("partner_id, partner:profiles!credit_desk_proposals_partner_id_fkey(full_name)")
          .gte("created_at", inicioMesAtual)
          .not("partner_id", "is", null)
          .limit(100)
      : Promise.resolve({ data: [] }),
  ]);

  // Marketplace leads
  if (extraQueries[0].status === "fulfilled") {
    marketplaceLeads = (extraQueries[0].value as { count: number | null }).count ?? 0;
  }

  // Comissões a pagar
  if (extraQueries[1].status === "fulfilled") {
    const coms = (extraQueries[1].value as { data: Array<{ commission_value: number }> | null }).data ?? [];
    comissoesAPagar = coms.reduce((s, c) => s + (c.commission_value ?? 0), 0);
  }

  // Metas
  const goalData = extraQueries[2].status === "fulfilled"
    ? (extraQueries[2].value as { data: Record<string, unknown> | null }).data
    : null;
  const propsDoMes = extraQueries[3].status === "fulfilled"
    ? ((extraQueries[3].value as { data: Array<{ status: string; requested_value: number }> | null }).data ?? [])
    : [];
  const dealsDoMes = extraQueries[4].status === "fulfilled"
    ? ((extraQueries[4].value as { data: Array<{ id: string }> | null }).data ?? [])
    : [];

  if (goalData) {
    const g = goalData as Record<string, number>;
    metaMes = {
      goal_proposals: g.goal_proposals ?? 0,
      goal_approvals: g.goal_approvals ?? 0,
      goal_volume: g.goal_volume ?? 0,
      goal_deals: g.goal_deals ?? 0,
      atual_proposals: propsDoMes.length,
      atual_approvals: propsDoMes.filter(p => p.status === "APPROVED").length,
      atual_volume: propsDoMes.reduce((s, p) => s + (p.requested_value ?? 0), 0),
      atual_deals: dealsDoMes.length,
    };
  }

  // Top partners
  if (isAdmin && extraQueries[5].status === "fulfilled") {
    const rows = ((extraQueries[5].value as { data: Array<{ partner_id: string; partner: { full_name: string } | null }> | null }).data ?? []);
    const contagem: Record<string, { full_name: string; count: number }> = {};
    for (const r of rows) {
      if (!r.partner_id) continue;
      const nome = r.partner?.full_name ?? "—";
      if (!contagem[r.partner_id]) contagem[r.partner_id] = { full_name: nome, count: 0 };
      contagem[r.partner_id].count++;
    }
    topPartners = Object.entries(contagem)
      .map(([id, v]) => ({ id, full_name: v.full_name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  // Benchmark de Performance — para partners, calcula médias da plataforma
  let benchmarkData: Parameters<typeof DashboardClient>[0]["benchmarkData"] = null;
  if (!isAdmin && ["PARTNER", "PARTNER_PRO"].includes(role)) {
    try {
      const [allDealsRes, allLeadsRes, allComissRes] = await Promise.allSettled([
        // Todos os deals de todos os partners no mês atual
        svc.from("ma_deals").select("created_by").gte("created_at", inicioMesAtual),
        // Todos os marketplace leads no mês atual
        svc.from("marketplace_leads").select("partner_id").gte("created_at", inicioMesAtual),
        // Todas as comissões no mês atual
        svc.from("commissions").select("partner_id, commission_value").gte("created_at", inicioMesAtual),
      ]);

      const allDeals   = allDealsRes.status === "fulfilled"   ? (allDealsRes.value.data ?? [])   : [];
      const allLeads   = allLeadsRes.status === "fulfilled"   ? (allLeadsRes.value.data ?? [])   : [];
      const allComiss  = allComissRes.status === "fulfilled"  ? (allComissRes.value.data ?? [])  : [];

      // Count per partner for deals
      const dealsByPartner: Record<string, number> = {};
      for (const d of allDeals) {
        const pid = (d as { created_by: string | null }).created_by;
        if (pid) dealsByPartner[pid] = (dealsByPartner[pid] ?? 0) + 1;
      }
      // Count per partner for leads
      const leadsByPartner: Record<string, number> = {};
      for (const l of allLeads) {
        const pid = (l as { partner_id: string | null }).partner_id;
        if (pid) leadsByPartner[pid] = (leadsByPartner[pid] ?? 0) + 1;
      }
      // Sum per partner for commissions
      const commByPartner: Record<string, number> = {};
      for (const c of allComiss) {
        const pid = (c as { partner_id: string | null; commission_value: number }).partner_id;
        const val = (c as { commission_value: number }).commission_value ?? 0;
        if (pid) commByPartner[pid] = (commByPartner[pid] ?? 0) + val;
      }

      const dealsVals  = Object.values(dealsByPartner);
      const leadsVals  = Object.values(leadsByPartner);
      const commVals   = Object.values(commByPartner);

      const avg = (arr: number[]) => arr.length === 0 ? 0 : Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);

      benchmarkData = {
        partnerDeals:       dealsByPartner[uid] ?? 0,
        avgDeals:           avg(dealsVals),
        partnerVolume:      metaMes?.atual_volume ?? 0,
        avgVolume:          avg(commVals), // use total commission volume as proxy
        partnerLeads:       marketplaceLeads,
        avgLeads:           avg(leadsVals),
        partnerCommission:  commByPartner[uid] ?? 0,
        avgCommission:      avg(commVals),
      };
    } catch {
      benchmarkData = null;
    }
  }

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
      kpiChanges={kpiChanges}
      marketplaceLeads={marketplaceLeads}
      comissoesAPagar={comissoesAPagar}
      metaMes={metaMes}
      topPartners={topPartners}
      benchmarkData={benchmarkData}
      recentSplits={recentSplits as Parameters<typeof DashboardClient>[0]["recentSplits"]}
      recentDeals={recentDeals as Parameters<typeof DashboardClient>[0]["recentDeals"]}
      recentProposals={recentProposals as Parameters<typeof DashboardClient>[0]["recentProposals"]}
      followUps={followUps as Parameters<typeof DashboardClient>[0]["followUps"]}
      userCreatedAt={profileData?.created_at ?? null}
    />
  );
}
