import { ManualUsuarioClient } from "@/components/docs/manual-usuario-client";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): mesmo padrao de docs/page.tsx.
// Gate migrado pra requireRole() em 18/09/2026.
export default async function ManualUsuarioPage() {
  const { role, fullName } = await requireRole(["ADMIN", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO"]);
  return <ManualUsuarioClient userRole={role} userName={fullName} />;
}
