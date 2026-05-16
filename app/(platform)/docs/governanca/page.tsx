import { createClient as sc } from "@supabase/supabase-js";
import { GovernancaClient } from "@/components/docs/governanca-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Governança · V3 Partners" };

const ALLOWED = ["ADMIN", "GESTAO", "MESA"];

export default async function GovernancaPage() {
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

  if (!profile || !ALLOWED.includes(profile.role)) redirect("/docs");

  return (
    <GovernancaClient
      userRole={profile.role}
      userName={profile.full_name ?? ""}
    />
  );
}
