import { redirect } from "next/navigation";
import { MesaCapitaisClient } from "@/components/cm/mesa-capitais-client";
import { createClient as sc } from "@supabase/supabase-js";
import { hasComplianceDashboardAccess } from "@/lib/cm/compliance-access";

export const metadata = { title: "Mesa de Capitais - V3 Partners" };
export const dynamic = "force-dynamic";

// Achado real 17/09/2026 (teste ao vivo com Monica Xavier, PARTNER_PRO): esta
// pagina nunca teve gate de role no servidor, so resolvia userRole e passava
// como prop -- o sidebar escondia o link, mas a URL sempre esteve aberta pra
// qualquer role autenticada, expondo volume de pipeline real e dados de
// TODOS os ativos da Mesa. Mesmo padrao de redirect ja usado em
// app/(platform)/meus-ativos/page.tsx.
const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export default async function MesaCapitaisPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const userRole = (profile as { role?: string } | null)?.role ?? "";
  if (!ALLOWED_ROLES.includes(userRole)) redirect("/unauthorized");

  // Cockpit de Due Diligence e Compliance: gate por user_id nominal (5 pessoas),
  // nao por role. Ver lib/cm/compliance-access.ts.
  const hasComplianceAccess = await hasComplianceDashboardAccess(user.id);

  return <MesaCapitaisClient userRole={userRole} hasComplianceAccess={hasComplianceAccess} />;
}
