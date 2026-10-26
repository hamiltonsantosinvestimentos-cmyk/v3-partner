"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Activity, BarChart3, Globe2, GitCompareArrows, Landmark, LayoutGrid, RefreshCw, Search } from "lucide-react";
import { ATIVOS, ATIVO_POR_SIMBOLO, normalizarSimbolo, type Cotacao, type CotacoesResposta, type IndicadoresResposta } from "@/lib/mercado/catalogo";
import { MERCADO_CSS, Variacao, fmtPreco } from "@/components/mercado/ui";
import { AcoesB3, CardCotacao, JurosInflacao, Mundo, VisaoGeral } from "@/components/mercado/paineis";
import { Comparativo } from "@/components/mercado/comparativo";
import { AtivoModal } from "@/components/mercado/ativo-modal";

// Aba Mercado (26/10/2026): B3 (~15 min de atraso), bolsas globais, moedas, commodities, cripto,
// juros e inflação (Banco Central + Focus) e comparativo de rentabilidade. Cotações a cada 20 s.

const INTERVALO_S = 20;
const DESTAQUES = ["^BVSP", "USDBRL=X", "^GSPC", "BTC-USD", "BZ=F", "GC=F"];
const FITA = ["^BVSP", "SMLL.SA", "IFIX.SA", "USDBRL=X", "EURBRL=X", "PETR4.SA", "VALE3.SA", "ITUB4.SA", "BBAS3.SA", "WEGE3.SA", "^GSPC", "^IXIC", "^DJI", "^GDAXI", "^N225", "BZ=F", "GC=F", "ZS=F", "KC=F", "BTC-USD", "ETH-USD", "^TNX"];

const ABAS = [
  { id: "geral", t: "Visão geral", i: LayoutGrid },
  { id: "acoes", t: "Ações B3", i: BarChart3 },
  { id: "mundo", t: "Mundo", i: Globe2 },
  { id: "comparativo", t: "Comparativo", i: GitCompareArrows },
  { id: "juros", t: "Juros e inflação", i: Landmark },
] as const;
type Aba = (typeof ABAS)[number]["id"];

function Relogio() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!agora) return null;
  return <span className="tabular-nums">{agora.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>;
}

export function MercadoClient() {
  const [dados, setDados] = useState<CotacoesResposta | null>(null);
  const [antes, setAntes] = useState<Record<string, Cotacao>>({});
  const [ind, setInd] = useState<IndicadoresResposta | null>(null);
  const [erro, setErro] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [restante, setRestante] = useState(INTERVALO_S);
  const [aba, setAba] = useState<Aba>("geral");
  const [aberto, setAberto] = useState<string | null>(null);
  const [comparar, setComparar] = useState<string[] | undefined>();
  const [busca, setBusca] = useState("");
  const atual = useRef<CotacoesResposta | null>(null);

  const carregar = useCallback(async () => {
    setAtualizando(true);
    try {
      const r = await fetch("/api/mercado/cotacoes", { cache: "no-store" });
      if (!r.ok) throw new Error();
      const j: CotacoesResposta = await r.json();
      setAntes(atual.current?.cotacoes ?? {});
      atual.current = j;
      setDados(j);
      setErro(false);
    } catch {
      setErro(true);
    } finally {
      setAtualizando(false);
      setRestante(INTERVALO_S);
    }
  }, []);

  const carregarIndicadores = useCallback(() => {
    fetch("/api/mercado/indicadores").then((r) => (r.ok ? r.json() : null)).then((j) => j && setInd(j)).catch(() => {});
  }, []);

  useEffect(() => {
    carregar();
    carregarIndicadores();
    const t = setInterval(carregarIndicadores, 30 * 60_000);
    return () => clearInterval(t);
  }, [carregar, carregarIndicadores]);

  // Contagem regressiva; pausa com a aba do navegador escondida.
  useEffect(() => {
    const t = setInterval(() => {
      if (document.hidden) return;
      setRestante((s) => {
        if (s <= 1) { carregar(); return INTERVALO_S; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [carregar]);

  const cot = dados?.cotacoes ?? {};
  const abrirComparativo = (s: string) => {
    setAberto(null);
    setComparar([...new Set([s, s.endsWith(".SA") ? "^BVSP" : "USDBRL=X", "CDI"])]);
    setAba("comparativo");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const buscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (busca.trim()) { setAberto(normalizarSimbolo(busca)); setBusca(""); }
  };
  const fita = FITA.map((s) => ({ a: ATIVO_POR_SIMBOLO.get(s)!, c: cot[s] })).filter((x) => x.a && x.c);

  return (
    <div className="v3-page-in space-y-5">
      <style>{MERCADO_CSS}</style>

      {/* Cabeçalho */}
      <div className="relative overflow-hidden rounded-3xl border border-[#243A66]/70 bg-gradient-to-br from-[#162744] via-[#111F35] to-[#09081A] p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#C9A84C]/10 blur-3xl" />
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C9A84C]/70 to-transparent" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#C9A84C]">Mercado</p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-bold text-[#F0ECE4]">Mercado ao vivo</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#7A8FA8]">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-bold ${dados?.pregaoAberto ? "border-[#34D399]/40 text-[#34D399]" : "border-[#243A66] text-[#7A8FA8]"}`}>
                <span className={`h-2 w-2 rounded-full ${dados?.pregaoAberto ? "mk-pulso bg-[#34D399]" : "bg-[#7A8FA8]"}`} />
                {dados ? (dados.pregaoAberto ? "Pregão B3 aberto" : "Pregão B3 fechado") : "Conectando…"}
              </span>
              <span className="inline-flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-[#C9A84C]" /> Brasília <Relogio /></span>
              {dados && <span>Atualizado {new Date(dados.atualizadoEm).toLocaleTimeString("pt-BR")}</span>}
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <form onSubmit={buscar} className="flex flex-1 items-center gap-2 rounded-xl border border-[#243A66] bg-[#09081A]/70 px-3 focus-within:border-[#C9A84C]/60 sm:flex-none">
              <Search className="h-4 w-4 text-[#7A8FA8]" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ativo: PETR4, AAPL, BTC-USD…"
                className="w-full bg-transparent py-2.5 text-sm text-[#F0ECE4] outline-none placeholder:text-[#7A8FA8]/70 sm:w-64" />
            </form>
            <button onClick={carregar} title="Atualizar agora"
              className="inline-flex items-center gap-2 rounded-xl border border-[#C9A84C]/40 px-3 py-2.5 text-xs font-bold text-[#E8C97A] transition-colors hover:bg-[#C9A84C]/10">
              <RefreshCw className={`h-3.5 w-3.5 ${atualizando ? "animate-spin" : ""}`} />
              <span className="tabular-nums">{restante}s</span>
            </button>
          </div>
        </div>
        <p className="relative mt-4 text-[11px] text-[#7A8FA8]/80">
          Ações da B3 com até 15 min de atraso · moedas, cripto e bolsas globais quase em tempo real · juros e inflação do Banco Central. Fontes: Yahoo Finance e Banco Central do Brasil. Não é recomendação de investimento.
        </p>
      </div>

      {erro && !dados && (
        <div className="rounded-2xl border border-[#F87171]/30 bg-[#F87171]/5 px-4 py-3 text-sm text-[#F87171]">Não foi possível carregar as cotações agora. Tentando de novo em {restante}s.</div>
      )}

      {/* Fita */}
      {fita.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-[#243A66]/60 bg-[#09081A]">
          <div className="mk-fita flex w-max items-center py-2.5">
            {[...fita, ...fita].map(({ a, c }, i) => (
              <button key={i} onClick={() => setAberto(a.simbolo)} className="flex shrink-0 items-center gap-2 px-4 text-xs">
                <span className="font-bold uppercase tracking-wider text-[#7A8FA8]">{a.codigo}</span>
                <span className="font-semibold tabular-nums text-[#F0ECE4]">{fmtPreco(a, c.preco)}</span>
                <Variacao v={c.variacao} tamanho="xs" />
                <span className="ml-2 text-[#243A66]">│</span>
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#09081A] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#09081A] to-transparent" />
        </div>
      )}

      {/* Destaques */}
      <div className="v3-stagger grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {DESTAQUES.map((s) => <CardCotacao key={s} ativo={ATIVO_POR_SIMBOLO.get(s)!} c={cot[s]} antes={antes[s]} onAbrir={setAberto} destaque />)}
      </div>

      {/* Abas */}
      <div className="sticky top-0 z-20 -mx-1 overflow-x-auto bg-[#09081A]/85 px-1 py-2 backdrop-blur-md">
        <div className="inline-flex gap-1 rounded-2xl border border-[#243A66]/70 bg-[#111F35]/80 p-1">
          {ABAS.map(({ id, t, i: Icone }) => (
            <button key={id} onClick={() => setAba(id)}
              className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-bold transition-all ${aba === id ? "bg-gradient-to-br from-[#E8C97A] to-[#C9A84C] text-[#09081A] shadow-[0_8px_24px_-10px_rgba(201,168,76,.8)]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}>
              <Icone className="h-3.5 w-3.5" />{t}
            </button>
          ))}
        </div>
      </div>

      <div key={aba} className="v3-page-in">
        {aba === "geral" && <VisaoGeral cot={cot} antes={antes} onAbrir={setAberto} ind={ind} />}
        {aba === "acoes" && <AcoesB3 cot={cot} antes={antes} onAbrir={setAberto} />}
        {aba === "mundo" && <Mundo cot={cot} antes={antes} onAbrir={setAberto} />}
        {aba === "comparativo" && <Comparativo iniciais={comparar} onAbrirAtivo={setAberto} />}
        {aba === "juros" && <JurosInflacao ind={ind} cot={cot} />}
      </div>

      <p className="pb-4 text-center text-[10.5px] text-[#7A8FA8]/60">{ATIVOS.length} ativos acompanhados · atualização automática a cada {INTERVALO_S} segundos</p>

      {aberto && (
        <AtivoModal simbolo={aberto} cotacao={cot[aberto]} onFechar={() => setAberto(null)} onComparar={abrirComparativo} />
      )}
    </div>
  );
}
