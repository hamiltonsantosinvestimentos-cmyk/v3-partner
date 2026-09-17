import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { AdminMarketplaceClient } from "@/components/marketplace/admin-marketplace-client";

export const metadata = { title: "Admin Marketplace — V3 Partners" };
export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): zero gating no server, nem
// checagem de login. As APIs de marketplace ja sao ADMIN/GESTAO-gated (sem
// vazamento de dado confirmado), mas a tela nunca deveria renderizar pra
// quem nao e do time interno.
const ALLOWED_ROLES = ["ADMIN", "GESTAO"];

export default async function AdminMarketplacePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role: string } | null)?.role ?? "";
  if (!ALLOWED_ROLES.includes(role)) redirect("/unauthorized");

  return <AdminMarketplaceClient />;
}
