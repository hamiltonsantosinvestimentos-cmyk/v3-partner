import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ContratoClient } from "@/components/contrato-parceria/contrato-client";

export const dynamic = "force-dynamic";

export default async function ContratoParceriaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Se já assinou, vai para o dashboard
  if (user.app_metadata?.contract_signed) redirect("/dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email")
    .eq("id", user.id)
    .single();

  // Roles internos não assinam contrato — vai direto pro dashboard
  const ROLES_INTERNOS = ["ADMIN", "SDR", "CLOSER", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO", "FORNECEDOR"];
  if (profile?.role && ROLES_INTERNOS.includes(profile.role)) redirect("/dashboard");

  const role = profile?.role as string | undefined;
  const plano: "STARTER" | "PARTNER" | "PARTNER_PRO" | "ENTERPRISE" =
    role === "PARTNER_PRO" ? "PARTNER_PRO"
    : role === "STARTER" ? "STARTER"
    : role === "ENTERPRISE" ? "ENTERPRISE"
    : "PARTNER";

  // Busca dados do cadastro para pré-preencher o contrato
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: reg } = await svc
    .from("partner_registrations")
    .select("*")
    .eq("email", profile?.email ?? user.email ?? "")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Monta dados para pré-preenchimento
  const dadosContrato = {
    userId:            user.id,
    registrationId:    reg?.id ?? null,
    plano,
    email:             profile?.email ?? user.email ?? "",
    telefone:          reg?.telefone ?? "",
    razaoSocial:       reg?.razao_social ?? reg?.nome_completo ?? profile?.full_name ?? "",
    cnpjCpf:           reg?.cnpj ?? reg?.cpf ?? "",
    enderecoCompleto:  reg ? `${reg.logradouro ?? ""}, ${reg.numero ?? ""} ${reg.complemento ?? ""} — ${reg.bairro ?? ""}, ${reg.cidade ?? ""}/${reg.estado ?? ""}, CEP ${reg.cep ?? ""}`.trim() : "",
    cidade:            reg?.cidade ?? "Rio de Janeiro",
    nomeRepresentante: reg?.nome_completo ?? reg?.nome_socio ?? profile?.full_name ?? "",
    cpfRepresentante:  reg?.cpf ?? reg?.cpf_socio ?? "",
  };

  return <ContratoClient dados={dadosContrato} />;
}
