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

  if (!profile || !["ADMIN", "PARTNER", "PARTNER_PRO", "GESTAO"].includes(profile.role)) {
    redirect("/unauthorized");
  }

  const referralLink = `https://app.v3partners.com.br/indicacao?ref=${user.id}`;

  // Try to count leads from the referral — best-effort, no crash if table differs
  let totalIndicados = 0;
  let ativos = 0;
  let pendentes = 0;

  try {
    const svc = sc(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: leads } = await svc
      .from("prospeccao_leads")
      .select("id, status")
      .eq("origem", "indicacao")
      .ilike("indicado_por_nome", `%${profile.full_name ?? ""}%`);

    if (leads) {
      totalIndicados = leads.length;
      ativos = leads.filter(
        (l: { id: string; status: string }) => l.status === "ATIVO" || l.status === "CONVERTIDO"
      ).length;
      pendentes = leads.filter(
        (l: { id: string; status: string }) => l.status === "NOVO" || l.status === "EM_CONTATO"
      ).length;
    }
  } catch {
    // table may not have indicado_por_nome — show zeros
  }

  return (
    <IndicacoesDashboardClient
      userId={user.id}
      partnerName={profile.full_name ?? profile.email}
      role={profile.role}
      referralLink={referralLink}
      stats={{ totalIndicados, ativos, pendentes, ganhos: ativos * 0 }}
    />
  );
}
