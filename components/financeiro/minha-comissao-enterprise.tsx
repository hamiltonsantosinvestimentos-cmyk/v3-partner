// "Minha comissão" do usuário da equipe Enterprise (BRIEF 2026-11-23 menu enxuto e comissões).
// Recebe do servidor só data, operação, valor e situação: nada do master nem o %.
import { Wallet } from "lucide-react";
import type { MinhaComissao } from "@/app/api/enterprise/repasses/visao-usuario";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

export function MinhaComissaoEnterprise({ dados }: { dados: MinhaComissao }) {
  const situacao = (s: MinhaComissao["linhas"][number]) =>
    s.status === "PAGO" ? `Recebido${s.pagoEm ? ` em ${data(s.pagoEm)}` : ""}` : s.status === "CANCELADO" ? "Cancelado" : "A receber";
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Wallet className="w-6 h-6 text-[#C9A84C]" /> Minha comissão</h1>
        <p className="text-sm text-muted-foreground mt-1">O que você recebe pelas suas operações.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {([["A receber", dados.totais.pendente], ["Recebido", dados.totais.pago], ["Total", dados.totais.total]] as const).map(([rotulo, v]) => (
          <div key={rotulo} className="rounded-xl border border-border/50 bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{rotulo}</p>
            <p className="text-lg font-bold text-foreground mt-1">{brl(v)}</p>
          </div>
        ))}
      </div>
      {dados.linhas.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhuma comissão ainda. Ela aparece aqui quando uma operação sua for liberada.
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {["Data", "Operação", "Sua comissão", "Situação"].map((h) => <th key={h} className="text-left px-3 py-2.5">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {dados.linhas.map((l) => (
                <tr key={l.id} className="border-t border-border/40">
                  <td className="px-3 py-2">{data(l.criadoEm)}</td>
                  <td className="px-3 py-2">{l.operacao ?? "—"}</td>
                  <td className="px-3 py-2 font-semibold text-foreground">{brl(l.valor)}</td>
                  <td className="px-3 py-2">{situacao(l)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
