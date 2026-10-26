"use client";

import React, { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Gauge, Search } from "lucide-react";
import { ATIVOS, type AtivoMercado, type Cotacao, type GrupoMercado, type IndicadoresResposta } from "@/lib/mercado/catalogo";
import { COR, Faixa, Secao, Sparkline, Variacao, classePisca, corVar, fmtCompacto, fmtNum, fmtPct, fmtPreco } from "@/components/mercado/ui";

type Mapa = Record<string, Cotacao>;
interface PropsBase { cot: Mapa; antes: Mapa; onAbrir: (s: string) => void }

const doGrupo = (g: GrupoMercado) => ATIVOS.filter((a) => a.grupo === g);

// ─── Card de cotação ─────────────────────────────────────────────────────────

export function CardCotacao({ ativo, c, antes, onAbrir, destaque = false }: { ativo: AtivoMercado; c?: Cotacao; antes?: Cotacao; onAbrir: (s: string) => void; destaque?: boolean }) {
  return (
    <button onClick={() => onAbrir(ativo.simbolo)}
      className={`mk-card group relative w-full overflow-hidden rounded-2xl border border-[#243A66]/70 text-left ${destaque ? "bg-gradient-to-br from-[#1a2d4f] via-[#162744] to-[#111F35] p-4" : "bg-[#111F35]/80 p-3.5"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`truncate font-bold text-[#F0ECE4] ${destaque ? "text-sm" : "text-[13px]"}`}>{ativo.codigo}</p>
          <p className="truncate text-[10.5px] text-[#7A8FA8]">{ativo.nome}</p>
        </div>
        <Variacao v={c?.variacao} tamanho="xs" fundo />
      </div>
      <p className={`mt-2 rounded-md font-bold tabular-nums text-[#F0ECE4] ${destaque ? "text-xl" : "text-base"} ${classePisca(c, antes)}`}>
        {c ? fmtPreco(ativo, c.preco) : <span className="inline-block h-5 w-24 animate-pulse rounded bg-[#243A66]/60" />}
      </p>
      <Sparkline pontos={c?.intraday ?? []} referencia={c?.anterior} largura={destaque ? 220 : 180} altura={destaque ? 46 : 32} className="mt-2 w-full" />
      {destaque && c && <div className="mt-2"><Faixa min={c.minima} max={c.maxima} atual={c.preco} /></div>}
    </button>
  );
}

// ─── Visão geral ─────────────────────────────────────────────────────────────

function Termometro({ cot }: { cot: Mapa }) {
  const acoes = doGrupo("acao").map((a) => cot[a.simbolo]).filter(Boolean);
  const sobe = acoes.filter((c) => (c.variacao ?? 0) > 0.005).length;
  const cai = acoes.filter((c) => (c.variacao ?? 0) < -0.005).length;
  const estavel = acoes.length - sobe - cai;
  const media = acoes.length ? acoes.reduce((s, c) => s + (c.variacao ?? 0), 0) / acoes.length : null;
  const humor = media == null ? "—" : media > 1 ? "Forte alta" : media > 0.2 ? "Alta" : media < -1 ? "Forte queda" : media < -0.2 ? "Queda" : "Lateral";
  return (
    <Secao titulo="Termômetro da B3" subtitulo={`${acoes.length} ações mais negociadas`} acao={<Gauge className="h-5 w-5 text-[#C9A84C]" />}>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-bold" style={{ color: corVar(media) }}>{humor}</p>
          <p className="text-xs text-[#7A8FA8]">Variação média: <span className="font-bold" style={{ color: corVar(media) }}>{fmtPct(media)}</span></p>
        </div>
        <div className="text-right text-xs text-[#7A8FA8]">
          <p><span className="font-bold text-[#34D399]">{sobe}</span> sobem · <span className="font-bold text-[#F87171]">{cai}</span> caem</p>
          {estavel > 0 && <p>{estavel} estáveis</p>}
        </div>
      </div>
      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-[#243A66]/50">
        <div className="h-full transition-all duration-700" style={{ width: `${(sobe / Math.max(1, acoes.length)) * 100}%`, background: COR.alta }} />
        <div className="h-full transition-all duration-700" style={{ width: `${(estavel / Math.max(1, acoes.length)) * 100}%`, background: COR.neutro }} />
        <div className="h-full transition-all duration-700" style={{ width: `${(cai / Math.max(1, acoes.length)) * 100}%`, background: COR.baixa }} />
      </div>
    </Secao>
  );
}

function AltasBaixas({ cot, onAbrir }: { cot: Mapa; onAbrir: (s: string) => void }) {
  const lista = doGrupo("acao").map((a) => ({ a, c: cot[a.simbolo] })).filter((x) => x.c?.variacao != null)
    .sort((x, y) => (y.c.variacao ?? 0) - (x.c.variacao ?? 0));
  const Bloco = ({ titulo, itens, alta }: { titulo: string; itens: typeof lista; alta: boolean }) => (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: alta ? COR.alta : COR.baixa }}>
        {alta ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{titulo}
      </p>
      <div className="space-y-1">
        {itens.map(({ a, c }) => {
          const larg = Math.min(100, (Math.abs(c.variacao ?? 0) / Math.max(0.01, Math.abs(itens[0].c.variacao ?? 1))) * 100);
          return (
            <button key={a.simbolo} onClick={() => onAbrir(a.simbolo)} className="relative flex w-full items-center justify-between overflow-hidden rounded-lg px-3 py-2 text-left hover:bg-[#162744]">
              <span className="absolute inset-y-0 left-0 opacity-15" style={{ width: `${larg}%`, background: alta ? COR.alta : COR.baixa }} />
              <span className="relative"><span className="text-sm font-bold text-[#F0ECE4]">{a.codigo}</span><span className="ml-2 text-[11px] text-[#7A8FA8]">{a.nome}</span></span>
              <span className="relative flex items-center gap-3"><span className="text-xs tabular-nums text-[#F0ECE4]">{fmtPreco(a, c.preco)}</span><Variacao v={c.variacao} tamanho="xs" /></span>
            </button>
          );
        })}
      </div>
    </div>
  );
  return (
    <Secao titulo="Destaques do dia" subtitulo="Entre as ações acompanhadas">
      <div className="grid gap-5 md:grid-cols-2">
        <Bloco titulo="Maiores altas" itens={lista.slice(0, 5)} alta />
        <Bloco titulo="Maiores baixas" itens={lista.slice(-5).reverse()} alta={false} />
      </div>
    </Secao>
  );
}

function corCalor(v: number | null | undefined) {
  if (v == null) return "rgba(36,58,102,.5)";
  const k = Math.min(1, Math.abs(v) / 4);
  return v >= 0 ? `rgba(52,211,153,${0.12 + k * 0.6})` : `rgba(248,113,113,${0.12 + k * 0.6})`;
}

function MapaCalor({ cot, antes, onAbrir }: PropsBase) {
  const setores = useMemo(() => {
    const m = new Map<string, AtivoMercado[]>();
    for (const a of doGrupo("acao")) m.set(a.setor!, [...(m.get(a.setor!) ?? []), a]);
    return [...m.entries()].map(([setor, ativos]) => {
      const vs = ativos.map((a) => cot[a.simbolo]?.variacao).filter((v): v is number => v != null);
      return { setor, ativos, media: vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null };
    }).sort((a, b) => (b.media ?? 0) - (a.media ?? 0));
  }, [cot]);
  return (
    <Secao titulo="Mapa de calor por setor" subtitulo="Cor mais forte = movimento maior. Toque numa ação para ver o gráfico.">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {setores.map(({ setor, ativos, media }) => (
          <div key={setor} className="rounded-xl border border-[#243A66]/60 bg-[#09081A]/40 p-2.5">
            <div className="mb-2 flex items-center justify-between px-0.5">
              <span className="truncate text-[11px] font-bold text-[#F0ECE4]">{setor}</span>
              <Variacao v={media} tamanho="xs" />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ativos.map((a) => {
                const c = cot[a.simbolo];
                return (
                  <button key={a.simbolo} onClick={() => onAbrir(a.simbolo)} title={`${a.nome} ${fmtPct(c?.variacao)}`}
                    className={`mk-tile relative rounded-lg px-1 py-2 text-center ${classePisca(c, antes[a.simbolo])}`} style={{ background: corCalor(c?.variacao) }}>
                    <p className="text-[11px] font-bold text-[#F0ECE4]">{a.codigo}</p>
                    <p className="text-[10px] font-semibold tabular-nums text-[#F0ECE4]/85">{fmtPct(c?.variacao)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Secao>
  );
}

function ListaCompacta({ titulo, grupo, cot, antes, onAbrir }: PropsBase & { titulo: string; grupo: GrupoMercado }) {
  return (
    <Secao titulo={titulo}>
      <div className="divide-y divide-[#243A66]/40">
        {doGrupo(grupo).map((a) => {
          const c = cot[a.simbolo];
          return (
            <button key={a.simbolo} onClick={() => onAbrir(a.simbolo)} className="flex w-full items-center gap-3 py-2 text-left hover:bg-[#162744]/50">
              <div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-[#F0ECE4]">{a.codigo}</p><p className="truncate text-[10.5px] text-[#7A8FA8]">{a.nome}</p></div>
              <Sparkline pontos={c?.intraday ?? []} referencia={c?.anterior} largura={70} altura={24} preenchido={false} className="hidden sm:block" />
              <div className="w-28 text-right">
                <p className={`rounded text-[13px] font-semibold tabular-nums text-[#F0ECE4] ${classePisca(c, antes[a.simbolo])}`}>{fmtPreco(a, c?.preco)}</p>
                <Variacao v={c?.variacao} tamanho="xs" />
              </div>
            </button>
          );
        })}
      </div>
    </Secao>
  );
}

export function VisaoGeral({ cot, antes, onAbrir, ind }: PropsBase & { ind: IndicadoresResposta | null }) {
  const pega = (id: string) => ind?.indicadores.find((i) => i.id === id);
  const focusIpca = ind?.focus.linhas.find((l) => l.indicador === "IPCA" && l.ano === String(new Date().getFullYear()));
  const macro = [
    { r: "Selic", v: pega("selic")?.valor, u: "% a.a." },
    { r: "CDI", v: pega("cdi")?.valor, u: "% a.a." },
    { r: "IPCA 12m", v: pega("ipca12")?.valor, u: "%" },
    { r: "Juro real", v: ind?.juroReal, u: "% a.a.", ouro: true },
    { r: "IGP-M 12m", v: pega("igpm")?.valor, u: "%" },
    { r: `Focus IPCA ${new Date().getFullYear()}`, v: focusIpca?.mediana, u: "%" },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {macro.map((m) => (
          <div key={m.r} className={`rounded-2xl border px-4 py-3 ${m.ouro ? "border-[#C9A84C]/50 bg-[#C9A84C]/[.07]" : "border-[#243A66]/70 bg-[#111F35]/70"}`}>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#7A8FA8]">{m.r}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${m.ouro ? "text-[#E8C97A]" : "text-[#F0ECE4]"}`}>
              {m.v == null ? <span className="inline-block h-5 w-16 animate-pulse rounded bg-[#243A66]/60" /> : <>{fmtNum(m.v, 2)}<span className="ml-1 text-[11px] font-normal text-[#7A8FA8]">{m.u}</span></>}
            </p>
          </div>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Termometro cot={cot} />
        <div className="lg:col-span-2"><AltasBaixas cot={cot} onAbrir={onAbrir} /></div>
      </div>
      <MapaCalor cot={cot} antes={antes} onAbrir={onAbrir} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ListaCompacta titulo="Moedas" grupo="moeda" cot={cot} antes={antes} onAbrir={onAbrir} />
        <ListaCompacta titulo="Commodities" grupo="commodity" cot={cot} antes={antes} onAbrir={onAbrir} />
      </div>
    </div>
  );
}

// ─── Ações B3 (tabela completa) ──────────────────────────────────────────────

type Coluna = "codigo" | "preco" | "variacao" | "volume" | "pos52";

export function AcoesB3({ cot, antes, onAbrir }: PropsBase) {
  const [busca, setBusca] = useState("");
  const [setor, setSetor] = useState("Todos");
  const [ordem, setOrdem] = useState<{ col: Coluna; desc: boolean }>({ col: "variacao", desc: true });
  const setores = ["Todos", ...new Set(doGrupo("acao").map((a) => a.setor!))];
  const linhas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const pos52 = (c?: Cotacao) => (c?.min52 != null && c.max52 != null && c.max52 > c.min52 ? (c.preco - c.min52) / (c.max52 - c.min52) : null);
    const val = (a: AtivoMercado) => {
      const c = cot[a.simbolo];
      return ordem.col === "codigo" ? a.codigo : ordem.col === "pos52" ? pos52(c) : ordem.col === "volume" ? (c?.volume ?? 0) * (c?.preco ?? 0) : c?.[ordem.col] ?? null;
    };
    return [...doGrupo("acao"), ...doGrupo("etf")]
      .filter((a) => (setor === "Todos" || a.setor === setor) && (!q || a.codigo.toLowerCase().includes(q) || a.nome.toLowerCase().includes(q)))
      .sort((x, y) => {
        const a = val(x), b = val(y);
        if (a == null) return 1; if (b == null) return -1;
        const r = typeof a === "string" ? a.localeCompare(String(b)) : a - Number(b);
        return ordem.desc ? -r : r;
      });
  }, [cot, busca, setor, ordem]);

  const Th = ({ col, children, className = "" }: { col: Coluna; children: React.ReactNode; className?: string }) => (
    <th className={`py-2.5 pr-3 ${className}`}>
      <button onClick={() => setOrdem((o) => ({ col, desc: o.col === col ? !o.desc : col !== "codigo" }))} className="inline-flex items-center gap-1 hover:text-[#E8C97A]">
        {children}{ordem.col === col && (ordem.desc ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <Secao titulo="Ações e ETFs da B3" subtitulo="Cotações com até 15 minutos de atraso. Clique no cabeçalho para ordenar e na linha para abrir o gráfico."
      acao={
        <div className="flex items-center gap-2 rounded-xl border border-[#243A66] bg-[#09081A]/60 px-3">
          <Search className="h-3.5 w-3.5 text-[#7A8FA8]" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Filtrar" className="w-32 bg-transparent py-2 text-xs text-[#F0ECE4] outline-none" />
        </div>
      }>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {setores.map((s) => (
          <button key={s} onClick={() => setSetor(s)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-all ${setor === s ? "bg-[#C9A84C] text-[#09081A]" : "border border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4]"}`}>{s}</button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-[#243A66] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#7A8FA8]">
              <Th col="codigo">Ativo</Th>
              <Th col="preco" className="text-right">Preço</Th>
              <Th col="variacao" className="text-right">Dia</Th>
              <th className="py-2.5 pr-3">Hoje</th>
              <th className="py-2.5 pr-3 w-32">Mín · Máx</th>
              <Th col="pos52">52 semanas</Th>
              <Th col="volume" className="text-right">Financeiro</Th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((a) => {
              const c = cot[a.simbolo];
              return (
                <tr key={a.simbolo} onClick={() => onAbrir(a.simbolo)} className="data-table-row cursor-pointer border-b border-[#243A66]/40">
                  <td className="py-2.5 pr-3"><p className="font-bold text-[#F0ECE4]">{a.codigo}</p><p className="text-[10.5px] text-[#7A8FA8]">{a.nome}{a.setor ? ` · ${a.setor}` : " · ETF"}</p></td>
                  <td className={`py-2.5 pr-3 text-right font-semibold tabular-nums text-[#F0ECE4] ${classePisca(c, antes[a.simbolo])}`}>{fmtPreco(a, c?.preco)}</td>
                  <td className="py-2.5 pr-3 text-right"><Variacao v={c?.variacao} tamanho="xs" fundo /></td>
                  <td className="py-2.5 pr-3"><Sparkline pontos={c?.intraday ?? []} referencia={c?.anterior} largura={96} altura={28} /></td>
                  <td className="py-2.5 pr-3">{c && <Faixa min={c.minima} max={c.maxima} atual={c.preco} />}</td>
                  <td className="py-2.5 pr-3 w-36">{c && <Faixa min={c.min52} max={c.max52} atual={c.preco} />}</td>
                  <td className="py-2.5 text-right text-xs tabular-nums text-[#7A8FA8]">{c?.volume ? `R$ ${fmtCompacto(c.volume * c.preco)}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!linhas.length && <p className="py-8 text-center text-sm text-[#7A8FA8]">Nenhuma ação com esse filtro.</p>}
      </div>
    </Secao>
  );
}

// ─── Mundo ───────────────────────────────────────────────────────────────────

export function Mundo({ cot, antes, onAbrir }: PropsBase) {
  const regioes = ["EUA", "Europa", "Ásia"];
  const Grade = ({ ativos }: { ativos: AtivoMercado[] }) => (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {ativos.map((a) => <CardCotacao key={a.simbolo} ativo={a} c={cot[a.simbolo]} antes={antes[a.simbolo]} onAbrir={onAbrir} />)}
    </div>
  );
  return (
    <div className="space-y-5">
      <Secao titulo="Bolsas pelo mundo" subtitulo="Índices globais quase em tempo real (cada um no horário do seu mercado).">
        <div className="space-y-5">
          {regioes.map((r) => (
            <div key={r}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#C9A84C]">{r}</p>
              <Grade ativos={doGrupo("indice_global").filter((a) => a.regiao === r)} />
            </div>
          ))}
        </div>
      </Secao>
      <Secao titulo="Moedas" subtitulo="Dólar, euro e principais pares contra o real."><Grade ativos={doGrupo("moeda")} /></Secao>
      <Secao titulo="Commodities" subtitulo="Energia, metais e agro (contratos futuros internacionais)."><Grade ativos={doGrupo("commodity")} /></Secao>
      <div className="grid gap-5 lg:grid-cols-2">
        <Secao titulo="Criptoativos" subtitulo="24 horas por dia, 7 dias por semana."><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{doGrupo("cripto").map((a) => <CardCotacao key={a.simbolo} ativo={a} c={cot[a.simbolo]} antes={antes[a.simbolo]} onAbrir={onAbrir} />)}</div></Secao>
        <Secao titulo="Juros dos EUA" subtitulo="Taxa dos títulos do Tesouro americano (% a.a.)."><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{doGrupo("juros_eua").map((a) => <CardCotacao key={a.simbolo} ativo={a} c={cot[a.simbolo]} antes={antes[a.simbolo]} onAbrir={onAbrir} />)}</div></Secao>
      </div>
    </div>
  );
}

// ─── Juros e inflação ────────────────────────────────────────────────────────

export function JurosInflacao({ ind, cot }: { ind: IndicadoresResposta | null; cot: Mapa }) {
  if (!ind) return <Secao titulo="Juros e inflação"><p className="py-8 text-center text-sm text-[#7A8FA8]">Carregando dados do Banco Central…</p></Secao>;
  const pega = (id: string) => ind.indicadores.find((i) => i.id === id)?.valor ?? null;
  const ano = new Date().getFullYear();
  const focus = (indicador: string, a: number) => ind.focus.linhas.find((l) => l.indicador === indicador && l.ano === String(a))?.mediana ?? null;
  const selic = pega("selic"), ipca = pega("ipca12"), selicFim = focus("Selic", ano), dolarFim = focus("Câmbio", ano);
  const dolar = cot["USDBRL=X"]?.preco ?? null;

  const leituras: string[] = [];
  if (ind.juroReal != null && selic != null && ipca != null)
    leituras.push(`Com Selic de ${fmtNum(selic, 2)}% e inflação de ${fmtNum(ipca, 2)}% em 12 meses, o juro real está em ${fmtNum(ind.juroReal, 2)}% ao ano: ${ind.juroReal > 6 ? "um dos patamares mais altos do mundo, a renda fixa paga muito acima da inflação e o crédito fica caro" : ind.juroReal > 3 ? "renda fixa ainda paga bem acima da inflação" : "juro real baixo, o que favorece crédito e bolsa"}.`);
  if (selic != null && selicFim != null)
    leituras.push(Math.abs(selicFim - selic) < 0.13
      ? `O Focus espera a Selic estável em ${fmtNum(selicFim, 2)}% até o fim de ${ano}.`
      : `O Focus projeta Selic de ${fmtNum(selicFim, 2)}% no fim de ${ano}: ${selicFim < selic ? "corte" : "alta"} de ${fmtNum(Math.abs(selic - selicFim), 2)} p.p. em relação a hoje.`);
  if (dolar != null && dolarFim != null)
    leituras.push(`O dólar está em R$ ${fmtNum(dolar, 2)}, ${dolar > dolarFim ? "acima" : "abaixo"} dos R$ ${fmtNum(dolarFim, 2)} que o mercado espera para o fim do ano (${fmtPct((dolar / dolarFim - 1) * 100)}).`);

  return (
    <div className="space-y-5">
      {leituras.length > 0 && (
        <section className="relative overflow-hidden rounded-2xl border border-[#C9A84C]/40 bg-gradient-to-br from-[#C9A84C]/[.10] via-[#111F35] to-[#09081A] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#C9A84C]">Leitura rápida</p>
          <ul className="mt-3 space-y-2">
            {leituras.map((l) => <li key={l} className="flex gap-2 text-sm leading-relaxed text-[#F0ECE4]"><span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-[#E8C97A]" />{l}</li>)}
          </ul>
        </section>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {ind.indicadores.map((i) => (
          <div key={i.id} className="mk-card rounded-2xl border border-[#243A66]/70 bg-[#111F35]/80 p-4">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#C9A84C]">{i.rotulo}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#F0ECE4]">{i.valor == null ? "—" : fmtNum(i.valor, 2)}<span className="ml-1 text-xs font-normal text-[#7A8FA8]">{i.unidade}</span></p>
            <p className="mt-1 text-[10.5px] leading-snug text-[#7A8FA8]">{i.descricao}</p>
            {i.referencia && <p className="mt-2 text-[10px] text-[#7A8FA8]/70">Ref.: {i.referencia}</p>}
          </div>
        ))}
        <div className="mk-card rounded-2xl border border-[#C9A84C]/50 bg-[#C9A84C]/[.07] p-4">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-[#E8C97A]">Juro real</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-[#E8C97A]">{fmtNum(ind.juroReal, 2)}<span className="ml-1 text-xs font-normal text-[#7A8FA8]">% a.a.</span></p>
          <p className="mt-1 text-[10.5px] leading-snug text-[#7A8FA8]">Selic descontada do IPCA 12 meses</p>
        </div>
      </div>
      <Secao titulo="Boletim Focus" subtitulo={`Mediana das projeções do mercado coletadas pelo Banco Central${ind.focus.data ? ` · ${new Date(`${ind.focus.data}T12:00:00`).toLocaleDateString("pt-BR")}` : ""}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-[#243A66] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#7A8FA8]">
                <th className="py-2.5 pr-3">Indicador</th>{[ano, ano + 1, ano + 2].map((a) => <th key={a} className="py-2.5 pr-3 text-right">{a}</th>)}
              </tr>
            </thead>
            <tbody>
              {[["IPCA", "IPCA (%)"], ["Selic", "Selic fim de ano (%)"], ["PIB Total", "PIB (%)"], ["Câmbio", "Dólar fim de ano (R$)"]].map(([k, r]) => (
                <tr key={k} className="border-b border-[#243A66]/40">
                  <td className="py-3 pr-3 font-semibold text-[#F0ECE4]">{r}</td>
                  {[ano, ano + 1, ano + 2].map((a) => <td key={a} className="py-3 pr-3 text-right tabular-nums text-[#F0ECE4]">{fmtNum(focus(k, a), 2)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
    </div>
  );
}
