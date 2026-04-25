import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { MinhaAssinaturaClient } from "@/components/minha-assinatura/minha-assinatura-client";

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

  if (!["PARTNER", "PARTNER_PRO"].includes(profile?.role ?? "")) redirect("/unauthorized");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: contract } = await svc
    .from("partner_contracts")
    .select("plano, valor_mensal, accepted_at, contract_version, email, nome_representante")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: commissions } = await svc
    .from("commissions")
    .select("commission_value, status, created_at")
    .eq("partner_id", user.id)
    .order("created_at", { ascending: false });

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
    />
  );
}
