import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ClientesSearchClient } from "@/components/clientes/clientes-search-client";

export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): zero gating no server, nem
// checagem de login. /api/clientes/[documento] ja e ADMIN/GESTAO/
// MESA_OPERACIONAL-gated (sem vazamento de dado confirmado), mas a tela
// (Client 360, cruza CPF/CNPJ entre todas as verticais) nunca deveria
// renderizar pra quem nao e do time interno.
const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role: string } | null)?.role ?? "";
  if (!ALLOWED_ROLES.includes(role)) redirect("/unauthorized");

  return <ClientesSearchClient />;
}
