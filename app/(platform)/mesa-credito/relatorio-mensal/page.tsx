import { BarChart3 } from "lucide-react";
import { createClient as sc } from "@supabase/supabase-js";
import { montarRelatorioMensal, periodoDoMes, PARTNER_ROLES } from "@/lib/relatorio-mensal-partners";
import { RelatorioMensalClient } from "@/components/mesa-credito/relatorio-mensal-client";

export const dynamic = "force-dynamic";

const EQUIPE = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

interface Props { searchParams: Promise<{ mes?: string }> }

// Relatório mensal por partner (lib/relatorio-mensal-partners.ts): o mesmo que vai por e-mail
// todo dia 1. Partner vê só o dele; Mesa/Gestão/Admin veem a rede inteira.
export default async function RelatorioMensalPage({ searchParams }: Props) {
  const { mes } = await searchParams;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("id, role").eq("id", user?.id ?? "").single();
  const role = profile?.role ?? "";
  const equipe = EQUIPE.includes(role);
  const partner = (PARTNER_ROLES as readonly string[]).includes(role);

  if (!user || (!equipe && !partner)) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Acesso restrito à Mesa de Crédito.</p>
      </div>
    );
  }

  const periodo = periodoDoMes(mes);
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const rel = await montarRelatorioMensal(db, periodo, equipe ? undefined : user.id);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-[#C9A84C]" />
          Relatório Mensal de Partners
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {equipe
            ? "Propostas, funil e comissões de cada partner no mês. Enviado por e-mail a cada partner e aos sócios todo dia 1."
            : "Suas propostas, funil e comissões no mês. Você também recebe este relatório por e-mail todo dia 1."}
        </p>
      </div>
      <RelatorioMensalClient rel={rel} equipe={equipe} podeReenviar={["ADMIN", "GESTAO"].includes(role)} />
    </div>
  );
}
