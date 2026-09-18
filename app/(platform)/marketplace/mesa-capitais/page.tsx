import { MesaCapitaisClient } from "@/components/cm/mesa-capitais-client";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = { title: "Mesa de Capitais — V3 Partners" };
export const dynamic = "force-dynamic";

// Achado real 17/09/2026 (mesmo bug de app/(platform)/bolsa/mesa/page.tsx,
// rota duplicada): sem gate de role no servidor, so escondida pelo sidebar.
// Gate migrado pra requireRole() em 18/09/2026.
export default async function MesaCapitaisPage() {
  const { role: userRole } = await requireRole(["ADMIN", "GESTAO", "MESA_OPERACIONAL"]);
  return <MesaCapitaisClient userRole={userRole} />;
}
