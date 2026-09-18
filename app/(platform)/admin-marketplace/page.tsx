import { AdminMarketplaceClient } from "@/components/marketplace/admin-marketplace-client";
import { requireRole } from "@/lib/auth/require-role";

export const metadata = { title: "Admin Marketplace — V3 Partners" };
export const dynamic = "force-dynamic";

// Achado 17/09/2026 (auditoria de acesso): zero gating no server. Gate
// migrado pra requireRole() em 18/09/2026.
export default async function AdminMarketplacePage() {
  await requireRole(["ADMIN", "GESTAO"]);
  return <AdminMarketplaceClient />;
}
