import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SellSideListingsPanel } from "@/components/cm/sell-side-listings-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Meus Ativos · V3 Partners",
};

// Tela pedida por Joao (13/08/2026): o Partner que originou um ATIVO (Sell-Side) nao tinha
// nenhum jeito de acompanhar status, inserir documento ou indicar comissionado -- mesmo
// gap ja corrigido pro lado comprador em /meus-compradores. cm_asset_listings ja tinha
// originator_profile_id desde 07/07 (espelha ma_deals.originator_profile_id), so faltava
// a rota (GET /api/cm/listings) e a tela liberarem leitura pro dono.
export default async function MeusAtivosPage() {
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
          <h1 className="text-2xl font-bold text-[#F5F1E8] mb-1.5">Meus Ativos</h1>
          <p className="text-[#9BAFC5] text-sm max-w-2xl">
            {isInternal
              ? "Todos os ativos cadastrados na Bolsa de Capitais, independente de quem originou."
              : "Ativos que você trouxe para a Mesa. Acompanhe o status, envie documentos e indique finder, intermediário ou mandatário."}
          </p>
        </div>

        <SellSideListingsPanel
          mode={isInternal ? "mesa" : "mine"}
          title={isInternal ? "Todos os Ativos" : "Seus Ativos"}
          subtitle={isInternal ? undefined : "Cada linha é um ativo que você originou"}
        />
      </div>
    </div>
  );
}
