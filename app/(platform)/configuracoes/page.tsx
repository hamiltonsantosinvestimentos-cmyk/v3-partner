import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ConfiguracoesClient } from "@/components/configuracoes/configuracoes-client";

export const metadata = { title: "Configurações — V3 Partners" };

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: profile } = await svc
    .from("profiles")
    .select("id, full_name, email, role, phone, document_cpf, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const role = profile.role as string;

  // Links de captação para partners e admins
  let captacaoLinks: Array<{
    id: string; token: string; partner_name: string;
    active: boolean; uses_count: number; created_at: string;
  }> = [];

  if (["PARTNER", "PARTNER_PRO", "ADMIN", "GESTAO"].includes(role)) {
    const { data: links } = await svc
      .from("captacao_links")
      .select("id, token, partner_name, active, uses_count, created_at")
      .eq("partner_id", user.id)
      .order("created_at", { ascending: false });
    captacaoLinks = links ?? [];
  }

  // Stats do sistema para admins
  let systemStats: { totalUsers: number; activePartners: number; totalLeads: number } | null = null;
  if (["ADMIN", "GESTAO"].includes(role)) {
    const [usersRes, partnersRes, leadsRes] = await Promise.allSettled([
      svc.from("profiles").select("*", { count: "exact", head: true }),
      svc.from("profiles").select("*", { count: "exact", head: true }).in("role", ["PARTNER", "PARTNER_PRO"]),
      svc.from("captacao_leads").select("*", { count: "exact", head: true }),
    ]);
    systemStats = {
      totalUsers:     usersRes.status === "fulfilled" ? (usersRes.value.count ?? 0) : 0,
      activePartners: partnersRes.status === "fulfilled" ? (partnersRes.value.count ?? 0) : 0,
      totalLeads:     leadsRes.status === "fulfilled" ? (leadsRes.value.count ?? 0) : 0,
    };
  }

  return (
    <ConfiguracoesClient
      profile={{
        id: profile.id as string,
        full_name: (profile.full_name as string) ?? "",
        email: (profile.email as string) ?? user.email ?? "",
        role: role,
        phone: (profile.phone as string) ?? "",
        document_cpf: (profile.document_cpf as string) ?? "",
      }}
      initialLinks={captacaoLinks}
      systemStats={systemStats}
    />
  );
}
