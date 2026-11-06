import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChavesApiAdminClient } from "@/components/integracao-api/chaves-api-admin-client";

export const dynamic = "force-dynamic";

export default async function ChavesApiAdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") redirect("/unauthorized");
  return <ChavesApiAdminClient />;
}
