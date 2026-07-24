import { redirect } from "next/navigation";
import { IndicacoesDashboardClient } from "@/components/indicacoes/indicacoes-dashboard-client";

export const dynamic = "force-dynamic";

export default async function IndicacoesPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const { createClient: sc } = await import("@supabase/supabase-js");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", user.id)
    .single();

  if (!profile || !["ADMIN", "STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE", "GESTAO"].includes(profile.role)) {
    redirect("/unauthorized");
  }

  const svcDiscount = sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: discountData } = await svcDiscount
    .from("profiles")
    .select("referral_discount_percent, referral_discount_months_remaining")
    .eq("id", user.id)
    .single() as { data: { referral_discount_percent: number; referral_discount_months_remaining: number } | null; error: unknown };

  const discountPercent = discountData?.referral_discount_percent ?? 0;
  const discountMonthsRemaining = discountData?.referral_discount_months_remaining ?? 0;

  const leadsLink = `https://app.v3partners.com.br/indicacao?ref=${user.id}`;
  const partnerLink = `https://app.v3partners.com.br/cadastro-partner?ref=${user.id}`;
  const analiseLink = `https://app.v3partners.com.br/analise?ref=${user.id}`;
  const analiseV2Link = `https://app.v3partners.com.br/analise-v2?ref=${user.id}`;

  let totalIndicados = 0;
  let ativos = 0;
  let pendentes = 0;
  let ganhosTotal = 0;
  let partnersIndicados = 0;

  try {
    const [leadsRes, commissionsRes, partnersRes] = await Promise.all([
      svcDiscount
        .from("prospeccao_leads")
        .select("id, etapa")
        .eq("indicado_por_partner_id", user.id),
      svcDiscount
        .from("commissions")
        .select("amount")
        .eq("partner_id", user.id)
        .eq("is_referral_commission", true),
      svcDiscount
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by_partner_id", user.id),
    ]);

    const leads = leadsRes.data ?? [];
    totalIndicados = leads.length;
    ativos = leads.filter(
      (l: { id: string; etapa: string }) => l.etapa === "convertido" || l.etapa === "trial"
    ).length;
    pendentes = leads.filter(
      (l: { id: string; etapa: string }) =>
        l.etapa === "prospect" || l.etapa === "contatado" || l.etapa === "interessado"
    ).length;

    ganhosTotal = (commissionsRes.data ?? []).reduce(
      (sum: number, c: { amount: number }) => sum + (c.amount ?? 0),
      0
    );

    partnersIndicados = partnersRes.count ?? 0;
  } catch {
    // silently show zeros on error
  }

  return (
    <IndicacoesDashboardClient
      userId={user.id}
      partnerName={profile.full_name ?? profile.email}
      role={profile.role}
      leadsLink={leadsLink}
      partnerLink={partnerLink}
      analiseLink={analiseLink}
      analiseV2Link={analiseV2Link}
      discountPercent={discountPercent}
      discountMonthsRemaining={discountMonthsRemaining}
      partnersIndicados={partnersIndicados}
      stats={{ totalIndicados, ativos, pendentes, ganhos: ganhosTotal }}
    />
  );
}
