import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ContractsCentralClient } from "@/components/cm/contracts-central-client";

export const metadata = { title: "Central de Contratos — V3 Partners" };

// Achado 17/09/2026 (auditoria de acesso): checava login mas nunca role --
// mesmo padrao de fix aplicado nas demais paginas internas desta sessao.
const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export default async function ContratosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role: string } | null)?.role ?? "";
  if (!ALLOWED_ROLES.includes(role)) redirect("/unauthorized");

  return <ContractsCentralClient role={role} />;
}
