"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Plus, X } from "lucide-react";
import { ATIVOS, ATIVO_POR_SIMBOLO, normalizarSimbolo, SERIES_BCB, type PeriodoHistorico, type SerieHistorica } from "@/lib/mercado/catalogo";
import { COR, Secao, corVar, fmtNum, fmtPct } from "@/components/mercado/ui";
import { PERIODOS, fmtDataEixo } from "@/components/mercado/ativo-modal";

const CORES_LINHA = ["#C9A84C", "#F0ECE4", "#8FA8C8", "#B69CFF", "#E8A87C", "#6FD3C9"];

const PRESETS: { t: string; s: string[] }[] = [
  { t: "Ibovespa × CDI × Dólar", s: ["^BVSP", "CDI", "USDBRL=X"] },
  { t: "Renda fixa × inflação", s: ["CDI", "IPCA", "IFIX.SA"] },
  { t: "Brasil × EUA", s: ["^BVSP", "^GSPC", "IVVB11.SA"] },
  { t: "Proteção", s: ["GC=F", "BTC-USD", "USDBRL=X", "CDI"] },
  { t: "Petrobras × Brent", s: ["PETR4.SA", "BZ=F", "PRIO3.SA"] },
  { t: "Bancões", s: ["ITUB4.SA", "BBDC4.SA", "BBAS3.SA", "SANB11.SA", "BPAC11.SA"] },
];

export const rotuloSerie = (s: string) =>
  s === "CDI" ? "CDI" : s === "IPCA" ? "IPCA" : ATIVO_POR_SIMBOLO.get(s)?.codigo ?? s.replace(/\.SA$/, "");

interface Estatistica { simbolo: string; rent: number | null; vol: number | null; quedaMax: number | null; maior: number | null }

function estatisticas(s: SerieHistorica, periodo: PeriodoHistorico): Estatistica {
  const v = s.pontos.map((p) => p.v);
  if (v.length < 2) return { simbolo: s.simbolo, rent: null, vol: null, quedaMax: null, maior: null };
  const rent = (v[v.length - 1] / v[0] - 1) * 100;
  const rets = v.slice(1).map((x, i) => Math.log(x / v[i]));
  const media = rets.reduce((a, b) => a + b, 0) / rets.length;
  const dp = Math.sqrt(rets.reduce((a, b) => a + (b - media) ** 2, 0) / Math.max(1, rets.length - 1));
  const anual = s.simbolo === "IPCA" ? null : dp * Math.sqrt(periodo === "5y" ? 52 : 252) * 100;
  let pico = v[0], quedaMax = 0, maior = v[0];
  for (const x of v) { pico = Math.max(pico, x); maior = Math.max(maior, x); quedaMax = Math.min(quedaMax, (x / pico - 1) * 100); }
  return { simbolo: s.simbolo, rent, vol: anual, quedaMax, maior };
}

export function Comparativo({ iniciais, onAbrirAtivo }: { iniciais?: string[]; onAbrirAtivo: (s: string) => void }) {
  const [selecionados, setSelecionados] = useState<string[]>(iniciais?.length ? iniciais : PRESETS[0].s);
  const [periodo, setPeriodo] = useState<PeriodoHistorico>("1y");
  const [series, setSeries] = useState<SerieHistorica[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [abrirLista, setAbrirLista] = useState(false);

  useEffect(() => { if (iniciais?.length) setSelecionados(iniciais); }, [iniciais]);

  useEffect(() => {
    if (!selecionados.length) { setSeries([]); return; }
    let vivo = true;
    setCarregando(true);
    fetch(`/api/mercado/historico?simbolos=${encodeURIComponent(selecionados.join(","))}&periodo=${periodo}`)
      .then((r) => r.json())
      .then((j) => { if (vivo) setSeries(j.series ?? []); })
      .catch(() => { if (vivo) setSeries([]); })
      .finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [selecionados, periodo]);

  // Linha do tempo única (por dia), carregando o último valor de cada série; tudo em base 100.
  const dados = useMemo(() => {
    const dia = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
    const mapas = series.filter((s) => s.pontos.length > 1).map((s) => {
      const m = new Map<string, number>();
      for (const p of s.pontos) m.set(dia(p.t), p.v);
      return { simbolo: s.simbolo, m, base: s.pontos[0].v };
    });
    const dias = [...new Set(mapas.flatMap((x) => [...x.m.keys()]))].sort();
    const ultimo: Record<string, number | undefined> = {};
    return dias.map((d) => {
      const linha: Record<string, number | string> = { d, t: Date.parse(`${d}T12:00:00Z`) / 1000 };
      for (const x of mapas) {
        const v = x.m.get(d);
        if (v != null) ultimo[x.simbolo] = (v / x.base) * 100;
        if (ultimo[x.simbolo] != null) linha[x.simbolo] = ultimo[x.simbolo]!;
      }
      return linha;
    });
  }, [series]);

  const stats = useMemo(() => series.map((s) => estatisticas(s, periodo)), [series, periodo]);
  const rentCdi = stats.find((s) => s.simbolo === "CDI")?.rent ?? null;
  const ranking = [...stats].sort((a, b) => (b.rent ?? -1e9) - (a.rent ?? -1e9));

  const adicionar = (s: string) => {
    const sim = s in SERIES_BCB ? s : normalizarSimbolo(s);
    if (!sim || selecionados.includes(sim) || selecionados.length >= 6) return;
    setSelecionados([...selecionados, sim]);
    setBusca(""); setAbrirLista(false);
  };
  const opcoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = [{ simbolo: "CDI", codigo: "CDI", nome: "CDI acumulado (Banco Central)" }, { simbolo: "IPCA", codigo: "IPCA", nome: "Inflação acumulada (IBGE)" }, ...ATIVOS];
    return base.filter((a) => !selecionados.includes(a.simbolo) && (!q || a.codigo.toLowerCase().includes(q) || a.nome.toLowerCase().includes(q))).slice(0, 12);
  }, [busca, selecionados]);

  return (
    <div className="space-y-5">
      <Secao titulo="Comparativo de rentabilidade" subtitulo="Tudo em base 100 no início do período: dá para comparar ação, índice, moeda, cripto, CDI e inflação na mesma régua.">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.t} onClick={() => setSelecionados(p.s)}
              className="rounded-full border border-[#243A66] px-3 py-1.5 text-[11px] font-semibold text-[#7A8FA8] transition-all hover:border-[#C9A84C]/60 hover:text-[#E8C97A]">
              {p.t}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {selecionados.map((s, i) => (
            <span key={s} className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold" style={{ borderColor: `${CORES_LINHA[i]}66`, color: CORES_LINHA[i], background: `${CORES_LINHA[i]}12` }}>
              <span className="h-2 w-2 rounded-full" style={{ background: CORES_LINHA[i] }} />
              {rotuloSerie(s)}
              <button onClick={() => setSelecionados(selecionados.filter((x) => x !== s))} aria-label={`Remover ${rotuloSerie(s)}`} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
            </span>
          ))}
          {selecionados.length < 6 && (
            <div className="relative">
              <div className="flex items-center gap-1 rounded-xl border border-dashed border-[#C9A84C]/50 px-2">
                <Plus className="h-3.5 w-3.5 text-[#C9A84C]" />
                <input value={busca} onChange={(e) => { setBusca(e.target.value); setAbrirLista(true); }} onFocus={() => setAbrirLista(true)}
                  onBlur={() => setTimeout(() => setAbrirLista(false), 150)}
                  onKeyDown={(e) => { if (e.key === "Enter" && busca.trim()) adicionar(opcoes[0]?.simbolo ?? busca); }}
                  placeholder="Adicionar ativo (PETR4, Ouro, CDI…)" className="w-56 bg-transparent py-1.5 text-xs text-[#F0ECE4] outline-none placeholder:text-[#7A8FA8]/70" />
              </div>
              {abrirLista && (
                <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-xl border border-[#243A66] bg-[#09081A] p-1 shadow-2xl">
                  {opcoes.map((o) => (
                    <button key={o.simbolo} onMouseDown={(e) => e.preventDefault()} onClick={() => adicionar(o.simbolo)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs hover:bg-[#162744]">
                      <span className="font-bold text-[#F0ECE4]">{o.codigo}</span><span className="truncate text-[#7A8FA8]">{o.nome}</span>
                    </button>
                  ))}
                  {busca.trim() && <button onMouseDown={(e) => e.preventDefault()} onClick={() => adicionar(busca)} className="w-full rounded-lg px-3 py-2 text-left text-xs text-[#E8C97A] hover:bg-[#162744]">Buscar &quot;{busca.toUpperCase()}&quot; em qualquer bolsa</button>}
                </div>
              )}
            </div>
          )}
          <div className="ml-auto inline-flex rounded-xl border border-[#243A66] bg-[#09081A]/60 p-1">
            {PERIODOS.map((p) => (
              <button key={p.v} onClick={() => setPeriodo(p.v)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${periodo === p.v ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}>{p.t}</button>
            ))}
          </div>
        </div>

        <div className="relative mt-5 h-[380px] rounded-2xl border border-[#243A66]/60 bg-[#09081A]/50 p-2">
          {carregando && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#09081A]/40"><Loader2 className="h-6 w-6 animate-spin text-[#C9A84C]" /></div>}
          {!dados.length && !carregando && <p className="flex h-full items-center justify-center text-sm text-[#7A8FA8]">Escolha ao menos um ativo.</p>}
          {dados.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#243A66" strokeOpacity={0.35} vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => fmtDataEixo(t, periodo)} stroke="#7A8FA8" fontSize={10} tickLine={false} axisLine={false} minTickGap={48} />
                <YAxis domain={["auto", "auto"]} stroke="#7A8FA8" fontSize={10} tickLine={false} axisLine={false} width={44} tickFormatter={(v) => fmtNum(v, 0)} />
                <ReferenceLine y={100} stroke="#7A8FA8" strokeOpacity={0.5} strokeDasharray="3 4" />
                <Tooltip
                  contentStyle={{ background: "#09081A", border: "1px solid rgba(201,168,76,.4)", borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: COR.muted, marginBottom: 4 }}
                  labelFormatter={(t) => new Date(Number(t) * 1000).toLocaleDateString("pt-BR")}
                  formatter={(v, nome) => [`${fmtPct(Number(v) - 100)}  (${fmtNum(Number(v), 1)})`, rotuloSerie(String(nome))]}
                  itemSorter={(i) => -Number(i.value)} />
                <Legend formatter={(v) => <span className="text-xs text-[#F0ECE4]">{rotuloSerie(String(v))}</span>} />
                {selecionados.map((s, i) => (
                  <Line key={s} type="monotone" dataKey={s} stroke={CORES_LINHA[i]} strokeWidth={s === "CDI" || s === "IPCA" ? 1.8 : 2.2}
                    strokeDasharray={s === "CDI" || s === "IPCA" ? "5 4" : undefined} dot={false} connectNulls isAnimationActive animationDuration={800} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Secao>

      {ranking.length > 0 && (
        <Secao titulo="Ranking do período" subtitulo="Volatilidade anualizada e queda máxima (do pico ao fundo) dentro do período escolhido.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[#243A66] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#7A8FA8]">
                  <th className="py-2 pr-3">#</th><th className="py-2 pr-3">Ativo</th><th className="py-2 pr-3 text-right">Rentabilidade</th>
                  <th className="py-2 pr-3 text-right">vs CDI</th><th className="py-2 pr-3 text-right">Volatilidade a.a.</th><th className="py-2 text-right">Queda máxima</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((s, i) => {
                  const idx = selecionados.indexOf(s.simbolo);
                  const bcb = s.simbolo in SERIES_BCB;
                  return (
                    <tr key={s.simbolo} onClick={() => !bcb && onAbrirAtivo(s.simbolo)} className={`data-table-row border-b border-[#243A66]/40 ${bcb ? "" : "cursor-pointer"}`}>
                      <td className="py-2.5 pr-3 text-xs font-bold text-[#C9A84C]">{i + 1}º</td>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-2 font-semibold text-[#F0ECE4]"><span className="h-2 w-2 rounded-full" style={{ background: CORES_LINHA[idx] ?? COR.muted }} />{rotuloSerie(s.simbolo)}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold tabular-nums" style={{ color: corVar(s.rent) }}>{fmtPct(s.rent)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums" style={{ color: rentCdi == null || s.simbolo === "CDI" ? COR.muted : corVar((s.rent ?? 0) - rentCdi) }}>
                        {rentCdi == null || s.simbolo === "CDI" || s.rent == null ? "—" : `${(s.rent - rentCdi) > 0 ? "+" : ""}${fmtNum(s.rent - rentCdi, 2)} p.p.`}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-[#F0ECE4]">{s.vol == null ? "—" : `${fmtNum(s.vol, 1)}%`}</td>
                      <td className="py-2.5 text-right tabular-nums" style={{ color: s.quedaMax ? COR.baixa : COR.muted }}>{s.quedaMax == null ? "—" : fmtPct(s.quedaMax)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rentCdi == null && <p className="mt-3 text-[11px] text-[#7A8FA8]">Inclua o CDI no comparativo para ver quanto cada ativo ganhou ou perdeu para a renda fixa.</p>}
        </Secao>
      )}
    </div>
  );
}
