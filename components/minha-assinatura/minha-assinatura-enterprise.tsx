// "Sua assinatura com {marca}" para o usuário da equipe Enterprise
// (BRIEF docs/briefs/2026-11-23_enterprise-assinatura-da-equipe.md). Recebe do servidor só estes campos.
import { BadgeCheck } from "lucide-react";

export interface MinhaAssinaturaEquipe {
  marca: string;
  indisponivel: boolean;
  cobra: boolean;
  valor: string | null;
  periodicidade: string | null;
  proximoVencimento: string | null;
  situacao: string;
  vencida: boolean;
}

export function MinhaAssinaturaEnterprise({ dados }: { dados: MinhaAssinaturaEquipe }) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><BadgeCheck className="w-6 h-6 text-[#C9A84C]" /> Minha Assinatura</h1>
        <p className="text-sm text-muted-foreground mt-1">Sua assinatura com {dados.marca}.</p>
      </div>
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-6 space-y-4">
        {dados.indisponivel ? (
          <p className="text-sm text-[#9BAFC5]">Informação indisponível no momento.</p>
        ) : !dados.cobra ? (
          <p className="text-sm text-[#F0ECE4]">Sem cobrança: o seu acesso está incluído pela {dados.marca}.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["Valor", dados.valor],
                ["Periodicidade", dados.periodicidade],
                ["Próximo vencimento", dados.proximoVencimento],
                ["Situação", dados.situacao],
              ].map(([rotulo, v]) => (
                <div key={rotulo}>
                  <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wide">{rotulo}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${rotulo === "Situação" && dados.vencida ? "text-red-400" : "text-[#F0ECE4]"}`}>{v}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#7A8FA8]">A cobrança é feita diretamente pela {dados.marca}.</p>
          </>
        )}
      </div>
    </div>
  );
}
