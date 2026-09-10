import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ContractsCentralClient } from "@/components/cm/contracts-central-client";

export const metadata = { title: "Central de Contratos — V3 Partners" };

export default async function ContratosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();

  return <ContractsCentralClient role={(profile as { role: string } | null)?.role ?? ""} />;
}
