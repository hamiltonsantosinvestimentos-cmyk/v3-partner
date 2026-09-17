import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ContractsSignedClient } from "@/components/cm/contracts-signed-client";

export const metadata = { title: "Contratos Assinados — V3 Partners" };
export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): zero gating, nem checagem de
// login. /api/contracts/signed e /api/contracts/list ja reconferem role no
// servidor (sem vazamento de dado confirmado), mas a tela nunca deveria
// renderizar pra quem nao e ADMIN/GESTAO (mesmo escopo do link do sidebar).
const ALLOWED_ROLES = ["ADMIN", "GESTAO"];

export default async function ContratosAssinadosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role: string } | null)?.role ?? "";
  if (!ALLOWED_ROLES.includes(role)) redirect("/unauthorized");

  return <ContractsSignedClient />;
}
