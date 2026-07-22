import { Settings2 } from "lucide-react";
import { PainelFontesCredito } from "@/components/credito/painel-fontes-credito";

export const dynamic = "force-dynamic";

export default async function PainelFontesPage() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").single();
  const role = profile?.role ?? "PARTNER";

  const allowed = ["ADMIN", "MESA_OPERACIONAL"].includes(role);

  if (!allowed) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Acesso restrito à Mesa de Crédito.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-[#C9A84C]" />
          Configuração de Fontes
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Escolha quais fontes o motor consulta para cada cliente, por CNPJ
        </p>
      </div>
      <PainelFontesCredito />
    </div>
  );
}
