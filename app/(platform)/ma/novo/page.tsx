import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { NovoDealForm } from "@/components/ma/novo-deal-form";

const IS_DEMO = false;

export default async function NovoDealPage() {
  let userId = "demo-user";

  if (!IS_DEMO) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? "unknown";
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* Header */}
      <div>
        <Link
          href="/ma"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          M&A Pipeline
        </Link>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center flex-shrink-0">
            <Plus className="w-5 h-5 text-[#09081A]" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-0.5">
              Cadastro de Ativo
            </p>
            <h1 className="text-xl font-bold text-white">Novo Deal M&A</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Preencha todas as etapas. O ativo será enviado para validação da equipe M&A.
            </p>
          </div>
        </div>
      </div>

      {/* Aviso de confidencialidade */}
      <div className="flex items-start gap-3 p-3 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-lg">
        <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] mt-1.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-[#F0ECE4] font-semibold">Todas as informações são estritamente confidenciais.</span>{" "}
          O acesso ao CIM e materiais de divulgação é restrito à equipe M&A e investidores com NDA assinado.
          Dados incorretos ou incompletos atrasarão a validação pelo FORJA.
        </p>
      </div>

      {/* Formulário */}
      <NovoDealForm isDemo={IS_DEMO} userId={userId} />

    </div>
  );
}
