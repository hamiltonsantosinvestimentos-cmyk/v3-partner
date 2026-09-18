import { MesaConsorcioClient } from "@/components/mesa-consorcio/mesa-consorcio-client";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): esta pagina nunca lia o perfil
// real, so um cookie de demo legado (v3_demo_session), vazio em producao --
// todo usuario autenticado, partner incluso, recebia userRole="GESTAO"
// fixo. Gate migrado pra requireRole() em 18/09/2026.
export default async function MesaConsorcioOpPage() {
  const { role: userRole } = await requireRole(["ADMIN", "GESTAO", "MESA_OPERACIONAL"]);
  return <MesaConsorcioClient userRole={userRole} />;
}
