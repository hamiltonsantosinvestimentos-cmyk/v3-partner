import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { PastaPublicaClient } from "@/components/pasta-publica/pasta-publica-client";

export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): zero gating no server, nem
// checagem de login. /api/governance/files ja tem checagem propria por
// pasta (sem vazamento de dado confirmado), mas a tela nunca deveria
// renderizar pra quem nao e do time interno (mesmo escopo do sidebar).
const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"];

export default async function PastaPublicaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role: string } | null)?.role ?? "";
  if (!ALLOWED_ROLES.includes(role)) redirect("/unauthorized");

  return <PastaPublicaClient />;
}
