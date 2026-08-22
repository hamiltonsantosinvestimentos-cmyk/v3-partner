import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminSdrAddonClient } from "@/components/sdr/admin-sdr-addon-client";

export const dynamic = "force-dynamic";

export default async function AdminSdrAddonPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes(profile?.role ?? "")) redirect("/unauthorized");

  return <AdminSdrAddonClient />;
}
