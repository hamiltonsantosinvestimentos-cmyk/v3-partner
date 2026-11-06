import { ChavesApiAdminClient } from "@/components/integracao-api/chaves-api-admin-client";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

// Chaves de API dos partners (BRIEF 2026-11-06): só ADMIN. As rotas /api/admin/api-* conferem de novo.
export default async function ChavesApiAdminPage() {
  await requireRole(["ADMIN"]);
  return <ChavesApiAdminClient />;
}
