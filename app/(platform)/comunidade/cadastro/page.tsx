import { CadastroTrial } from "@/components/comunidade/cadastro-trial";

export default function CadastroPage() {
  return (
    <div className="min-h-screen bg-[#09081A] py-10 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-8">
          <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C] mb-2">
            Comunidade V3 · Trial Gratuito
          </p>
          <h1 className="text-3xl font-bold text-[#F0ECE4]">Criar Conta Trial</h1>
          <p className="text-sm text-[#7A8FA8] mt-1">
            30 dias de acesso gratuito à Comunidade de Negócios V3.
          </p>
        </div>
        <CadastroTrial />
      </div>
    </div>
  );
}
