"use client";

// "Permissões da Mesa" (BRIEF Permissões do Analista de Mesa, 17/11/2026). Só ADMIN (a rota valida o papel no servidor).
// Lista os Analistas de Mesa em ordem alfabética e deixa conceder ou revogar a permissão de excluir documento de
// qualificação. Conceder e revogar abrem um modal vermelho que só fecha por botão (nunca clicando fora nem com Escape).
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Dica } from "@/components/shared/dica";

interface Analista { id: string; nome: string; excluir_documento: boolean }

export function PermissoesMesaPanel() {
  const [lista, setLista] = useState<Analista[] | null>(null);
  const [erro, setErro] = useState("");
  const [alvo, setAlvo] = useState<{ a: Analista; acao: "conceder" | "revogar" } | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const r = await fetch("/api/usuarios/permissoes-mesa", { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as { analistas?: Analista[]; error?: string };
      if (!r.ok) { setErro(j.error ?? "Não foi possível carregar a lista."); setLista([]); return; }
      setLista(j.analistas ?? []);
    } catch {
      setErro("Não foi possível carregar a lista.");
      setLista([]);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function confirmar() {
    if (!alvo) return;
    setSalvando(true);
    setErro("");
    try {
      const r = await fetch("/api/usuarios/permissoes-mesa", {
        method: alvo.acao === "conceder" ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: alvo.a.id, feature: "qualificacao_excluir_documento" }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) { setErro(j.error ?? "Não foi possível concluir."); return; }
      setAlvo(null);
      await carregar();
    } catch {
      setErro("Não foi possível concluir.");
    } finally {
      setSalvando(false);
    }
  }

  const conceder = alvo?.acao === "conceder";
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-[#F5F1E8] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#C9A84C]" aria-hidden="true" /> Permissões da Mesa
        </h2>
        <p className="text-xs text-[#9BAFC5] mt-1 max-w-2xl">
          Quem tem o papel Analista de Mesa e pode excluir um documento recebido errado numa qualificação. O documento vai para a Lixeira por 30 dias,
          a ficha volta ao titular pelo mesmo link e a governança é avisada. Cada mudança fica registrada no log de auditoria.
        </p>
      </div>

      {erro && !alvo && <p role="alert" className="text-xs text-[#F26D6D] rounded-lg border border-[#F26D6D]/40 bg-[#F26D6D]/5 px-3 py-2">{erro}</p>}
      {lista === null && <p className="text-xs text-[#9BAFC5] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...</p>}
      {lista && lista.length === 0 && !erro && <p className="text-sm text-[#9BAFC5]">Nenhum Analista de Mesa cadastrado.</p>}

      {lista && lista.length > 0 && (
        <div className="rounded-xl border border-[#243A66] overflow-hidden">
          <div className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-[#E8C97A] border-b border-[#243A66]">
            <span>Analista</span>
            <span className="flex items-center gap-1.5">Excluir documento de qualificação
              <Dica id="analista_permissao_excluir" />
            </span>
          </div>
          {lista.map((a) => (
            <div key={a.id} className="grid grid-cols-[1fr_auto] gap-3 items-center px-4 py-3 border-b border-[#243A66]/50 last:border-b-0">
              <span className="text-sm text-[#F5F1E8]">{a.nome}</span>
              <button
                type="button"
                onClick={() => { setErro(""); setAlvo({ a, acao: a.excluir_documento ? "revogar" : "conceder" }); }}
                className={`text-xs font-bold rounded-lg px-3 py-1.5 border transition-colors ${a.excluir_documento
                  ? "border-[#4ADE80]/50 text-[#4ADE80] hover:bg-[#4ADE80]/10"
                  : "border-[#243A66] text-[#9BAFC5] hover:border-[#C9A84C] hover:text-[#F5F1E8]"}`}
              >
                {a.excluir_documento ? "Concedida (revogar)" : "Não concedida (conceder)"}
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!alvo}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="max-w-md w-[calc(100vw-32px)] border border-[#F26D6D]/50 [&>button.absolute]:hidden"
        >
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#F26D6D]">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            {conceder ? "Conceder permissão de excluir documento" : "Revogar permissão de excluir documento"}
          </DialogTitle>
          <p className="text-sm text-[#F5F1E8]">
            {conceder
              ? <>Você vai permitir que <strong>{alvo?.a.nome}</strong> exclua documentos de qualificação. Cada exclusão vai para a Lixeira por 30 dias, devolve a ficha ao titular, avisa a governança e conta no limite de 20 por dia.</>
              : <>Você vai retirar de <strong>{alvo?.a.nome}</strong> a permissão de excluir documentos de qualificação. O botão Excluir deixa de aparecer para essa pessoa.</>}
          </p>
          {erro && <p role="alert" className="text-xs text-[#F26D6D] rounded-lg border border-[#F26D6D]/40 bg-[#F26D6D]/5 px-3 py-2">{erro}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" disabled={salvando} onClick={() => { setAlvo(null); setErro(""); }}
              className="text-sm rounded-lg px-4 py-2 border border-[#243A66] text-[#9BAFC5] hover:text-[#F5F1E8]">Cancelar</button>
            <button type="button" disabled={salvando} onClick={confirmar}
              className="text-sm font-bold rounded-lg px-4 py-2 bg-[#F26D6D] text-[#09081A] hover:opacity-90 disabled:opacity-60 flex items-center gap-2">
              {salvando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {conceder ? "Conceder" : "Revogar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
