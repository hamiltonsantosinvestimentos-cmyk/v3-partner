"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { GitCompareArrows, Loader2, X } from "lucide-react";
import { ATIVO_POR_SIMBOLO, type Cotacao, type PeriodoHistorico, type SerieHistorica } from "@/lib/mercado/catalogo";
import { COR, Faixa, Variacao, corVar, fmtCompacto, fmtNum, fmtPct, fmtPreco } from "@/components/mercado/ui";

export const PERIODOS: { v: PeriodoHistorico; t: string }[] = [
  { v: "1mo", t: "1M" }, { v: "3mo", t: "3M" }, { v: "6mo", t: "6M" }, { v: "ytd", t: "No ano" }, { v: "1y", t: "12M" }, { v: "5y", t: "5A" },
];

export function fmtDataEixo(t: number, periodo: PeriodoHistorico) {
  const d = new Date(t * 1000);
  return periodo === "5y"
    ? d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function AtivoModal({ simbolo, cotacao: cotacaoInicial, onFechar, onComparar }: {
  simbolo: string; cotacao?: Cotacao; onFechar: () => void; onComparar?: (simbolo: string) => void;
}) {
  const ativo = ATIVO_POR_SIMBOLO.get(simbolo);
  const [cotacao, setCotacao] = useState<Cotacao | undefined>(cotacaoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<PeriodoHistorico>("1y");
  const [serie, setSerie] = useState<SerieHistorica | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => { if (cotacaoInicial) setCotacao(cotacaoInicial); }, [cotacaoInicial]);
  useEffect(() => {
    if (cotacaoInicial) return;
    fetch(`/api/mercado/cotacoes?ativo=${encodeURIComponent(simbolo)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setCotacao(j); })
      .catch((e) => setErro(e instanceof Error ? e.message : "Ativo não encontrado."));
  }, [simbolo, cotacaoInicial]);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    fetch(`/api/mercado/historico?simbolos=${encodeURIComponent(simbolo)}&periodo=${periodo}`)
      .then((r) => r.json())
      .then((j) => { if (vivo) setSerie(j.series?.[0] ?? null); })
      .catch(() => { if (vivo) setSerie(null); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [simbolo, periodo]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);

  const dados = useMemo(() => (serie?.pontos ?? []).map((p) => ({ t: p.t, v: p.v })), [serie]);
  const rentPeriodo = dados.length > 1 ? (dados[dados.length - 1].v / dados[0].v - 1) * 100 : null;
  const cor = corVar(rentPeriodo);
  const nome = ativo?.nome ?? cotacao?.nome ?? simbolo;
  const codigo = ativo?.codigo ?? simbolo.replace(/\.SA$/, "");

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={nome}>
      <div className="absolute inset-0 bg-[#09081A]/80 backdrop-blur-md" onClick={onFechar} />
      <div className="v3-cmdk relative max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[#C9A84C]/30 bg-gradient-to-b from-[#162744] to-[#09081A] p-5 sm:p-7 shadow-[0_40px_120px_-40px_rgba(201,168,76,.5)]">
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8C97A] to-transparent" />
        <button onClick={onFechar} aria-label="Fechar" className="absolute right-4 top-4 rounded-lg p-2 text-[#7A8FA8] hover:bg-white/5 hover:text-[#F0ECE4]"><X className="h-5 w-5" /></button>

        <div className="flex flex-wrap items-start justify-between gap-4 pr-10">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#C9A84C]">{ativo?.setor ?? ativo?.regiao ?? "Ativo"}</p>
            <h3 className="mt-1 text-2xl sm:text-3xl font-bold text-[#F0ECE4]">{codigo}</h3>
            <p className="text-sm text-[#7A8FA8]">{nome}</p>
          </div>
          {cotacao && (
            <div className="text-right">
              <p className="text-3xl sm:text-4xl font-bold tabular-nums text-[#F0ECE4]">{fmtPreco(ativo, cotacao.preco)}</p>
              <div className="mt-1 flex items-center justify-end gap-2">
                <Variacao v={cotacao.variacao} tamanho="md" fundo />
                <span className="text-[11px] text-[#7A8FA8]">hoje</span>
              </div>
            </div>
          )}
        </div>
        {erro && <p className="mt-6 rounded-xl border border-red-400/30 px-4 py-3 text-sm text-red-300">{erro}</p>}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-[#243A66] bg-[#09081A]/60 p-1">
            {PERIODOS.map((p) => (
              <button key={p.v} onClick={() => setPeriodo(p.v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${periodo === p.v ? "bg-[#C9A84C] text-[#09081A] shadow" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}>
                {p.t}
              </button>
            ))}
          </div>
          <p className="text-xs text-[#7A8FA8]">No período: <span className="font-bold" style={{ color: cor }}>{fmtPct(rentPeriodo)}</span></p>
        </div>

        <div className="relative mt-4 h-72 rounded-2xl border border-[#243A66]/60 bg-[#09081A]/50 p-2">
          {carregando && <div className="absolute inset-0 z-10 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#C9A84C]" /></div>}
          {!carregando && !dados.length && <p className="flex h-full items-center justify-center text-sm text-[#7A8FA8]">Sem histórico para este período.</p>}
          {dados.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dados} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="mkArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={cor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#243A66" strokeOpacity={0.35} vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => fmtDataEixo(t, periodo)} stroke="#7A8FA8" fontSize={10} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis domain={["auto", "auto"]} stroke="#7A8FA8" fontSize={10} tickLine={false} axisLine={false} width={62}
                  tickFormatter={(v) => fmtNum(v, v >= 1000 ? 0 : 2)} />
                <Tooltip
                  contentStyle={{ background: "#09081A", border: "1px solid rgba(201,168,76,.4)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: COR.muted }} itemStyle={{ color: COR.cream }}
                  labelFormatter={(t) => new Date(Number(t) * 1000).toLocaleDateString("pt-BR")}
                  formatter={(v) => [fmtPreco(ativo, Number(v)), codigo]} />
                <Area type="monotone" dataKey="v" stroke={cor} strokeWidth={2} fill="url(#mkArea)" isAnimationActive animationDuration={700} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {cotacao && (
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              ["Fech. anterior", fmtPreco(ativo, cotacao.anterior)],
              ["Mínima do dia", fmtPreco(ativo, cotacao.minima)],
              ["Máxima do dia", fmtPreco(ativo, cotacao.maxima)],
              ["Volume", fmtCompacto(cotacao.volume)],
            ].map(([r, v]) => (
              <div key={r} className="rounded-xl border border-[#243A66]/60 bg-[#09081A]/40 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#7A8FA8]">{r}</p>
                <p className="mt-1 text-sm font-semibold tabular-nums text-[#F0ECE4]">{v}</p>
              </div>
            ))}
            <div className="col-span-2 rounded-xl border border-[#243A66]/60 bg-[#09081A]/40 px-3 py-3">
              <Faixa min={cotacao.minima} max={cotacao.maxima} atual={cotacao.preco} rotulo="Posição no dia" />
            </div>
            <div className="col-span-2 rounded-xl border border-[#243A66]/60 bg-[#09081A]/40 px-3 py-3">
              <Faixa min={cotacao.min52} max={cotacao.max52} atual={cotacao.preco} rotulo={`52 semanas · ${fmtPreco(ativo, cotacao.min52)} a ${fmtPreco(ativo, cotacao.max52)}`} />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-[#7A8FA8]/80">
            {cotacao?.horario ? `Último negócio: ${new Date(cotacao.horario * 1000).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}
            {simbolo.endsWith(".SA") || simbolo === "^BVSP" ? " · B3 com até 15 min de atraso" : ""}
          </p>
          {onComparar && (
            <button onClick={() => onComparar(simbolo)} className="inline-flex items-center gap-2 rounded-xl border border-[#C9A84C]/50 px-4 py-2 text-xs font-bold text-[#E8C97A] transition-colors hover:bg-[#C9A84C]/10">
              <GitCompareArrows className="h-4 w-4" /> Comparar com outros ativos
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
