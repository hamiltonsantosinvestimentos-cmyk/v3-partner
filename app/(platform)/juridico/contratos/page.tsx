import { ContractsCentralClient } from "@/components/cm/contracts-central-client";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = { title: "Central de Contratos — V3 Partners" };

// Achado 17/09/2026 (auditoria de acesso): checava login mas nunca role.
// Gate migrado pra requireRole() em 18/09/2026.
export default async function ContratosPage() {
  const { role } = await requireRole(["ADMIN", "GESTAO", "MESA_OPERACIONAL"]);
  return <ContractsCentralClient role={role} />;
}
