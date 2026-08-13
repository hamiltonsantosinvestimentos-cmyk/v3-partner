import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BuySideDemandsPanel } from "@/components/cm/buy-side-demands-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meus Compradores · V3 Partners",
};

// Tela pedida por Joao (13/08/2026): o Partner que origina um link de intake buy-side
// nao tinha NENHUM jeito de acompanhar o status depois de enviar. A API
// (/api/cm/investor-demands) ja forca o filtro por origin_partner_id no servidor para
// role de Partner -- aqui so precisa liberar a rota e reaproveitar o mesmo painel que a
// Mesa ja usa em "Demandas de Compra", so trocando o modo.
export default async function MeusCompradoresPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "PARTNER", "PARTNER_PRO", "STARTER", "ENTERPRISE"];
  if (!ALLOWED.includes(profile?.role ?? "")) redirect("/unauthorized");

  const isInternal = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile?.role ?? "");

  return (
    <div className="min-h-screen p-6" style={{ background: "#09081A", fontFamily: "'DM Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="text-[9px] font-bold tracking-widest uppercase text-[#E8C97A] mb-2">
            V3 Partners &middot; Bolsa de Ativos
          </div>
          <h1 className="text-2xl font-bold text-[#F5F1E8] mb-1.5">Meus Compradores</h1>
          <p className="text-[#9BAFC5] text-sm max-w-2xl">
            {isInternal
              ? "Todos os compradores cadastrados via link de intake, independente de quem originou."
              : "Compradores que você indicou através do seu link de intake. Acompanhe o status e copie o link para reenviar quando precisar."}
          </p>
        </div>

        <BuySideDemandsPanel
          mode={isInternal ? "mesa" : "mine"}
          title={isInternal ? "Todos os Compradores" : "Seus Compradores"}
          subtitle={isInternal ? undefined : "Cada linha é um comprador que preencheu um link atribuído a você"}
        />
      </div>
    </div>
  );
}
