import { ArrowLeft, UserSearch } from "lucide-react";
import Link from "next/link";
import { FormularioInvestidor } from "@/components/comunidade/formulario-investidor";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function InvestidorPage() {
  let userId = "demo-user";

  if (!IS_DEMO) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? "unknown";
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">

      {/* Header */}
      <div>
        <Link
          href="/comunidade"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Comunidade
        </Link>

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center flex-shrink-0">
            <UserSearch className="w-5 h-5 text-[#09081A]" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-0.5">
              Cadastro de Investidor
            </p>
            <h1 className="text-xl font-bold text-white">Perfil de Investidor</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Preencha as 4 etapas para que a equipe V3 possa apresentar oportunidades alinhadas ao seu mandato.
            </p>
          </div>
        </div>
      </div>

      {/* Aviso de confidencialidade */}
      <div className="flex items-start gap-3 p-3 bg-[#C9A84C]/5 border border-[#C9A84C]/20 rounded-lg">
        <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] mt-1.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="text-[#F0ECE4] font-semibold">Todas as informações são estritamente confidenciais.</span>{" "}
          O perfil de investidor é acessado exclusivamente pela equipe de originação da V3 Partners.
          Você será contactado em até 2 dias úteis após o envio.
        </p>
      </div>

      {/* Formulário */}
      <FormularioInvestidor isDemo={IS_DEMO} userId={userId} />

    </div>
  );
}
