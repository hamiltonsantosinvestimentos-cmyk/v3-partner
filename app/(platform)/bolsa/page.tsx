import { VitrineClient } from "@/components/cm/vitrine-client";
import { createClient as sc } from "@supabase/supabase-js";

export const metadata = { title: "Bolsa de Ativos — V3 Partners" };
export const dynamic = "force-dynamic";

export default async function BolsaPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user?.id ?? "").single();
  const userRole = (profile as { role?: string } | null)?.role ?? "PARTNER";

  return <VitrineClient userRole={userRole} />;
}
