import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { IntegracaoApiClient } from "@/components/integracao-api/integracao-api-client";
import { planoTemApi } from "@/lib/api-keys";

export const dynamic = "force-dynamic";

export default async function IntegracaoApiPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile?.role as string | undefined) ?? null;
  const ehPartner = ["STARTER", "PARTNER", "PARTNER_PRO", "GOLD", "DIAMANTE", "PARTNER_HE", "ENTERPRISE"].includes(role ?? "");
  if (!ehPartner) redirect("/unauthorized");
  return <IntegracaoApiClient planoOk={planoTemApi(role)} />;
}
