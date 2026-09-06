import { createClient as sc } from "@supabase/supabase-js";
import { SociosClient, type SociosReport } from "@/components/socios/socios-client";

export const dynamic = "force-dynamic";

// Portal dos Sócios, Fase 1 (05/09/2026, BRIEF "Painel de Governança da
// Diretoria /socios"). Rota já planejada em v3-governance-flow.md desde
// antes desta sessão ("Área Restrita, ADMIN apenas"), nunca construída até
// agora. Fase 1 cobre só o Relatório Gerencial sob demanda; as outras
// peças do plano original (sessões capturadas, manual técnico) ficam para
// fases futuras.
const ADMIN_ROLE = "ADMIN";

export default async function SociosPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userName = "";
  let reports: SociosReport[] = [];
  let isAdmin = false;

  if (user) {
    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: profile } = await svc.from("profiles").select("full_name, role").eq("id", user.id).single();
    userName = profile?.full_name ?? "";
    isAdmin = profile?.role === ADMIN_ROLE;

    if (isAdmin) {
      const { data } = await svc
        .from("generated_reports")
        .select("id, title, created_at")
        .eq("squad_id", "mesa-relatorio-gerencial")
        .order("created_at", { ascending: false })
        .limit(30);
      reports = (data ?? []) as SociosReport[];
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#9BAFC5] text-sm">Acesso restrito à diretoria (ADMIN).</p>
      </div>
    );
  }

  return <SociosClient userName={userName} reports={reports} />;
}
