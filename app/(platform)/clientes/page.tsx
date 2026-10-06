import { ClientesSearchClient } from "@/components/clientes/clientes-search-client";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): zero gating no server. Gate
// migrado pra requireRole() em 18/09/2026.
// 05/10/2026: aceita ?cliente=<uuid> (link da ficha da parte), sem CPF/CNPJ na URL.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  await requireRole(["ADMIN", "GESTAO", "MESA_OPERACIONAL"]);
  const { cliente } = await searchParams;
  return <ClientesSearchClient initialClienteId={cliente && UUID_RE.test(cliente) ? cliente : null} />;
}
