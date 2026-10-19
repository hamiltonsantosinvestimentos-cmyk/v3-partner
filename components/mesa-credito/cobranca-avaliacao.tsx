"use client";

import { useEffect, useState } from "react";
import { Receipt, Plus, FileDown, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmar } from "@/lib/aviso";
import { formatCurrency, maskCurrencyBRLInput, parseCurrencyBRLInput } from "@/lib/utils";
import { dataBR, somarDiasUteis } from "@/lib/cobranca-mandato";
import { DESCRICAO_PADRAO, type CobrancaAvaliacao } from "@/lib/cobranca-avaliacao";

// Cobrança da avaliação de engenharia (19/10/2026, pedido do Hamilton): na etapa Avaliação de
// Imóvel a Mesa informa o valor do laudo e gera o PDF para o cliente pagar por PIX na conta da V3
// (ver /api/mesa-credito/cobranca-avaliacao/[proposalId]).

const INPUT = "w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#C9A84C]/60";
const hojeISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export function CobrancaAvaliacaoEngenharia({ proposalId, canEdit, etapaAtual, imovelPadrao }: {
  proposalId: string;
  canEdit: boolean;
  /** Proposta está na etapa Avaliação de Imóvel: o bloco aparece em destaque. */
  etapaAtual: boolean;
  /** Endereço/matrícula do imóvel, sugerido no formulário. */
  imovelPadrao?: string;
}) {
  const url = `/api/mesa-credito/cobranca-avaliacao/${proposalId}`;
  const [carregando, setCarregando] = useState(true);
  const [lista, setLista] = useState<CobrancaAvaliacao[]>([]);
  const [form, setForm] = useState(false);
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState(somarDiasUteis(hojeISO(), 2));
  const [descricao, setDescricao] = useState(DESCRICAO_PADRAO);
  const [imovel, setImovel] = useState(imovelPadrao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const j = await fetch(url).then((r) => r.json()).catch(() => null);
    if (j && !j.error) setLista(j.cobrancas ?? []);
    setCarregando(false);
  }

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    setForm(false);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);

  async function baixar(c: CobrancaAvaliacao) {
    setGerando(c.id);
    setErro(null);
    try {
      const res = await fetch(`${url}?id=${c.id}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErro(typeof j.error === "string" ? j.error : "Não foi possível gerar o PDF.");
        return;
      }
      const blob = await res.blob();
      const nome = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "Cobranca-Avaliacao.pdf";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nome;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      setErro("Falha de rede ao gerar o PDF.");
    } finally {
      setGerando(null);
    }
  }

  async function gerar() {
    const v = parseCurrencyBRLInput(valor);
    if (!(v > 0)) { setErro("Informe o valor da avaliação."); return; }
    if (!vencimento) { setErro("Informe o vencimento."); return; }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: v, vencimento, descricao, imovel }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j.error) { setErro(typeof j.error === "string" ? j.error : "Não foi possível salvar."); return; }
      setLista(j.cobrancas ?? []);
      setForm(false);
      setValor("");
      if (j.cobranca) await baixar(j.cobranca as CobrancaAvaliacao);
    } catch {
      setErro("Falha de rede ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function marcarPago(c: CobrancaAvaliacao) {
    setErro(null);
    const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, pago: !c.pago_em }) });
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j.error) setLista(j.cobrancas ?? []);
    else setErro(typeof j.error === "string" ? j.error : "Não foi possível atualizar.");
  }

  async function remover(c: CobrancaAvaliacao) {
    if (!(await confirmar(`Remover a cobrança ${c.codigo} de ${formatCurrency(c.valor)}?`))) return;
    setErro(null);
    const res = await fetch(`${url}?id=${c.id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j.error) setLista(j.cobrancas ?? []);
    else setErro(typeof j.error === "string" ? j.error : "Não foi possível remover.");
  }

  return (
    <div className={`p-4 rounded-xl border space-y-3 ${etapaAtual ? "border-[#C9A84C]/60 bg-[#C9A84C]/10" : "border-[#C9A84C]/30 bg-[#C9A84C]/5"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#C9A84C] flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Cobrança da avaliação de engenharia
          {etapaAtual && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#C9A84C]/20 text-[#E8C97A]">etapa atual</span>}
        </p>
        {canEdit && !form && (
          <button onClick={() => { setForm(true); setErro(null); }} className="flex items-center gap-1 text-[11px] font-semibold text-[#C9A84C] hover:text-[#E8C97A]">
            <Plus className="w-3 h-3" /> Nova cobrança
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">Informe o valor do laudo da empresa de engenharia e gere o PDF para o cliente pagar por PIX na conta da V3.</p>

      {carregando ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Carregando…</p>
      ) : lista.length > 0 ? (
        <div className="space-y-1.5">
          {lista.map((c) => (
            <div key={c.id} className="p-2.5 rounded-lg bg-background/60 border border-border flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-white font-semibold">
                  {formatCurrency(c.valor)}
                  <span className="text-[10px] font-normal text-muted-foreground"> · {c.codigo} · vence {dataBR(c.vencimento)}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {c.pago_em
                    ? <span className="text-[#E8C97A] font-semibold">Pago em {new Date(c.pago_em).toLocaleDateString("pt-BR")}{c.pago_por ? ` (${c.pago_por})` : ""}</span>
                    : <>Aguardando pagamento · gerada em {new Date(c.criado_em).toLocaleDateString("pt-BR")}{c.criado_por ? ` por ${c.criado_por}` : ""}</>}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => baixar(c)} disabled={gerando !== null} className="h-7 gap-1 text-[11px] border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10">
                  {gerando === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />} PDF
                </Button>
                {canEdit && (
                  <button onClick={() => marcarPago(c)} title={c.pago_em ? "Desmarcar pagamento" : "Marcar como pago"} className={`w-7 h-7 rounded flex items-center justify-center hover:bg-[#C9A84C]/10 ${c.pago_em ? "text-[#E8C97A]" : "text-muted-foreground hover:text-[#E8C97A]"}`}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => remover(c)} title="Remover cobrança" className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : !form && <p className="text-[11px] text-muted-foreground/70 italic">Nenhuma cobrança gerada.</p>}

      {form && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Valor da avaliação *</label>
              <input value={valor} onChange={(e) => setValor(maskCurrencyBRLInput(e.target.value))} placeholder="0,00" inputMode="numeric" className={INPUT} autoFocus />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Vencimento *</label>
              <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Imóvel</label>
            <input value={imovel} onChange={(e) => setImovel(e.target.value)} placeholder="Endereço / matrícula" className={INPUT} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Descrição no PDF</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className={INPUT} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { setForm(false); setErro(null); }} disabled={salvando}>Cancelar</Button>
            <Button size="sm" onClick={gerar} disabled={salvando} className="gap-1.5 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] border-0">
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />} Gerar PDF
            </Button>
          </div>
        </div>
      )}

      {erro && <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{erro}</p>}
    </div>
  );
}
