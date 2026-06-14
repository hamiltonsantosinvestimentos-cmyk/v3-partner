import { createClient as sc } from "@supabase/supabase-js";
import { LogisticaClient } from "@/components/logistica/logistica-client";

export const dynamic = "force-dynamic";

export default async function LogisticaLocacoesPage() {
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await svc
    .from("logistics_items")
    .select("*")
    .eq("category", "locacao")
    .order("start_date", { ascending: true, nullsFirst: false });

  return <LogisticaClient category="locacao" initialItems={data ?? []} />;
}
