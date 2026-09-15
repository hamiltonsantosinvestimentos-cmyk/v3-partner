import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminLinksDashboard } from "@/components/admin/admin-links-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard de Links · V3 Partners",
};

// Dashboard de Links para a Diretoria (14/09/2026, pedido de João): a API
// de /meus-links já devolvia todos os links de todos os partners pra
// ADMIN/GESTAO desde 09/09/2026 (isAdmin bypass no filtro), só não existia
// tela pra ver isso -- reaproveita a mesma rota, sem endpoint novo.
export default async function AdminLinksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes(profile?.role ?? "")) redirect("/unauthorized");

  return (
    <div style={{ minHeight: "100vh", background: "#09081A", padding: "32px 24px", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#E8C97A", marginBottom: 8 }}>
            V3 Partners · Diretoria
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#F5F1E8", margin: 0, marginBottom: 6 }}>Dashboard de Links</h1>
          <p style={{ color: "#9BAFC5", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
            Todo Link de Serviço criado por qualquer partner, com prazo de expiração e status em tempo real.
          </p>
        </div>
        <AdminLinksDashboard />
      </div>
    </div>
  );
}
