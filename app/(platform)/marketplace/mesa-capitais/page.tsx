import { redirect } from "next/navigation";
import { MesaCapitaisClient } from "@/components/cm/mesa-capitais-client";
import { createClient as sc } from "@supabase/supabase-js";

export const metadata = { title: "Mesa de Capitais — V3 Partners" };
export const dynamic = "force-dynamic";

// Achado real 17/09/2026 (mesmo bug de app/(platform)/bolsa/mesa/page.tsx,
// rota duplicada): sem gate de role no servidor, so escondida pelo sidebar.
const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export default async function MesaCapitaisPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const userRole = (profile as { role?: string } | null)?.role ?? "";
  if (!ALLOWED_ROLES.includes(userRole)) redirect("/unauthorized");

  return <MesaCapitaisClient userRole={userRole} />;
}
