import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { IntegracoesClient } from "@/components/configuracoes/integracoes-client";

export const metadata = { title: "Integrações — V3 Partners" };

export default async function IntegracoesPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: profile } = await svc
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role as string;
  if (!["ADMIN", "GESTAO"].includes(role)) redirect("/dashboard");

  // Carregar parceiros (server-side, pode ver has_api_key)
  const { data: rawPartners } = await svc
    .from("integration_partners")
    .select("id, name, display_name, crm_type, active, sla_days, config_json, api_key_enc, created_at, updated_at")
    .order("created_at", { ascending: true });

  const partners = (rawPartners ?? []).map(({ api_key_enc, ...p }) => ({
    ...p,
    has_api_key: api_key_enc != null && (api_key_enc as string).length > 0,
  }));

  return <IntegracoesClient partners={partners} userRole={role} />;
}
