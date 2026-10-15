"use client";

import { useEffect, useState } from "react";
import { Banknote, Plus, FileDown, Trash2, Loader2, FileSignature, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirmar } from "@/lib/aviso";
import { formatCurrency, maskCurrencyBRLInput, parseCurrencyBRLInput } from "@/lib/utils";
import { dataBR, type RecursoLiberado } from "@/lib/cobranca-mandato";

// Recursos liberados (15/10/2026, pedido do Hamilton): a Mesa lança cada
// liberação (tranche) da operação e gera, pelo Mandato de Crédito assinado,
// o PDF de cobrança da Remuneração de Sucesso para enviar ao cliente pagar
// (ver /api/mesa-credito/cobranca-mandato/[proposalId]).

type MandatoInfo = { contract_code: string; signed_at: string | null; percentual: number; contratante_nome: string };
type Recurso = RecursoLiberado & { remuneracao?: number; vencimento?: string };

const INPUT = "w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#C9A84C]/60";

function hojeISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function RecursosLiberados({
  proposalId,
  canEdit,
  onChange,
}: {
  proposalId: string;
  canEdit: boolean;
  onChange?: (recursos: RecursoLiberado[]) => void;
}) {
  const url = `/api/mesa-credito/cobranca-mandato/${proposalId}`;
  const [carregando, setCarregando] = useState(true);
  const [mandato, setMandato] = useState<MandatoInfo | null>(null);
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [form, setForm] = useState(false);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(hojeISO());
  const [instituicao, setInstituicao] = useState("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    const j = await fetch(url).then((r) => r.json()).catch(() => null);
    if (j && !j.error) {
      setMandato(j.mandato ?? null);
      setRecursos(j.recursos ?? []);
    }
    setCarregando(false);
  }

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    setForm(false);
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);

  async function aplicar(res: Response) {
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.error) {
      setErro(typeof j.error === "string" ? j.error : "Não foi possível salvar.");
      return false;
    }
    onChange?.(j.recursos ?? []);
    await carregar();
    return true;
  }

  async function adicionar() {
    const v = parseCurrencyBRLInput(valor);
    if (!(v > 0)) { setErro("Informe o valor liberado."); return; }
    if (!data) { setErro("Informe a data da liberação."); return; }
    setSalvando(true);
    setErro(null);
    try {
      const ok = await aplicar(await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor: v, data, instituicao, obs }),
      }));
      if (ok) {
        setForm(false);
        setValor("");
        setInstituicao("");
        setObs("");
        setData(hojeISO());
      }
    } catch {
      setErro("Falha de rede ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(r: Recurso) {
    const ok = await confirmar(`Remover a liberação de ${formatCurrency(r.valor)} de ${dataBR(r.data)}?`);
    if (!ok) return;
    setErro(null);
    try {
      await aplicar(await fetch(`${url}?liberacao=${r.id}`, { method: "DELETE" }));
    } catch {
      setErro("Falha de rede ao remover.");
    }
  }

  async function baixarPdf(r: Recurso) {
    setGerando(r.id);
    setErro(null);
    try {
      const res = await fetch(`${url}?liberacao=${r.id}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErro(typeof j.error === "string" ? j.error : "Não foi possível gerar o PDF.");
        return;
      }
      const blob = await res.blob();
      const nome = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "Cobranca.pdf";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nome;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      if (!r.cobranca_gerada_em) carregar();
    } catch {
      setErro("Falha de rede ao gerar o PDF.");
    } finally {
      setGerando(null);
    }
  }

  const total = recursos.reduce((s, r) => s + r.valor, 0);
  const totalRemuneracao = recursos.reduce((s, r) => s + (r.remuneracao ?? 0), 0);

  return (
    <div className="p-4 rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#C9A84C] flex items-center gap-1.5">
          <Banknote className="w-3.5 h-3.5" /> Recursos Liberados
        </p>
        {canEdit && !form && (
          <button
            onClick={() => { setForm(true); setErro(null); }}
            className="flex items-center gap-1 text-[11px] font-semibold text-[#C9A84C] hover:text-[#E8C97A]"
          >
            <Plus className="w-3 h-3" /> Adicionar liberação
          </button>
        )}
      </div>

      {carregando ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Carregando…</p>
      ) : mandato ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <FileSignature className="w-3 h-3 text-[#C9A84C]" />
          Mandato <span className="text-white font-medium">{mandato.contract_code}</span>
          {mandato.signed_at && <> assinado em {new Date(mandato.signed_at).toLocaleDateString("pt-BR")}</>}
          {" "}· {mandato.percentual.toLocaleString("pt-BR")}% sobre cada liberação
        </p>
      ) : (
        <p className="text-[11px] text-amber-400/90 flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
          Sem Mandato de Crédito assinado nesta proposta. Dá para lançar as liberações, mas o PDF de cobrança só sai com o mandato assinado.
        </p>
      )}

      {recursos.length > 0 && (
        <div className="space-y-1.5">
          {recursos.map((r, i) => (
            <div key={r.id} className="p-2.5 rounded-lg bg-background/60 border border-border flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-white font-semibold">
                  {formatCurrency(r.valor)}
                  <span className="text-[10px] font-normal text-muted-foreground"> · T{i + 1} · {dataBR(r.data)}{r.instituicao ? ` · ${r.instituicao}` : ""}</span>
                </p>
                {r.remuneracao != null && (
                  <p className="text-[10px] text-muted-foreground">
                    Cobrança <span className="text-[#E8C97A] font-semibold">{formatCurrency(r.remuneracao)}</span>
                    {r.vencimento && <> · vence {dataBR(r.vencimento)}</>}
                    {r.cobranca_gerada_em && <> · PDF gerado em {new Date(r.cobranca_gerada_em).toLocaleDateString("pt-BR")}</>}
                  </p>
                )}
                {r.obs && <p className="text-[10px] text-muted-foreground/80 truncate">{r.obs}</p>}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => baixarPdf(r)}
                  disabled={!mandato || gerando !== null}
                  title={!mandato ? "Precisa de Mandato de Crédito assinado" : "Baixar PDF de cobrança para enviar ao cliente"}
                  className="h-7 gap-1 text-[11px] border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 disabled:opacity-40"
                >
                  {gerando === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileDown className="w-3 h-3" />}
                  PDF de cobrança
                </Button>
                {canEdit && (
                  <button
                    onClick={() => remover(r)}
                    title="Remover liberação"
                    className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-muted-foreground">Total liberado</span>
            <span className="font-semibold text-white">{formatCurrency(total)}</span>
          </div>
          {mandato && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Remuneração de Sucesso total</span>
              <span className="font-semibold text-[#E8C97A]">{formatCurrency(totalRemuneracao)}</span>
            </div>
          )}
        </div>
      )}

      {!carregando && recursos.length === 0 && !form && (
        <p className="text-[11px] text-muted-foreground/70 italic">Nenhuma liberação lançada.</p>
      )}

      {form && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Valor liberado *</label>
              <input
                value={valor}
                onChange={(e) => setValor(maskCurrencyBRLInput(e.target.value))}
                placeholder="0,00"
                inputMode="numeric"
                className={INPUT}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Data da liberação *</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={INPUT} />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Instituição</label>
            <input value={instituicao} onChange={(e) => setInstituicao(e.target.value)} placeholder="Banco, fundo, cooperativa…" className={INPUT} />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground mb-1">Observação</label>
            <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: 1ª tranche" className={INPUT} />
          </div>
          {mandato && parseCurrencyBRLInput(valor) > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Cobrança: <span className="text-[#E8C97A] font-semibold">
                {formatCurrency(Math.round(parseCurrencyBRLInput(valor) * mandato.percentual) / 100)}
              </span> ({mandato.percentual.toLocaleString("pt-BR")}% do mandato)
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => { setForm(false); setErro(null); }} disabled={salvando}>Cancelar</Button>
            <Button size="sm" onClick={adicionar} disabled={salvando} className="gap-1.5 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] border-0">
              {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {erro && <p className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{erro}</p>}
    </div>
  );
}
