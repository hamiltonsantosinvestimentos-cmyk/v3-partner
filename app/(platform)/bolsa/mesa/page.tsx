import { MesaCapitaisClient } from "@/components/cm/mesa-capitais-client";
import { hasComplianceDashboardAccess } from "@/lib/cm/compliance-access";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = { title: "Mesa de Capitais - V3 Partners" };
export const dynamic = "force-dynamic";

// Achado real 17/09/2026 (teste ao vivo com Monica Xavier, PARTNER_PRO): esta
// pagina nunca teve gate de role no servidor, so resolvia userRole e passava
// como prop -- o sidebar escondia o link, mas a URL sempre esteve aberta pra
// qualquer role autenticada, expondo volume de pipeline real e dados de
// TODOS os ativos da Mesa. Gate migrado pra requireRole() em 18/09/2026.
export default async function MesaCapitaisPage() {
  const { user, role: userRole } = await requireRole(["ADMIN", "GESTAO", "MESA_OPERACIONAL"]);

  // Cockpit de Due Diligence e Compliance: gate por user_id nominal (5 pessoas),
  // nao por role. Ver lib/cm/compliance-access.ts.
  const hasComplianceAccess = await hasComplianceDashboardAccess(user.id);

  return <MesaCapitaisClient userRole={userRole} hasComplianceAccess={hasComplianceAccess} />;
}
