import { redirect } from "next/navigation";
import { createClient as sc } from "@supabase/supabase-js";
import { DocsHubClient } from "@/components/docs/docs-hub-client";

export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): checava login mas nunca role, e
// o fallback "PARTNER" pressupunha acesso de partner mesmo o sidebar
// restringindo este link a ADMIN/GESTAO/MESA_OPERACIONAL/FINANCEIRO.
const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"];

export default async function DocsPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  const role = profile?.role ?? "";
  if (!ALLOWED_ROLES.includes(role)) redirect("/unauthorized");

  return (
    <DocsHubClient
      userRole={role}
      userName={profile?.full_name ?? ""}
    />
  );
}
