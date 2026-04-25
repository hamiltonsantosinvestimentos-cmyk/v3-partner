import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { AdminDashboardClient } from "@/components/admin-dashboard/admin-dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "ADMIN") redirect("/dashboard");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [
    partnersResult,
    volumeResult,
    comissoesResult,
    cadastrosResult,
    comissoesRecentesResult,
  ] = await Promise.allSettled([
    svc.from("profiles")
      .select("id, full_name, email, role, created_at, is_active")
      .in("role", ["PARTNER", "PARTNER_PRO"])
      .eq("is_active", true)
      .order("created_at", { ascending: false }),

    svc.from("credit_desk_proposals")
      .select("requested_value")
      .gte("created_at", inicioMes.toISOString()),

    svc.from("commissions")
      .select("commission_value")
      .eq("status", "A_PAGAR"),

    svc.from("partner_registrations")
      .select("id, full_name, email, status, created_at")
      .eq("status", "PENDENTE")
      .order("created_at", { ascending: false })
      .limit(10),

    svc.from("commissions")
      .select("commission_value, status, partner_id, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const partners = partnersResult.status === "fulfilled" ? (partnersResult.value.data ?? []) : [];
  const volumeRows = volumeResult.status === "fulfilled" ? (volumeResult.value.data ?? []) : [];
  const comissoesAPagarRows = comissoesResult.status === "fulfilled" ? (comissoesResult.value.data ?? []) : [];
  const cadastros = cadastrosResult.status === "fulfilled" ? (cadastrosResult.value.data ?? []) : [];
  const comissoesRecentes = comissoesRecentesResult.status === "fulfilled" ? (comissoesRecentesResult.value.data ?? []) : [];

  const totalPartners = partners.length;
  const totalPro = partners.filter(p => p.role === "PARTNER_PRO").length;
  const totalPartnerBase = partners.filter(p => p.role === "PARTNER").length;
  const volumeMes = volumeRows.reduce((s: number, r: { requested_value: number }) => s + (r.requested_value ?? 0), 0);
  const comissoesAPagar = comissoesAPagarRows.reduce((s: number, r: { commission_value: number }) => s + (r.commission_value ?? 0), 0);

  return (
    <AdminDashboardClient
      totalPartners={totalPartners}
      totalPro={totalPro}
      totalPartnerBase={totalPartnerBase}
      volumeMes={volumeMes}
      comissoesAPagar={comissoesAPagar}
      cadastrosPendentes={cadastros.length}
      recentPartners={partners.slice(0, 8) as Parameters<typeof AdminDashboardClient>[0]["recentPartners"]}
      recentCommissions={comissoesRecentes as Parameters<typeof AdminDashboardClient>[0]["recentCommissions"]}
      recentCadastros={cadastros as Parameters<typeof AdminDashboardClient>[0]["recentCadastros"]}
    />
  );
}
