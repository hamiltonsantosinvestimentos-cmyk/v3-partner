"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ScanSearch, AlertTriangle, TrendingUp, Copy, Check, FileText, ChevronDown, ChevronUp } from "lucide-react";
import type { RaioXExtratoSalvo } from "@/lib/raio-x-extrato";

// Raio-X do extrato na proposta: escolhe os extratos anexados, lê com IA (OFX direto) e mostra
// tarifas, seguros, juros e serviços cobrados, com o que dá para negociar ou cancelar.
// Mesmo cálculo do raio-X da Análise Estruturada V3 (lib/analise-estruturada/calculo.ts).

interface Arquivo { id: string; nome: string; rotulo: string; origem: "anexo" | "captacao"; extratoProvavel: boolean }

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const mesBR = (m: string) => { const [a, mm] = m.split("-"); return `${mm}/${a}`; };

export function RaioXExtrato({ proposalId, clienteNome }: { proposalId: string; clienteNome: string }) {
  const [arquivos, setArquivos] = useState<Arquivo[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [raio, setRaio] = useState<RaioXExtratoSalvo | null>(null);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState("");
  const [verLanc, setVerLanc] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/credit-proposals/${proposalId}/raio-x-extrato`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Falha ao carregar.");
      setArquivos(d.arquivos);
      setRaio(d.raioX);
      setSel(new Set((d.arquivos as Arquivo[]).filter((a) => a.extratoProvavel).map((a) => a.id)));
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao carregar."); setArquivos([]); }
  }, [proposalId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function analisar() {
    setRodando(true); setErro("");
    try {
      const r = await fetch(`/api/credit-proposals/${proposalId}/raio-x-extrato`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...sel] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Falha na análise.");
      setRaio(d.raioX);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha na análise."); }
    finally { setRodando(false); }
  }

  const res = raio?.resultado ?? null;
  const resumo = useMemo(() => {
    if (!res) return "";
    const linhas = res.categorias.slice(0, 5).map((c) => `• ${c.nome}: ${brl(c.mediaMensal)}/mês (${brl(c.projecaoAnual)} em 12 meses)`);
    return `Raio-X dos extratos — ${clienteNome}\n\nEm ${res.mesesAnalisados} mês(es) de extrato, as cobranças bancárias somaram ${brl(res.totalPeriodo)}. ` +
      `Projetado para 12 meses: ${brl(res.projecaoAnual)}. Economia possível estimada: ${brl(res.economiaAnualEstimada)} por ano.\n\n` +
      `${linhas.join("\n")}\n\nAntes de cancelar qualquer seguro ou serviço, confira se ele está vinculado a algum empréstimo.`;
  }, [res, clienteNome]);

  function copiar() {
    navigator.clipboard.writeText(resumo).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }).catch(() => {});
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#E8C97A]">Raio-X do extrato</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">Tarifas, seguros, juros e serviços cobrados nos extratos do cliente</p>
            <p className="text-xs text-muted-foreground mt-1">Escolha os extratos anexados (PDF, OFX ou planilha). A leitura usa IA e leva de 30 segundos a 2 minutos.</p>
          </div>
          {raio && <p className="text-[11px] text-muted-foreground">Último raio-X: {dataHora(raio.gerado_em)} · {raio.gerado_por}</p>}
        </div>

        {arquivos === null ? (
          <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando arquivos da proposta…</p>
        ) : arquivos.length === 0 ? (
          <p className="text-xs text-amber-400">Nenhum arquivo anexado a esta proposta ainda. Anexe os extratos na aba Documentos.</p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {arquivos.map((a) => (
              <label key={a.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-secondary/40 border border-border/50 cursor-pointer hover:border-[#C9A84C]/40">
                <input type="checkbox" className="accent-[#C9A84C]" checked={sel.has(a.id)}
                  onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(a.id); else n.delete(a.id); return n; })} />
                <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-foreground truncate">{a.nome}</span>
                  <span className="block text-[10px] text-muted-foreground truncate">{a.rotulo}{a.origem === "captacao" ? " · enviado pelo cliente" : ""}</span>
                </span>
                {a.extratoProvavel && <span className="text-[9px] font-bold uppercase tracking-wider text-[#E8C97A]">extrato</span>}
              </label>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={analisar} disabled={rodando || sel.size === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-50">
            {rodando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanSearch className="w-3.5 h-3.5" />}
            {rodando ? "Lendo os extratos…" : raio ? "Refazer o raio-X" : "Analisar extratos"}
          </button>
          <span className="text-[11px] text-muted-foreground">{sel.size} arquivo(s) escolhido(s)</span>
        </div>
        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </div>

      {raio && (
        <>
          {raio.arquivos.some((a) => a.status !== "lido") && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1">
              {raio.arquivos.filter((a) => a.status !== "lido").map((a) => (
                <p key={a.id} className="text-[11px] text-amber-400">{a.nome}: {a.erro}</p>
              ))}
            </div>
          )}

          {!res ? (
            <p className="text-xs text-muted-foreground">Nenhuma cobrança bancária encontrada nos extratos lidos.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Cobrado no período</p>
                  <p className="text-xl font-bold text-foreground mt-1">{brl(res.totalPeriodo)}</p>
                  <p className="text-[11px] text-muted-foreground">{res.mesesAnalisados} mês(es) de extrato</p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Projeção em 12 meses</p>
                  <p className="text-xl font-bold text-foreground mt-1">{brl(res.projecaoAnual)}</p>
                  <p className="text-[11px] text-muted-foreground">no ritmo atual</p>
                </div>
                <div className="p-4 rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/10">
                  <p className="text-[10px] uppercase tracking-wider text-[#E8C97A]">Economia possível</p>
                  <p className="text-xl font-bold text-[#E8C97A] mt-1">{brl(res.economiaAnualEstimada)}<span className="text-xs font-semibold"> /ano</span></p>
                  <p className="text-[11px] text-muted-foreground">estimativa negociando ou cancelando</p>
                </div>
              </div>

              {res.pacoteEmMaisDeUmBanco.length > 0 && (
                <p className="text-xs text-amber-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Pacote de serviços cobrado em {res.pacoteEmMaisDeUmBanco.length} bancos ({res.pacoteEmMaisDeUmBanco.join(", ")}): dá para concentrar em um.</p>
              )}

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr><th className="text-left px-3 py-2">Categoria</th><th className="text-right px-3 py-2">Lanç.</th><th className="text-right px-3 py-2">Por mês</th><th className="text-right px-3 py-2">12 meses</th><th className="text-right px-3 py-2">Economia</th><th className="text-left px-3 py-2">O que fazer</th></tr>
                    </thead>
                    <tbody>
                      {res.categorias.map((c) => (
                        <tr key={c.id} className="border-t border-border/50 align-top">
                          <td className="px-3 py-2 font-semibold text-foreground whitespace-nowrap">{c.nome}{c.bancos.length ? <span className="block text-[10px] font-normal text-muted-foreground">{c.bancos.join(", ")}</span> : null}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{c.lancamentos}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{brl(c.mediaMensal)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{brl(c.projecaoAnual)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-[#E8C97A]">{brl(c.economiaAnualEstimada)}</td>
                          <td className="px-3 py-2 text-muted-foreground min-w-[220px]">{c.acao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {res.recorrentes.length > 0 && (
                <div className="rounded-xl border border-border p-3 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cobranças que se repetem todo mês</p>
                  {res.recorrentes.slice(0, 12).map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate text-foreground">{r.descricao}<span className="text-muted-foreground">{r.banco ? ` · ${r.banco}` : ""} · {r.ocorrencias}x</span></span>
                      <span className="flex items-center gap-2 flex-shrink-0 tabular-nums">
                        {r.aumentou && <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-400"><TrendingUp className="w-3 h-3" /> aumentou</span>}
                        {brl(r.valorAtual)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {raio.movimento.length > 0 && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-secondary/60 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="text-left px-3 py-2">Mês</th><th className="text-right px-3 py-2">Entradas</th><th className="text-right px-3 py-2">Saídas</th></tr></thead>
                      <tbody>{raio.movimento.map((m) => (
                        <tr key={m.mes} className="border-t border-border/50"><td className="px-3 py-1.5">{mesBR(m.mes)}</td><td className="px-3 py-1.5 text-right tabular-nums">{brl(m.entradas)}</td><td className="px-3 py-1.5 text-right tabular-nums">{brl(m.saidas)}</td></tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={copiar} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C] text-[#E8C97A] text-xs font-bold">
                  {copiado ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copiado ? "Resumo copiado" : "Copiar resumo para o cliente"}
                </button>
                <button onClick={() => setVerLanc((v) => !v)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  {verLanc ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} {verLanc ? "Esconder" : "Ver"} os {res.lancamentos.length} lançamentos
                </button>
              </div>

              {verLanc && (
                <div className="rounded-xl border border-border max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody>{res.lancamentos.map((l, i) => (
                      <tr key={i} className="border-t border-border/40 first:border-0">
                        <td className="px-3 py-1.5 whitespace-nowrap text-muted-foreground">{l.data.split("-").reverse().join("/")}</td>
                        <td className="px-3 py-1.5">{l.descricao}{l.banco ? <span className="text-muted-foreground"> · {l.banco}</span> : null}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums whitespace-nowrap">{brl(l.valor)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">Estimativa a partir dos extratos. Seguro exigido junto com empréstimo deve ser verificado antes de qualquer cancelamento.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
