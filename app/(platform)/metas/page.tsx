import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { MetasClient } from "@/components/metas/metas-client";

export const dynamic = "force-dynamic";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async function MetasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "GOLD", "DIAMANTE", "PARTNER_HE", "FINANCEIRO", "ENTERPRISE"];
  if (!allowedRoles.includes(profile?.role ?? "")) redirect("/unauthorized");

  const svc = serviceClient();
  const isAdmin = ["ADMIN", "GESTAO"].includes(profile?.role ?? "");
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const cmpNome = (a: { full_name: string | null }, b: { full_name: string | null }) =>
    (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR", { sensitivity: "base" });

  // Enterprise (BRIEF 2026-11-20 aba Enterprises): o master vê ele + a equipe ativa (ele primeiro,
  // equipe por nome); o usuário da equipe vê só ele. O master não define metas (só a V3).
  const ehEnterprise = profile?.role === "ENTERPRISE";
  let visaoEquipe = false;
  let partnerIds: { id: string; full_name: string | null }[];
  if (isAdmin) {
    // Para ADMIN/GESTAO: todos os partners, por nome.
    partnerIds = (((await svc.from("profiles").select("id, full_name").in("role", ["PARTNER", "PARTNER_PRO", "GOLD", "DIAMANTE", "PARTNER_HE"])).data ?? []) as { id: string; full_name: string | null }[]).sort(cmpNome);
  } else if (ehEnterprise) {
    const { contextoEnterprise, idsDoEnterprise } = await import("@/lib/enterprise");
    const ctx = await contextoEnterprise(svc, user.id).catch(() => null);
    if (ctx?.ehMaster) {
      visaoEquipe = true;
      const ids = await idsDoEnterprise(svc, user.id);
      const { data } = ids.length ? await svc.from("profiles").select("id, full_name, is_active").in("id", ids) : { data: [] };
      const ativos = ((data ?? []) as { id: string; full_name: string | null; is_active: boolean | null }[]).filter((p) => p.is_active !== false);
      const master = ativos.filter((p) => p.id === user.id);
      const equipe = ativos.filter((p) => p.id !== user.id).sort(cmpNome);
      partnerIds = [...(master.length ? master : [{ id: user.id, full_name: profile?.full_name ?? "Você" }]), ...equipe];
    } else {
      partnerIds = [{ id: user.id, full_name: profile?.full_name ?? "Você" }];
    }
  } else {
    // Parceiros: apenas si mesmo.
    partnerIds = [{ id: user.id, full_name: profile?.full_name ?? "Você" }];
  }

  const ids = partnerIds.map((p) => p.id);

  const [
    { data: goals },
    { data: proposals },
    { data: deals },
    { data: commissions },
  ] = await Promise.all([
    svc.from("partner_goals")
      .select("*")
      .in("partner_id", ids)
      .eq("year", year)
      .eq("month", month),
    svc.from("credit_desk_proposals")
      .select("partner_id, approved_value, requested_value, status, created_at")
      .in("partner_id", ids)
      .gte("created_at", new Date(year, month - 1, 1).toISOString()),
    svc.from("ma_deals")
      .select("assigned_to, deal_value, stage, created_at")
      .in("assigned_to", ids)
      .gte("created_at", new Date(year, month - 1, 1).toISOString()),
    svc.from("commissions")
      .select("partner_id, commission_value, status")
      .in("partner_id", ids)
      .eq("status", "PAGA"),
  ]);

  // Agrega performance por parceiro
  const performanceMap = new Map<string, {
    id: string; name: string;
    proposals: number; approvals: number; volume: number;
    deals: number; commissions: number;
  }>();

  for (const p of partnerIds) {
    performanceMap.set(p.id, {
      id: p.id,
      name: p.full_name ?? "Partner",
      proposals: 0, approvals: 0, volume: 0, deals: 0, commissions: 0,
    });
  }

  for (const p of proposals ?? []) {
    if (!p.partner_id) continue;
    const agg = performanceMap.get(p.partner_id);
    if (!agg) continue;
    agg.proposals++;
    const approved = (p.approved_value && p.approved_value > 0) || (p.status ?? "").toUpperCase().includes("APROV");
    if (approved) {
      agg.approvals++;
      agg.volume += p.approved_value ?? p.requested_value ?? 0;
    }
  }

  for (const d of deals ?? []) {
    if (!d.assigned_to) continue;
    const agg = performanceMap.get(d.assigned_to);
    if (!agg) continue;
    if (d.stage === "CLOSED_WON") agg.deals++;
  }

  for (const c of commissions ?? []) {
    if (!c.partner_id) continue;
    const agg = performanceMap.get(c.partner_id);
    if (!agg) continue;
    agg.commissions += c.commission_value ?? 0;
  }

  const performance = Array.from(performanceMap.values());
  const goalsMap = Object.fromEntries((goals ?? []).map((g) => [g.partner_id, g]));

  return (
    <MetasClient
      userRole={profile?.role ?? "PARTNER"}
      userId={user.id}
      userName={profile?.full_name ?? "Usuário"}
      year={year}
      month={month}
      performance={performance}
      goals={goalsMap}
      isAdmin={isAdmin}
      visaoEquipe={visaoEquipe}
      ehEnterprise={ehEnterprise}
    />
  );
}
