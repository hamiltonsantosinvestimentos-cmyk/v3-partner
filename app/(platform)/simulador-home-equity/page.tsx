import { HomeEquitySimulator } from "@/components/simulador/home-equity-client";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SimuladorHomeEquityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <HomeEquitySimulator />;
}
