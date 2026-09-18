import { DocsHubClient } from "@/components/docs/docs-hub-client";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): checava login mas nunca role, e
// o fallback "PARTNER" pressupunha acesso de partner mesmo o sidebar
// restringindo este link. Gate migrado pra requireRole() em 18/09/2026.
export default async function DocsPage() {
  const { role, fullName } = await requireRole(["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"]);
  return <DocsHubClient userRole={role} userName={fullName} />;
}
