import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SdrClient } from "@/components/sdr/sdr-client";

export const dynamic = "force-dynamic";

export default async function SdrPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!["ADMIN", "GESTAO"].includes(profile?.role ?? "")) {
    redirect("/unauthorized");
  }

  return (
    <SdrClient
      currentUserId={user.id}
      currentUserName={profile?.full_name ?? "Usuário"}
    />
  );
}
