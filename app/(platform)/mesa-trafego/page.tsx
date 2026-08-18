import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MesaTrafegoClient } from "@/components/mesa-trafego/mesa-trafego-client";

export const dynamic = "force-dynamic";

export default async function MesaTrafegoPage() {
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

  return <MesaTrafegoClient currentUserName={profile?.full_name ?? "Usuário"} />;
}
