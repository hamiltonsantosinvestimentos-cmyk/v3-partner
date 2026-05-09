import { createClient as sc } from "@supabase/supabase-js";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const TEAM_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"];

export default async function PromptsPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const userRole = profile?.role ?? "PARTNER";

  if (!TEAM_ROLES.includes(userRole)) redirect("/dashboard");

  // Abre o conteúdo diretamente — sem iframe
  redirect("/api/prompts/content");
}
