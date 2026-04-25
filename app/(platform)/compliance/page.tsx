import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ComplianceClient } from "@/components/compliance/compliance-client";

export const dynamic = "force-dynamic";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async function CompliancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
  if (!allowedRoles.includes(profile?.role ?? "")) redirect("/unauthorized");

  const svc = serviceClient();

  // KYC stats
  const [
    { data: profiles },
    { data: proposals },
    { data: deals },
    { data: tickets },
  ] = await Promise.all([
    svc.from("profiles")
      .select("id, full_name, role, kyc_status, created_at")
      .in("role", ["PARTNER", "PARTNER_PRO"])
      .order("created_at", { ascending: false }),
    svc.from("credit_desk_proposals")
      .select("id, requested_value, approved_value, status, credit_level, created_at, partner_id")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(50),
    svc.from("ma_deals")
      .select("id, company_name, deal_value, stage, created_at")
      .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(20),
    svc.from("operational_tickets")
      .select("id, title, status, priority, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Análise de compliance
  const kycPendentes = (profiles ?? []).filter((p) => !p.kyc_status || p.kyc_status === "PENDENTE").length;
  const kycAprovados = (profiles ?? []).filter((p) => p.kyc_status === "APROVADO").length;
  const kycReprovados = (profiles ?? []).filter((p) => p.kyc_status === "REPROVADO").length;

  // Operações acima do limiar COAF (R$ 50.000 para correspondentes)
  const operacoesCoaf = (proposals ?? []).filter(
    (p) => (p.requested_value ?? 0) >= 50000
  );

  // Deals de alto valor (M&A acima de R$ 5M — devem ser monitorados)
  const dealsAltoValor = (deals ?? []).filter((d) => (d.deal_value ?? 0) >= 5_000_000);

  // Tickets urgentes
  const ticketsUrgentes = (tickets ?? []).filter((t) => t.priority === "URGENT" && t.status !== "RESOLVED");

  const stats = {
    totalPartners: (profiles ?? []).length,
    kycPendentes,
    kycAprovados,
    kycReprovados,
    operacoesCoaf: operacoesCoaf.length,
    dealsAltoValor: dealsAltoValor.length,
    ticketsUrgentes: ticketsUrgentes.length,
  };

  return (
    <ComplianceClient
      userRole={profile?.role ?? "GESTAO"}
      userName={profile?.full_name ?? "Usuário"}
      stats={stats}
      recentProposals={(proposals ?? []).map((p) => ({
        id: p.id,
        value: p.requested_value ?? 0,
        status: p.status ?? "",
        level: p.credit_level ?? "",
        created_at: p.created_at,
        acima_coaf: (p.requested_value ?? 0) >= 50000,
      }))}
      dealsAltoValor={(dealsAltoValor ?? []).map((d) => ({
        id: d.id,
        company: d.company_name ?? "Deal",
        value: d.deal_value ?? 0,
        stage: d.stage ?? "",
        created_at: d.created_at,
      }))}
      partnerKyc={(profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name ?? "Partner",
        kyc_status: p.kyc_status ?? "PENDENTE",
        created_at: p.created_at,
      }))}
    />
  );
}
