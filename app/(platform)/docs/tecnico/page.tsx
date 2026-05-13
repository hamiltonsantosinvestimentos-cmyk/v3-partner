import { createClient as sc } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { ManualTecnicoClient } from "@/components/docs/manual-tecnico-client";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "GESTAO"];

export default async function ManualTecnicoPage() {
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

  if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
    redirect("/unauthorized");
  }

  return (
    <ManualTecnicoClient
      userRole={profile.role}
      userName={profile.full_name ?? ""}
    />
  );
}
