import { ContractsSignedClient } from "@/components/cm/contracts-signed-client";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = { title: "Contratos Assinados — V3 Partners" };
export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): zero gating, nem checagem de
// login. Gate migrado pra requireRole() em 18/09/2026.
export default async function ContratosAssinadosPage() {
  await requireRole(["ADMIN", "GESTAO"]);
  return <ContractsSignedClient />;
}
