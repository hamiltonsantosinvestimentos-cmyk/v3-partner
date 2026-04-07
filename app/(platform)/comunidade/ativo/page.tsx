import { cookies } from "next/headers";
import { FormularioAtivo } from "@/components/comunidade/formulario-ativo";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export default async function AtivoPage() {
  let userId = "demo-user";

  if (!IS_DEMO) {
    try {
      const cookieStore = await cookies();
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = createClient(cookieStore);
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? "demo-user";
    } catch {
      // fallback to demo
    }
  }

  return (
    <div className="min-h-screen bg-[#09081A] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C] mb-2">
            Comunidade V3 · Sell-Side
          </p>
          <h1 className="text-3xl font-bold text-[#F0ECE4]">Submeter Ativo</h1>
          <p className="text-sm text-[#7A8FA8] mt-1">
            Preencha as informações do ativo para análise pela equipe V3.
          </p>
        </div>
        <FormularioAtivo isDemo={IS_DEMO} userId={userId} />
      </div>
    </div>
  );
}
