import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlanStrategyClient } from "@/components/plan-strategy/plan-strategy-client";

export const dynamic = "force-dynamic";

export default async function PlanStrategyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes(profile?.role ?? "")) redirect("/unauthorized");

  return <PlanStrategyClient />;
}
