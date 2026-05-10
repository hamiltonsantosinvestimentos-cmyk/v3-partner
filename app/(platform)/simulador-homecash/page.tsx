import { HomeCashSimulator } from "@/components/simulador/homecash-client";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SimuladorHomeCashPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <HomeCashSimulator />;
}
