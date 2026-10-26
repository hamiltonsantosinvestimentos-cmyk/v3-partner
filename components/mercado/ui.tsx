"use client";

import React, { useId } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { AtivoMercado, Cotacao } from "@/lib/mercado/catalogo";

// Peças visuais da aba Mercado. Alta/baixa seguem o mesmo emerald/red do ticker do Dashboard.

export const COR = {
  alta: "#34D399",
  baixa: "#F87171",
  neutro: "#7A8FA8",
  ouro: "#C9A84C",
  ouroClaro: "#E8C97A",
  cream: "#F0ECE4",
  muted: "#7A8FA8",
};

export const corVar = (v: number | null | undefined) => (v == null || Math.abs(v) < 0.005 ? COR.neutro : v > 0 ? COR.alta : COR.baixa);

export function fmtNum(v: number | null | undefined, casas = 2) {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function casasPreco(a: Pick<AtivoMercado, "unidade" | "grupo"> | undefined, preco: number) {
  if (a?.unidade === "pts") return preco >= 1000 ? 0 : 2;
  if (preco < 0.1) return 4;
  return 2;
}

export function fmtPreco(a: AtivoMercado | undefined, preco: number | null | undefined) {
  if (preco == null) return "—";
  const n = fmtNum(preco, casasPreco(a, preco));
  switch (a?.unidade) {
    case "BRL": return `R$ ${n}`;
    case "USD": return `US$ ${n}`;
    case "USc": return `${n} US¢`;
    case "%": return `${n}%`;
    default: return n;
  }
}

export function fmtPct(v: number | null | undefined, sinal = true) {
  if (v == null || !Number.isFinite(v)) return "—";
  const s = sinal && v > 0 ? "+" : "";
  return `${s}${fmtNum(v, 2)}%`;
}

export function fmtCompacto(v: number | null | undefined) {
  if (v == null || !v) return "—";
  if (v >= 1e9) return `${fmtNum(v / 1e9, 1)} bi`;
  if (v >= 1e6) return `${fmtNum(v / 1e6, 1)} mi`;
  if (v >= 1e3) return `${fmtNum(v / 1e3, 1)} mil`;
  return fmtNum(v, 0);
}

export function Variacao({ v, tamanho = "sm", fundo = false }: { v: number | null | undefined; tamanho?: "xs" | "sm" | "md" | "lg"; fundo?: boolean }) {
  const cor = corVar(v);
  const Icone = v == null || Math.abs(v) < 0.005 ? Minus : v > 0 ? TrendingUp : TrendingDown;
  const txt = { xs: "text-[10px]", sm: "text-xs", md: "text-sm", lg: "text-base" }[tamanho];
  const ic = { xs: "w-2.5 h-2.5", sm: "w-3 h-3", md: "w-3.5 h-3.5", lg: "w-4 h-4" }[tamanho];
  return (
    <span className={`inline-flex items-center gap-1 font-bold tabular-nums ${txt} ${fundo ? "rounded-md px-1.5 py-0.5" : ""}`}
      style={{ color: cor, background: fundo ? `${cor}1A` : undefined }}>
      <Icone className={ic} />{fmtPct(v)}
    </span>
  );
}

/** Mini-gráfico em SVG puro (leve o bastante para dezenas na mesma tela). */
export function Sparkline({ pontos, referencia, largura = 120, altura = 36, cor, preenchido = true, className }: {
  pontos: number[]; referencia?: number | null; largura?: number; altura?: number; cor?: string; preenchido?: boolean; className?: string;
}) {
  const id = useId().replace(/:/g, "");
  if (pontos.length < 2) return <div style={{ width: largura, height: altura }} className={className} />;
  const vals = referencia != null ? [...pontos, referencia] : pontos;
  const min = Math.min(...vals), max = Math.max(...vals);
  const amp = max - min || 1;
  const x = (i: number) => (i / (pontos.length - 1)) * largura;
  const y = (v: number) => altura - 2 - ((v - min) / amp) * (altura - 4);
  const d = pontos.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const c = cor ?? (referencia != null ? corVar(pontos[pontos.length - 1] - referencia) : corVar(pontos[pontos.length - 1] - pontos[0]));
  return (
    <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity={0.28} />
          <stop offset="100%" stopColor={c} stopOpacity={0} />
        </linearGradient>
      </defs>
      {referencia != null && (
        <line x1={0} x2={largura} y1={y(referencia)} y2={y(referencia)} stroke={COR.muted} strokeOpacity={0.35} strokeDasharray="2 3" strokeWidth={1} />
      )}
      {preenchido && <path d={`${d} L${largura},${altura} L0,${altura} Z`} fill={`url(#g${id})`} />}
      <path d={d} fill="none" stroke={c} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(pontos.length - 1)} cy={y(pontos[pontos.length - 1])} r={2.2} fill={c} />
    </svg>
  );
}

/** Onde o preço está entre a mínima e a máxima (do dia ou de 52 semanas). */
export function Faixa({ min, max, atual, rotulo }: { min: number | null; max: number | null; atual: number; rotulo?: string }) {
  if (min == null || max == null || max <= min) return <div className="h-1" />;
  const pos = Math.min(100, Math.max(0, ((atual - min) / (max - min)) * 100));
  return (
    <div className="w-full">
      {rotulo && <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#7A8FA8]/70">{rotulo}</p>}
      <div className="relative h-1 rounded-full bg-[#243A66]/60">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pos}%`, background: "linear-gradient(90deg, rgba(201,168,76,.15), rgba(201,168,76,.7))" }} />
        <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#09081A] bg-[#E8C97A] shadow-[0_0_8px_rgba(232,201,122,.6)]" style={{ left: `${pos}%` }} />
      </div>
    </div>
  );
}

/** Classe de "piscada" quando o preço muda entre duas atualizações. */
export function classePisca(atual?: Cotacao, anterior?: Cotacao) {
  if (!atual || !anterior || atual.preco === anterior.preco) return "";
  return atual.preco > anterior.preco ? "mk-pisca-alta" : "mk-pisca-baixa";
}

export function Secao({ titulo, subtitulo, acao, children, className = "" }: {
  titulo: string; subtitulo?: string; acao?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-[#243A66]/70 bg-[#111F35]/70 p-4 sm:p-5 backdrop-blur-sm ${className}`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-[#F0ECE4]">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-xs text-[#7A8FA8]">{subtitulo}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

export const MERCADO_CSS = `
@keyframes mkPiscaAlta { 0% { background-color: rgba(52,211,153,.22); } 100% { background-color: transparent; } }
@keyframes mkPiscaBaixa { 0% { background-color: rgba(248,113,113,.22); } 100% { background-color: transparent; } }
.mk-pisca-alta { animation: mkPiscaAlta 1.4s ease-out; }
.mk-pisca-baixa { animation: mkPiscaBaixa 1.4s ease-out; }
@keyframes mkPulso { 0% { box-shadow: 0 0 0 0 rgba(52,211,153,.55); } 70% { box-shadow: 0 0 0 7px rgba(52,211,153,0); } 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0); } }
.mk-pulso { animation: mkPulso 1.8s infinite; }
@keyframes mkFita { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.mk-fita { animation: mkFita 90s linear infinite; }
.mk-fita:hover { animation-play-state: paused; }
.mk-card { transition: transform .4s cubic-bezier(.22,1.2,.36,1), border-color .3s, box-shadow .4s; }
.mk-card:hover { transform: translateY(-3px); border-color: rgba(201,168,76,.45); box-shadow: 0 18px 40px -22px rgba(201,168,76,.45); }
.mk-tile { transition: transform .25s, filter .25s; }
.mk-tile:hover { transform: scale(1.04); filter: brightness(1.15); z-index: 2; }
`;
