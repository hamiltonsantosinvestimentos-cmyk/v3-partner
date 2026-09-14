import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContratoClient } from "@/components/contrato-parceria/contrato-client";

export const dynamic = "force-dynamic";

// Tela de primeiro acesso do partner. Até 15/09/2026 essa rota exigia
// assinatura do contrato de parceria dentro da própria plataforma; agora só
// avisa que o jurídico envia o contrato em seguida, fora daqui (decisão do
// Hamilton — o contrato de verdade passa a ser tratado pelo jurídico, não
// mais pela plataforma). PARTNER_HE já funcionava assim; agora vale pra
// todos os planos, sem exceção.
export default async function ContratoParceriaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Já viu o aviso — vai direto pro dashboard.
  if (user.app_metadata?.contract_signed) redirect("/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  // Roles internos nunca passam por aqui — vão direto pro dashboard.
  const ROLES_INTERNOS = ["ADMIN", "SDR", "CLOSER", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO", "FORNECEDOR"];
  if (profile?.role && ROLES_INTERNOS.includes(profile.role)) redirect("/dashboard");

  return <ContratoClient nome={profile?.full_name ?? ""} />;
}
