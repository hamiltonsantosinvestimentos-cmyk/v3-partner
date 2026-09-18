import { ClientesSearchClient } from "@/components/clientes/clientes-search-client";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): zero gating no server. Gate
// migrado pra requireRole() em 18/09/2026.
export default async function ClientesPage() {
  await requireRole(["ADMIN", "GESTAO", "MESA_OPERACIONAL"]);
  return <ClientesSearchClient />;
}
