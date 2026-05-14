import { createClient as sc } from "@supabase/supabase-js";
import { DealDiscoveryClient } from "@/components/ma/deal-discovery-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export default async function OportunidadesPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: profile } = await svc
    .from("profiles").select("role, full_name").eq("id", user.id).single();

  if (!ALLOWED.includes(profile?.role ?? "")) redirect("/dashboard");

  const [investorsRes, oppsRes, reportsRes] = await Promise.all([
    svc.from("investor_profiles").select("id, nome, tipo, setores, ufs, ticket_min, ticket_max, status")
       .eq("status", "ativo").order("created_at", { ascending: false }),
    svc.from("deal_opportunities").select("*")
       .neq("status", "descartado").order("score_relevancia", { ascending: false }).limit(50),
    svc.from("generated_reports")
       .select("id, squad_id, title, created_at, opportunities_scanned_at, opportunities_found")
       .order("created_at", { ascending: false }).limit(20),
  ]);

  return (
    <DealDiscoveryClient
      userRole={profile?.role ?? "GESTAO"}
      userName={profile?.full_name ?? ""}
      investors={investorsRes.data ?? []}
      opportunities={oppsRes.data ?? []}
      reports={reportsRes.data ?? []}
    />
  );
}
