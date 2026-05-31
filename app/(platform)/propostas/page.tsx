import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { PropostasClient } from "@/components/propostas/propostas-client";

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export default async function PropostasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("id, full_name, role").eq("id", user.id).single();

  if (!ALLOWED.includes(profile?.role ?? "")) redirect("/unauthorized");

  return (
    <PropostasClient
      userRole={profile?.role ?? ""}
      userId={user.id}
      userName={profile?.full_name ?? ""}
      complianceOk={true}
    />
  );
}
