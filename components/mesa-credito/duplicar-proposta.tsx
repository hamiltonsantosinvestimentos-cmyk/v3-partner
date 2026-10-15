"use client";

import { useState } from "react";
import { Copy, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEVEL_LINES } from "@/lib/credit-checklists";
import { maskCurrencyBRLInput, parseCurrencyBRLInput, valorParaCampoBRL, formatCurrency } from "@/lib/utils";

// Botão "Duplicar" do modal da proposta (14/10/2026, pedido do Hamilton): cria
// uma proposta nova na linha escolhida com o mesmo cadastro do cliente e cópia
// dos documentos (ver /api/credit-proposals/[id]/duplicate).

type Nivel = "NIVEL_1" | "NIVEL_2" | "NIVEL_3";
const NIVEL_LABEL: Record<Nivel, string> = { NIVEL_1: "Nível 1", NIVEL_2: "Nível 2", NIVEL_3: "Nível 3" };
const INPUT = "w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#C9A84C]/60";

export type PropostaDuplicada = {
  id: string; code: string; title: string; client_name: string; credit_line: string;
  requested_value: number; current_level: string; status: string; stage: string;
  partner_id: string | null; metadata: Record<string, unknown> | null; created_at: string;
};

export function DuplicarProposta({
  proposal,
  onDuplicated,
}: {
  proposal: { id: string; code: string; client_name: string; credit_line: string; current_level?: string; requested_value: number };
  onDuplicated?: (nova: PropostaDuplicada) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [linhas, setLinhas] = useState<Record<Nivel, string[]> | null>(null);
  const [nivel, setNivel] = useState<Nivel>("NIVEL_1");
  const [linha, setLinha] = useState("");
  const [valor, setValor] = useState("");
  const [copiarDocs, setCopiarDocs] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ code: string; docs: number; falhas: string[] } | null>(null);

  function abrir() {
    setAberto(true);
    setErro(null);
    setResultado(null);
    setLinha("");
    setCopiarDocs(true);
    setValor(valorParaCampoBRL(proposal.requested_value));
    const nivelAtual = (["NIVEL_1", "NIVEL_2", "NIVEL_3"].includes(proposal.current_level ?? "") ? proposal.current_level : "NIVEL_1") as Nivel;
    setNivel(nivelAtual);
    if (!linhas) {
      const fallback = { NIVEL_1: LEVEL_LINES.NIVEL_1 ?? [], NIVEL_2: LEVEL_LINES.NIVEL_2 ?? [], NIVEL_3: LEVEL_LINES.NIVEL_3 ?? [] };
      fetch("/api/portfolio")
        .then((r) => r.json())
        .then(({ linhas: ls }) => {
          if (!Array.isArray(ls)) return setLinhas(fallback);
          const map: Record<Nivel, string[]> = { NIVEL_1: [], NIVEL_2: [], NIVEL_3: [] };
          for (const l of ls as { nome: string; nivel?: string }[]) {
            if (l.nivel && l.nivel in map) map[l.nivel as Nivel].push(l.nome);
          }
          for (const n of Object.keys(map) as Nivel[]) if (map[n].length === 0) map[n] = fallback[n];
          setLinhas(map);
        })
        .catch(() => setLinhas(fallback));
    }
  }

  function fechar() {
    if (enviando) return;
    setAberto(false);
  }

  async function duplicar() {
    const v = parseCurrencyBRLInput(valor);
    if (!linha) return setErro("Escolha a linha da nova proposta.");
    if (!v || v <= 0) return setErro("Informe o valor solicitado.");
    if (nivel === "NIVEL_3" && v < 5_000_000) return setErro("Nível 3 exige valor mínimo de R$ 5.000.000.");
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/credit-proposals/${proposal.id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credit_line: linha, current_level: nivel, requested_value: v, copiar_documentos: copiarDocs }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Erro ao duplicar a proposta");
      setResultado({ code: json.proposal.code, docs: json.documentos_copiados ?? 0, falhas: json.documentos_com_falha ?? [] });
      onDuplicated?.(json.proposal as PropostaDuplicada);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao duplicar a proposta");
    } finally {
      setEnviando(false);
    }
  }

  const opcoes = (linhas?.[nivel] ?? []).filter((l) => l !== proposal.credit_line);

  return (
    <>
      <Button variant="outline" size="sm" onClick={abrir}
        className="gap-1.5 border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10">
        <Copy className="w-3.5 h-3.5" />
        Duplicar
      </Button>

      {aberto && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm overflow-y-auto" onClick={fechar}>
          <div className="bg-card border border-[#C9A84C]/30 rounded-2xl w-full max-w-lg animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <Copy className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-sm font-bold text-white">Duplicar proposta em outra linha</h3>
              <span className="ml-auto text-[10px] uppercase tracking-widest text-[#C9A84C]">{proposal.code}</span>
            </div>

            {resultado ? (
              <div className="px-5 py-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <p className="text-sm font-semibold">Proposta {resultado.code} criada em {linha}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mesmo cliente ({proposal.client_name}), {resultado.docs} documento{resultado.docs === 1 ? "" : "s"} copiado{resultado.docs === 1 ? "" : "s"}. Ela entra em Recebido no Kanban.
                </p>
                {resultado.falhas.length > 0 && (
                  <p className="text-[11px] text-amber-400 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    Não consegui copiar: {resultado.falhas.join(", ")}. Suba esses de novo na nova proposta.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setAberto(false)}>Fechar</Button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Cria uma proposta nova para <span className="text-white">{proposal.client_name}</span> com os mesmos dados do cadastro
                  {copiarDocs ? " e uma cópia dos documentos" : ""}. A proposta atual ({proposal.credit_line}) continua como está.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Nível</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(NIVEL_LABEL) as Nivel[]).map((n) => (
                      <button key={n} onClick={() => { setNivel(n); setLinha(""); }}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${nivel === n ? "border-[#C9A84C] bg-[#C9A84C]/10 text-[#C9A84C]" : "border-border text-muted-foreground hover:text-white"}`}>
                        {NIVEL_LABEL[n]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Nova linha</label>
                  {linhas ? (
                    <select value={linha} onChange={(e) => setLinha(e.target.value)} className={INPUT}>
                      <option value="">Selecione…</option>
                      {opcoes.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando linhas…</div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Valor solicitado</label>
                  <input value={valor} onChange={(e) => setValor(maskCurrencyBRLInput(e.target.value))} className={INPUT} placeholder="0,00" inputMode="numeric" />
                  <p className="text-[10px] text-muted-foreground">Proposta atual: {formatCurrency(proposal.requested_value)}</p>
                </div>

                <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                  <input type="checkbox" checked={copiarDocs} onChange={(e) => setCopiarDocs(e.target.checked)} className="accent-[#C9A84C]" />
                  Copiar os documentos e o OCR já feito
                </label>

                {erro && <p className="text-[11px] text-red-400">{erro}</p>}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={fechar} disabled={enviando}>Cancelar</Button>
                  <Button size="sm" onClick={duplicar} disabled={enviando || !linha} className="gap-1.5">
                    {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                    Criar nova proposta
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
