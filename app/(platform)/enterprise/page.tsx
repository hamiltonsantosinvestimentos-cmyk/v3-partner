import { Building2 } from "lucide-react";
import { createClient as sc } from "@supabase/supabase-js";
import { contextoEnterprise, MAX_USUARIOS } from "@/lib/enterprise";
import { EnterpriseClient } from "@/components/enterprise/enterprise-client";

export const dynamic = "force-dynamic";

// Painel do Enterprise (white label): master gerencia até 10 usuários, o % de repasse de cada
// um, a marca e os repasses que ele deve pagar; usuário vê os próprios repasses.
export default async function EnterprisePage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const ctx = user ? await contextoEnterprise(db, user.id) : null;

  if (!ctx) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Disponível apenas para Enterprise.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[#C9A84C]" />
          {ctx.marca?.nome ?? "Enterprise"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {ctx.ehMaster
            ? `Sua equipe (até ${MAX_USUARIOS} usuários), o % de comissão de cada um, os repasses que você paga e a marca da plataforma.`
            : "Seus repasses: o que o Enterprise paga a você pelas suas vendas."}
        </p>
      </div>
      <EnterpriseClient ehMaster={ctx.ehMaster} marcaInicial={ctx.marca} limite={MAX_USUARIOS} />
    </div>
  );
}
