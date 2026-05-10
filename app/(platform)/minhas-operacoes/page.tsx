import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { MinhasOperacoesClient } from "@/components/minhas-operacoes/minhas-operacoes-client";

export const dynamic = "force-dynamic";

export default async function MinhasOperacoesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!["PARTNER", "PARTNER_PRO"].includes(profile?.role ?? "")) redirect("/unauthorized");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [
    { data: propostas },
    { data: deals },
    { data: leads },
  ] = await Promise.all([
    svc
      .from("credit_desk_proposals")
      .select("id, code, title, client_name, credit_line, requested_value, approved_value, status, stage, current_level, created_at, updated_at, metadata")
      .eq("partner_id", user.id)
      .order("created_at", { ascending: false }),
    svc
      .from("ma_deals")
      .select("id, code, title, stage, deal_value, sector, created_at, updated_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false }),
    svc
      .from("consorcio_leads")
      .select("id, code, client, type, value, stage, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <MinhasOperacoesClient
      propostas={propostas ?? []}
      deals={deals ?? []}
      leads={leads ?? []}
      partnerName={profile?.full_name ?? ""}
    />
  );
}
