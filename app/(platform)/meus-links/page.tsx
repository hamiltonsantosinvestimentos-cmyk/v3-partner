import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PartnerLinksPanel } from "@/components/partner/partner-links-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meus Links de Serviço — V3 Partners",
};

export default async function MeusLinksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const ALLOWED = ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL"];
  if (!ALLOWED.includes(profile?.role ?? "")) redirect("/unauthorized");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#09081A",
        padding: "32px 24px",
        fontFamily: "'DM Sans', sans-serif",
      }}>
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />

      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#E8C97A",
              marginBottom: 8,
            }}>
            V3 Partners · Partner Dashboard
          </div>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: "#F5F1E8",
              margin: 0,
              marginBottom: 6,
            }}>
            Links de Serviço
          </h1>
          <p style={{ color: "#9BAFC5", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
            Crie links personalizados para vender serviços V3 aos seus clientes.
            Após o pagamento, o cliente recebe automaticamente o link de intake por email.
          </p>
        </div>

        <PartnerLinksPanel />
      </div>
    </div>
  );
}
