import { UsuariosPageClient } from "@/components/usuarios/usuarios-page-client";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): era client component puro, zero
// gating no server. Gate migrado pra requireRole() em 18/09/2026. Conteúdo
// original em components/usuarios/usuarios-page-client.tsx.
export default async function UsuariosPage() {
  await requireRole(["ADMIN"]);
  return <UsuariosPageClient />;
}
