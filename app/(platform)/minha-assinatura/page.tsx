import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { MinhaAssinaturaClient } from "@/components/minha-assinatura/minha-assinatura-client";
import { AssinaturaEquipeEnterprise } from "@/components/minha-assinatura/assinatura-equipe-enterprise";
import { MinhaAssinaturaEnterprise } from "@/components/minha-assinatura/minha-assinatura-enterprise";

export const dynamic = "force-dynamic";

export default async function MinhaAssinaturaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, email, created_at, trial_expires_at, is_active")
    .eq("id", user.id)
    .single();

  if (!["PARTNER", "PARTNER_PRO", "GOLD", "DIAMANTE", "PARTNER_HE", "ENTERPRISE"].includes(profile?.role ?? "")) redirect("/unauthorized");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Enterprise (BRIEF 2026-11-23 assinatura da equipe): master × equipe decidido por contextoEnterprise.
  let enterpriseMaster = false;
  if (profile?.role === "ENTERPRISE") {
    const { contextoEnterprise, nomeDaMarca } = await import("@/lib/enterprise");
    const ctx = await contextoEnterprise(svc, user.id);
    if (ctx && !ctx.ehMaster) {
      // Usuário da equipe: só a cobrança que o master definiu para ele, cortada aqui no servidor.
      const {
        dataBr, hojeSaoPaulo, lerAssinatura, ROTULO_PERIODICIDADE, situacaoAssinatura, rotuloSituacao,
      } = await import("@/lib/enterprise-assinatura");
      const { data: eu, error } = await svc.from("profiles").select("enterprise_assinatura").eq("id", user.id).maybeSingle();
      const registro = lerAssinatura((eu as { enterprise_assinatura?: unknown } | null)?.enterprise_assinatura);
      const situacao = situacaoAssinatura(registro, hojeSaoPaulo());
      const cobra = !!registro?.cobra;
      return (
        <MinhaAssinaturaEnterprise dados={{
          marca: nomeDaMarca(ctx),
          indisponivel: !!error,
          cobra,
          valor: cobra ? registro!.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null,
          periodicidade: cobra ? ROTULO_PERIODICIDADE[registro!.periodicidade] : null,
          proximoVencimento: situacao.tipo === "SEM_COBRANCA" ? null : dataBr(situacao.vencimento),
          situacao: situacao.tipo === "EM_DIA" ? "Em dia" : situacao.tipo === "VENCIDA" ? rotuloSituacao(situacao) : "Sem cobrança",
          vencida: situacao.tipo === "VENCIDA",
        }} />
      );
    }
    enterpriseMaster = !!ctx?.ehMaster;
  }

  const { data: contract } = await svc
    .from("partner_contracts")
    .select("plano, valor_mensal, accepted_at, contract_version, email, nome_representante")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: commissions } = await svc
    .from("commissions")
    .select("commission_value, status, created_at, deal_id, deal_type, description")
    .eq("partner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <MinhaAssinaturaClient
      profile={{
        id: profile!.id,
        full_name: profile!.full_name,
        role: profile!.role,
        email: profile!.email ?? user.email ?? "",
        created_at: profile!.created_at,
        trial_expires_at: profile!.trial_expires_at ?? null,
        is_active: profile!.is_active,
      }}
      contract={contract ?? null}
      commissions={commissions ?? []}
      enterpriseMaster={enterpriseMaster}
      quadroEquipe={enterpriseMaster ? <AssinaturaEquipeEnterprise /> : null}
    />
  );
}
