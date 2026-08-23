import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { SdrAddonLocked } from "@/components/sdr/sdr-addon-locked";
import { PartnerSdrClient } from "@/components/sdr/partner-sdr-client";

export const dynamic = "force-dynamic";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"];

export default async function MeuAtendimentoIaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!PARTNER_ROLES.includes(profile?.role ?? "")) redirect("/unauthorized");

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: conexao } = await db
    .from("partner_sdr_connections")
    .select("addon_ativo, addon_solicitado_em, addon_status")
    .eq("partner_id", user.id)
    .maybeSingle();

  if (!conexao?.addon_ativo) {
    return (
      <SdrAddonLocked
        jaSolicitado={!!conexao?.addon_solicitado_em}
        status={conexao?.addon_status === "pausado" || conexao?.addon_status === "cancelado" ? conexao.addon_status : "nao_contratado"}
      />
    );
  }

  return <PartnerSdrClient />;
}
