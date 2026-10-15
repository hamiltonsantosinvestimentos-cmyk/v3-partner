"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight, BadgeCheck, Banknote, Building2, CalendarDays, CheckCircle2, ChevronDown, Clock3, Coins,
  FileSearch, FileSignature, Handshake, Home, KeyRound, Landmark, MessagesSquare, MonitorPlay, Route,
  ScanSearch, ShieldCheck, Sprout, Stamp, Ticket, Users,
} from "lucide-react";
import { display, C, MOTION_CSS, Backdrop } from "@/components/quiz/partner-quiz-client";
import { trackPixel } from "@/components/quiz/meta-pixel";

// LP do webinar "Crédito Estruturado com Garantia" (15/10/2026), feita a partir do post do
// Instagram DehwC5GlrvN. CTA → /webinar/checkout (Pix ou boleto da Cora). Ver lib/webinar.ts.

const INICIO = new Date("2026-11-06T20:00:00-03:00").getTime();

// O que o inscrito aprende (15/10/2026, pedido do Hamilton: "colocar o que o lead irá aprender").
// Tudo sai do roteiro do post do Instagram; nada de promessa que o webinar não cobre.
const APRENDIZADOS = [
  { icon: ScanSearch, titulo: "Enxergar a operação antes de todo mundo", texto: "Como reconhecer, numa conversa com um empresário ou produtor rural, que ali existe uma operação de crédito com garantia para ser estruturada." },
  { icon: Building2, titulo: "Cash Home por dentro", texto: "Como o imóvel vira capital de giro para a empresa: a lógica da garantia e por que ela destrava crédito que o banco tradicional não libera." },
  { icon: Sprout, titulo: "Cash Agro por dentro", texto: "Liquidez com garantia rural para quem move o agronegócio, do produtor ao grupo empresarial do campo." },
  { icon: KeyRound, titulo: "A estratégia que poucos conhecem", texto: "Como o empresário pode fazer a operação usando o imóvel de um terceiro ou do próprio grupo econômico." },
  { icon: Route, titulo: "O passo a passo completo", texto: "Cada etapa, da primeira conversa ao crédito liberado: análise, avaliação do imóvel, aprovação, contrato e registro." },
  { icon: Coins, titulo: "Onde está a comissão", texto: "Por que estruturar paga mais do que só indicar crédito, e como a comissão acompanha o porte de cada operação." },
  { icon: BadgeCheck, titulo: "O caminho para virar Partner V3", texto: "Como funciona o credenciamento que permite indicar operações para a V3 e receber comissões." },
];

const JORNADA = [
  { icon: MessagesSquare, titulo: "Primeira conversa", texto: "A necessidade do cliente" },
  { icon: FileSearch, titulo: "Análise de crédito", texto: "Empresa, sócios e garantia" },
  { icon: Home, titulo: "Avaliação do imóvel", texto: "Quanto a garantia sustenta" },
  { icon: Stamp, titulo: "Aprovação", texto: "Condições da operação" },
  { icon: FileSignature, titulo: "Contrato", texto: "Assinatura das partes" },
  { icon: Landmark, titulo: "Registro", texto: "Garantia formalizada" },
  { icon: Banknote, titulo: "Crédito liberado", texto: "O dinheiro na conta" },
];

const COMISSOES = ["R$ 20 mil", "R$ 30 mil", "R$ 100 mil", "R$ 500 mil"];

const FAQ = [
  { p: "Como eu recebo o link da sala?", r: "Assim que o pagamento é confirmado, você recebe o acesso ao grupo exclusivo dos inscritos no WhatsApp. É por lá que enviamos o link da sala ao vivo." },
  { p: "Quais as formas de pagamento?", r: "Pix ou boleto, direto na conta da V3 Partners. O Pix é confirmado em instantes; o boleto leva até 2 dias úteis para compensar." },
  { p: "Preciso ser do mercado financeiro?", r: "Não. O webinar é para quem se relaciona com empresários, produtores rurais ou grupos empresariais e quer entender como as operações com garantia são estruturadas." },
  { p: "Vou poder indicar operações depois?", r: "Indicar operações e receber comissões é exclusivo de quem se torna Partner V3. No webinar mostramos o caminho para o credenciamento." },
];

function Revelar({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { const t = setTimeout(() => setVisivel(true), 0); return () => clearTimeout(t); }
    const io = new IntersectionObserver(([en]) => {
      if (en?.isIntersecting) { setVisivel(true); io.disconnect(); }
    }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`w-rev ${visivel ? "w-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/** Lista de aprendizados: a linha dourada enche e cada item acende conforme a rolagem. */
function Aprendizados() {
  const ref = useRef<HTMLOListElement>(null);
  const [progresso, setProgresso] = useState(0);
  const [ativos, setAtivos] = useState(0);
  useEffect(() => {
    let raf = 0;
    const medir = () => {
      const el = ref.current;
      if (!el) return;
      const corte = window.innerHeight * 0.62;
      const box = el.getBoundingClientRect();
      setProgresso(Math.min(1, Math.max(0, (corte - box.top) / box.height)));
      const itens = Array.from(el.querySelectorAll<HTMLElement>("[data-item]"));
      setAtivos(itens.filter((it) => it.getBoundingClientRect().top < corte).length);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(medir); };
    raf = requestAnimationFrame(medir);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
  return (
    <ol ref={ref} className="relative">
      <span aria-hidden className="absolute left-[27px] top-2 bottom-2 w-px" style={{ background: C.lineSoft }} />
      <span aria-hidden className="absolute left-[27px] top-2 w-px origin-top transition-[height] duration-300"
        style={{ height: `calc((100% - 16px) * ${progresso})`, background: `linear-gradient(${C.goldLight}, ${C.gold})`, boxShadow: `0 0 14px ${C.gold}` }} />
      {APRENDIZADOS.map((a, i) => {
        const on = i < ativos;
        return (
          <li key={a.titulo} data-item className="relative flex gap-5 sm:gap-7 pb-10 last:pb-0">
            <span className="relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border transition-all duration-500"
              style={{ borderColor: on ? `${C.gold}99` : C.lineSoft, background: on ? `radial-gradient(circle at 30% 25%, #243A66, ${C.bg})` : C.bg, color: on ? C.goldLight : C.muted, boxShadow: on ? `0 0 28px -6px ${C.gold}` : "none" }}>
              <a.icon className="h-6 w-6" />
            </span>
            <div className="pt-1 transition-opacity duration-500" style={{ opacity: on ? 1 : 0.45 }}>
              <p className={`${display.className} text-sm italic`} style={{ color: C.gold }}>{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-0.5 text-lg sm:text-xl font-bold" style={{ color: C.cream }}>{a.titulo}</h3>
              <p className="mt-1.5 max-w-xl text-sm sm:text-[15px] leading-relaxed" style={{ color: C.muted }}>{a.texto}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Linha do tempo de uma operação: as etapas acendem em sequência quando entram na tela. */
function Jornada() {
  const ref = useRef<HTMLDivElement>(null);
  const [acesas, setAcesas] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const acender = () => {
      timer = setInterval(() => setAcesas((n) => { if (n >= JORNADA.length) { clearInterval(timer); return n; } return n + 1; }), 260);
    };
    if (!("IntersectionObserver" in window)) { const t = setTimeout(() => setAcesas(JORNADA.length), 0); return () => clearTimeout(t); }
    const io = new IntersectionObserver(([en]) => { if (en?.isIntersecting) { acender(); io.disconnect(); } }, { threshold: 0.35 });
    io.observe(el);
    return () => { io.disconnect(); if (timer) clearInterval(timer); };
  }, []);
  const pct = acesas <= 1 ? 0 : (acesas - 1) / (JORNADA.length - 1);
  return (
    <div ref={ref} className="relative">
      {/* trilho: horizontal no desktop, vertical no celular */}
      <span aria-hidden className="absolute hidden lg:block left-[7%] right-[7%] top-7 h-px" style={{ background: C.lineSoft }} />
      <span aria-hidden className="absolute hidden lg:block left-[7%] top-7 h-px transition-[width] duration-300"
        style={{ width: `calc(86% * ${pct})`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})`, boxShadow: `0 0 12px ${C.gold}` }} />
      <span aria-hidden className="absolute lg:hidden left-7 top-7 bottom-7 w-px" style={{ background: C.lineSoft }} />
      <span aria-hidden className="absolute lg:hidden left-7 top-7 w-px transition-[height] duration-300"
        style={{ height: `calc((100% - 56px) * ${pct})`, background: `linear-gradient(${C.gold}, ${C.goldLight})`, boxShadow: `0 0 12px ${C.gold}` }} />
      <ol className="relative grid gap-6 lg:grid-cols-7 lg:gap-3">
        {JORNADA.map((j, i) => {
          const on = i < acesas;
          const ultimo = i === JORNADA.length - 1;
          return (
            <li key={j.titulo} className="flex items-center gap-4 lg:flex-col lg:items-center lg:gap-0 lg:text-center">
              <span className="relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-500"
                style={{
                  borderColor: on ? (ultimo ? C.goldLight : `${C.gold}AA`) : C.lineSoft,
                  background: on ? (ultimo ? `linear-gradient(135deg, ${C.goldLight}, ${C.gold})` : `radial-gradient(circle at 30% 25%, #243A66, ${C.bg})`) : C.bg,
                  color: on ? (ultimo ? C.bg : C.goldLight) : C.muted,
                  boxShadow: on ? `0 0 ${ultimo ? 40 : 22}px -4px ${C.gold}` : "none",
                  transform: on ? "scale(1)" : "scale(0.9)",
                }}>
                <j.icon className="h-5 w-5" />
              </span>
              <div className="transition-opacity duration-500 lg:mt-4" style={{ opacity: on ? 1 : 0.4 }}>
                <p className="text-[15px] font-bold" style={{ color: ultimo && on ? C.goldLight : C.cream }}>{j.titulo}</p>
                <p className="mt-0.5 text-xs" style={{ color: C.muted }}>{j.texto}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function useAgora() {
  const [agora, setAgora] = useState<number | null>(null);
  useEffect(() => {
    // Só no cliente (o horário do servidor geraria diferença de hidratação).
    const primeiro = setTimeout(() => setAgora(Date.now()), 0);
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => { clearTimeout(primeiro); clearInterval(t); };
  }, []);
  return agora;
}

function partesAte(agora: number) {
  const resto = Math.max(0, INICIO - agora);
  return [
    { v: Math.floor(resto / 86_400_000), l: "dias" },
    { v: Math.floor(resto / 3_600_000) % 24, l: "horas" },
    { v: Math.floor(resto / 60_000) % 60, l: "min" },
    { v: Math.floor(resto / 1000) % 60, l: "seg" },
  ];
}

function Contagem() {
  const agora = useAgora();
  if (agora === null) return <div className="h-[74px]" />;
  if (INICIO - agora <= 0) return null;
  const partes = partesAte(agora);
  return (
    <div className="flex gap-2.5 sm:gap-3">
      {partes.map((p) => (
        <div key={p.l} className="w-[62px] sm:w-[72px] rounded-xl border py-2.5 text-center backdrop-blur-sm"
          style={{ borderColor: C.line, background: "rgba(22,39,68,0.55)" }}>
          <p className="text-2xl sm:text-[28px] font-bold tabular-nums leading-none" style={{ color: C.cream }}>{String(p.v).padStart(2, "0")}</p>
          <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>{p.l}</p>
        </div>
      ))}
    </div>
  );
}

export function WebinarLp() {
  const searchParams = useSearchParams();
  const [faqAberto, setFaqAberto] = useState<number | null>(0);
  const [barra, setBarra] = useState(false);
  const agora = useAgora();
  useEffect(() => {
    const onScroll = () => setBarra(window.scrollY > 640);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Leva UTM / fbclid para o checkout (atribuição da campanha).
  const hrefCheckout = useMemo(() => {
    const q = new URLSearchParams();
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]) {
      const v = searchParams.get(k);
      if (v) q.set(k, v.slice(0, 200));
    }
    const s = q.toString();
    return `/webinar/checkout${s ? `?${s}` : ""}`;
  }, [searchParams]);

  const cta = (texto = "Garantir minha vaga", grande = false) => (
    <Link href={hrefCheckout} onClick={() => trackPixel("InitiateCheckout", { content_name: "webinar_credito_estruturado", currency: "BRL", value: 27 })}
      className={`q-btn group inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-xl font-bold transition-all duration-300 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] ${grande ? "px-7 sm:px-9 py-[18px] text-[15px] sm:text-base" : "px-7 py-4 text-[15px]"}`}
      style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg, boxShadow: `0 18px 48px -16px ${C.gold}` }}>
      {texto} <span className="opacity-70">·</span> R$ 27
      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
    </Link>
  );

  return (
    <main className="relative min-h-screen overflow-x-hidden" style={{ background: C.bg, color: C.cream }}>
      <style>{MOTION_CSS + `
        .w-rev { opacity: 0; transform: translateY(26px); transition: opacity .9s cubic-bezier(.2,.7,.2,1), transform .9s cubic-bezier(.2,.7,.2,1); }
        .w-rev.w-in { opacity: 1; transform: none; }
        .w-card { transition: transform .5s cubic-bezier(.2,.7,.2,1), border-color .4s, background .4s; }
        .w-card:hover { transform: translateY(-4px); border-color: rgba(201,168,76,.45); background: rgba(22,39,68,.75); }
        @media (prefers-reduced-motion: reduce) { .w-rev { opacity: 1; transform: none; transition: none; } .w-card:hover { transform: none; } }
      `}</style>
      <Backdrop />

      {/* Barra fixa (desktop): aparece depois do hero, com a contagem e o CTA */}
      <div className="fixed inset-x-0 top-0 z-30 hidden sm:block border-b backdrop-blur-xl transition-all duration-500"
        style={{ borderColor: C.line, background: "rgba(9,8,26,0.82)", transform: barra ? "translateY(0)" : "translateY(-110%)", opacity: barra ? 1 : 0 }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <Image src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" width={52} height={32} className="h-7 w-auto object-contain" />
            <span className="hidden md:flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: C.gold }}>
              <span className="q-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#F87171", boxShadow: "0 0 10px #F87171" }} />
              Ao vivo · 06/11 · 20h
            </span>
          </div>
          <div className="flex items-center gap-5">
            {agora !== null && INICIO > agora && (
              <span className="hidden lg:flex items-baseline gap-3 tabular-nums" style={{ color: C.cream }}>
                {partesAte(agora).map((p) => (
                  <span key={p.l} className="text-base font-bold">{String(p.v).padStart(2, "0")}<span className="ml-0.5 text-[10px] font-semibold uppercase" style={{ color: C.muted }}>{p.l.slice(0, 1)}</span></span>
                ))}
              </span>
            )}
            <Link href={hrefCheckout} onClick={() => trackPixel("InitiateCheckout", { content_name: "webinar_credito_estruturado", currency: "BRL", value: 27 })}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-bold transition-all hover:brightness-110"
              style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg }}>
              Garantir minha vaga · R$ 27 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Topo */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-5">
        <Image src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" width={72} height={44} className="h-10 w-auto object-contain" priority />
        <Link href={hrefCheckout} className="hidden sm:inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-colors hover:bg-[#C9A84C]/10"
          style={{ borderColor: C.line, color: C.gold }}>
          <Ticket className="w-3.5 h-3.5" /> Garantir vaga
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-8 sm:pt-16 pb-20 sm:pb-28">
        <div className="grid gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <p className="q-rise flex flex-wrap items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>
              <span className="q-dot inline-block h-2 w-2 rounded-full" style={{ background: "#F87171", boxShadow: "0 0 12px #F87171" }} />
              Webinar ao vivo · 06/11 · 20h
            </p>
            <h1 className={`${display.className} q-rise mt-6 text-[42px] leading-[1.02] sm:text-6xl lg:text-[76px] font-semibold tracking-[-0.01em]`} style={{ animationDelay: "120ms" }}>
              Muitos falam de crédito.{" "}
              <span className="q-gold-text italic" style={{ backgroundImage: `linear-gradient(100deg, ${C.gold} 20%, ${C.goldLight} 45%, ${C.gold} 70%)`, backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                Poucos sabem estruturar.
              </span>
            </h1>
            <p className="q-rise mt-7 max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: C.muted, animationDelay: "260ms" }}>
              Existe um mercado que movimenta milhões todos os meses e que pouca gente conhece por dentro: o de <strong style={{ color: C.cream }}>crédito estruturado com garantia</strong>. Ao vivo, vamos abrir como funcionam as operações que a V3 Partners estrutura, e onde estão as maiores comissões.
            </p>
            <div className="q-rise mt-9 flex flex-col sm:flex-row sm:items-center gap-4" style={{ animationDelay: "380ms" }}>
              {cta()}
              <p className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
                <ShieldCheck className="w-4 h-4" style={{ color: C.gold }} /> Pix ou boleto · acesso ao grupo dos inscritos
              </p>
            </div>
          </div>

          <div className="q-rise rounded-2xl border p-6 sm:p-7 backdrop-blur-md" style={{ borderColor: C.line, background: "rgba(17,31,53,0.6)", animationDelay: "480ms" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: C.gold }}>Começa em</p>
            <div className="mt-4"><Contagem /></div>
            <div className="mt-6 space-y-3 border-t pt-5 text-sm" style={{ borderColor: C.lineSoft }}>
              <p className="flex items-center gap-3"><CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: C.gold }} /> Quinta, 6 de novembro, às 20h</p>
              <p className="flex items-center gap-3"><MonitorPlay className="w-4 h-4 flex-shrink-0" style={{ color: C.gold }} /> Ao vivo e online</p>
              <p className="flex items-center gap-3"><Users className="w-4 h-4 flex-shrink-0" style={{ color: C.gold }} /> Com Hamilton Santos e Robson Lino</p>
              <p className="flex items-center gap-3"><Ticket className="w-4 h-4 flex-shrink-0" style={{ color: C.gold }} /> Ingresso <strong className="ml-1" style={{ color: C.goldLight }}>R$ 27</strong></p>
            </div>
          </div>
        </div>
      </section>

      {/* Faixa */}
      <section className="relative z-10 border-y" style={{ borderColor: C.line, background: "rgba(17,31,53,0.55)" }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-20 text-center">
          <Revelar>
            <p className={`${display.className} text-[28px] sm:text-[42px] leading-[1.15] font-medium`}>
              Enquanto muitos só falam de crédito, poucos sabem <em style={{ color: C.gold }}>estruturar</em> uma operação.
              <span className="block mt-2" style={{ color: C.muted }}>E é aí que estão as maiores comissões.</span>
            </p>
          </Revelar>
        </div>
      </section>

      {/* O que você vai aprender */}
      <section id="aprender" className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-32">
        <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Revelar>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>O que você vai aprender</p>
              <h2 className={`${display.className} mt-4 text-[40px] sm:text-6xl font-semibold leading-[1.02]`}>
                Em uma noite, você sai sabendo o que{" "}
                <em className="q-gold-text" style={{ backgroundImage: `linear-gradient(100deg, ${C.gold} 20%, ${C.goldLight} 45%, ${C.gold} 70%)`, backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>poucos do mercado sabem</em>.
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed" style={{ color: C.muted }}>
                Não é teoria de crédito. É como a V3 Partners monta, na prática, as operações com garantia que ela estrutura todos os meses.
              </p>
              <div className="mt-8 hidden lg:block">{cta("Quero aprender isso")}</div>
            </Revelar>
          </div>
          <div>
            <Aprendizados />
            <p className="mt-10 pl-[76px] sm:pl-[84px] text-sm italic" style={{ color: C.muted }}>
              + as outras modalidades do portfólio de crédito estruturado da V3.
            </p>
            <div className="mt-10 lg:hidden">{cta("Quero aprender isso")}</div>
          </div>
        </div>
      </section>

      {/* A jornada de uma operação */}
      <section className="relative z-10 border-y" style={{ borderColor: C.line, background: "linear-gradient(180deg, rgba(17,31,53,0.65), rgba(9,8,26,0.4))" }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <Revelar className="text-center">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>A jornada de uma operação</p>
            <h2 className={`${display.className} mx-auto mt-4 max-w-3xl text-4xl sm:text-[56px] font-semibold leading-[1.04]`}>
              Da primeira conversa ao <em style={{ color: C.gold }}>crédito na conta</em>.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed" style={{ color: C.muted }}>
              Ao vivo, você vê o que acontece em cada etapa, e onde a maioria das operações se perde por falta de estrutura.
            </p>
          </Revelar>
          <div className="mt-14 sm:mt-20"><Jornada /></div>
        </div>
      </section>

      {/* Partner V3 */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pb-20 sm:pb-28">
        <Revelar>
          <div className="relative overflow-hidden rounded-3xl border p-7 sm:p-12" style={{ borderColor: C.line, background: `linear-gradient(140deg, rgba(36,58,102,0.55), rgba(9,8,26,0.9))` }}>
            <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full" style={{ background: `radial-gradient(closest-side, ${C.gold}30, transparent)` }} />
            <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>
                  <Handshake className="w-4 h-4" /> E mais
                </p>
                <h2 className={`${display.className} mt-4 text-4xl sm:text-5xl font-semibold leading-[1.05]`}>O caminho para se tornar <em style={{ color: C.gold }}>Partner V3</em>.</h2>
                <p className="mt-5 text-base leading-relaxed" style={{ color: C.muted }}>
                  Só os parceiros credenciados podem indicar operações e receber comissões. No webinar mostramos como funciona o credenciamento e o que a V3 entrega para quem indica.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: C.muted }}>Comissões que podem chegar a</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {COMISSOES.map((v, i) => (
                    <div key={v} className="rounded-xl border px-3 sm:px-4 py-4" style={{ borderColor: i === 3 ? `${C.gold}70` : C.lineSoft, background: i === 3 ? `${C.gold}14` : "rgba(9,8,26,0.45)" }}>
                      <p className={`${display.className} whitespace-nowrap text-[21px] min-[400px]:text-2xl sm:text-[34px] font-semibold leading-none`} style={{ color: i === 3 ? C.goldLight : C.cream }}>
                        {i === 3 && <span className="mr-1 text-base italic" style={{ color: C.muted }}>até</span>}{v}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px]" style={{ color: C.muted }}>Conforme o porte de cada operação.</p>
              </div>
            </div>
          </div>
        </Revelar>
      </section>

      {/* Chamada: tornar-se parceiro da V3 (sem comparar o ingresso com comissão, pedido do Hamilton) */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
        <Revelar>
          <div className="relative overflow-hidden rounded-3xl border px-7 py-14 sm:px-14 sm:py-20 text-center"
            style={{ borderColor: `${C.gold}55`, background: `radial-gradient(120% 140% at 50% 0%, rgba(201,168,76,0.18), rgba(17,31,53,0.7) 45%, rgba(9,8,26,0.95))`, boxShadow: `0 50px 140px -60px ${C.gold}` }}>
            <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${C.goldLight}, transparent)` }} />
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border" style={{ borderColor: `${C.gold}88`, background: `${C.gold}14`, color: C.goldLight }}>
              <Handshake className="h-7 w-7" />
            </span>
            <p className="mt-7 text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>O próximo passo</p>
            <h2 className={`${display.className} mx-auto mt-4 max-w-3xl text-4xl sm:text-[60px] font-semibold leading-[1.02]`}>
              Esta noite pode ser o seu primeiro passo como <em className="q-gold-text" style={{ backgroundImage: `linear-gradient(100deg, ${C.gold} 20%, ${C.goldLight} 45%, ${C.gold} 70%)`, backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>parceiro da V3</em>.
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-relaxed" style={{ color: C.muted }}>
              Você entende como as operações funcionam por dentro e conhece o caminho para se tornar Partner V3: indicar operações com a estrutura e a Mesa de Crédito da V3 por trás de cada uma.
            </p>
            <div className="mx-auto mt-9 grid max-w-3xl gap-3 sm:grid-cols-3 text-left">
              {[
                { icon: Route, t: "Entenda o mercado", d: "Como o crédito estruturado com garantia funciona na prática" },
                { icon: Landmark, t: "Conheça a estrutura", d: "Quem faz o quê numa operação da V3" },
                { icon: BadgeCheck, t: "Torne-se Partner", d: "O caminho do credenciamento" },
              ].map((x) => (
                <div key={x.t} className="rounded-2xl border p-4" style={{ borderColor: C.lineSoft, background: "rgba(9,8,26,0.5)" }}>
                  <x.icon className="h-5 w-5" style={{ color: C.gold }} />
                  <p className="mt-3 text-sm font-bold" style={{ color: C.cream }}>{x.t}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>{x.d}</p>
                </div>
              ))}
            </div>
            <div className="mt-11 flex justify-center">{cta("Garantir minha vaga agora", true)}</div>
          </div>
        </Revelar>
      </section>

      {/* Para quem é + apresentadores */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pb-20 sm:pb-28 grid gap-6 lg:grid-cols-2">
        <Revelar>
          <div className="h-full rounded-2xl border p-7 sm:p-9" style={{ borderColor: C.lineSoft, background: "rgba(17,31,53,0.5)" }}>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>Para quem é</p>
            <h3 className={`${display.className} mt-4 text-3xl sm:text-4xl font-semibold leading-tight`}>Se você se relaciona com quem decide, esse webinar é para você.</h3>
            <ul className="mt-6 space-y-3 text-sm" style={{ color: C.cream }}>
              {["Empresários e donos de empresa", "Produtores rurais", "Grupos empresariais e econômicos", "Consultores, contadores e corretores que atendem esse público"].map((x) => (
                <li key={x} className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 w-4 h-4 flex-shrink-0" style={{ color: C.gold }} /> {x}</li>
              ))}
            </ul>
          </div>
        </Revelar>
        <Revelar delay={120}>
          <div className="h-full rounded-2xl border p-7 sm:p-9" style={{ borderColor: C.lineSoft, background: "rgba(17,31,53,0.5)" }}>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>Quem apresenta</p>
            <div className="mt-6 space-y-5">
              {[
                { ini: "HS", nome: "Hamilton Santos", cargo: "Sócio-fundador · Financeiro e Cross-border" },
                { ini: "RL", nome: "Robson Lino", cargo: "Sócio-fundador · Compliance e Operações" },
              ].map((p) => (
                <div key={p.nome} className="flex items-center gap-4">
                  <span className={`${display.className} flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border text-2xl font-semibold`}
                    style={{ borderColor: `${C.gold}66`, background: `radial-gradient(circle at 30% 25%, #243A66, ${C.bg})`, color: C.goldLight }}>{p.ini}</span>
                  <div>
                    <p className="text-lg font-bold">{p.nome}</p>
                    <p className="text-sm" style={{ color: C.muted }}>{p.cargo}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 border-t pt-5 text-sm leading-relaxed" style={{ borderColor: C.lineSoft, color: C.muted }}>
              A V3 Partners é uma boutique de estruturação financeira: crédito com garantia, securitização, real estate e M&A.
            </p>
          </div>
        </Revelar>
      </section>

      {/* Ingresso */}
      <section id="ingresso" className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 pb-20 sm:pb-28">
        <Revelar>
          <div className="relative overflow-hidden rounded-3xl border p-8 sm:p-12 text-center" style={{ borderColor: `${C.gold}55`, background: "rgba(17,31,53,0.75)", boxShadow: `0 40px 120px -50px ${C.gold}` }}>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>Ingresso</p>
            <p className={`${display.className} mt-4 text-7xl sm:text-8xl font-semibold leading-none`} style={{ color: C.cream }}>
              <span className="align-top text-2xl sm:text-3xl" style={{ color: C.muted }}>R$ </span>27
            </p>
            <p className="mt-3 text-sm" style={{ color: C.muted }}>{"Webinar ao vivo · 06/11 · 20h"}</p>
            <ul className="mx-auto mt-8 max-w-sm space-y-3 text-left text-sm">
              {["Acesso à transmissão ao vivo e online", "Grupo exclusivo dos inscritos no WhatsApp", "Pagamento por Pix ou boleto"].map((x) => (
                <li key={x} className="flex items-center gap-3"><CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: C.gold }} /> {x}</li>
              ))}
            </ul>
            <div className="mt-10 flex justify-center">{cta("Quero minha vaga", true)}</div>
            <p className="mt-5 flex items-center justify-center gap-2 text-[11px]" style={{ color: C.muted }}>
              <Clock3 className="w-3.5 h-3.5" /> Leva menos de 1 minuto
            </p>
          </div>
        </Revelar>
      </section>

      {/* FAQ */}
      <section className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 pb-24">
        <Revelar>
          <h2 className={`${display.className} text-3xl sm:text-4xl font-semibold`}>Perguntas frequentes</h2>
        </Revelar>
        <div className="mt-8 divide-y border-y" style={{ borderColor: C.lineSoft }}>
          {FAQ.map((f, i) => (
            <div key={f.p} style={{ borderColor: C.lineSoft }}>
              <button onClick={() => setFaqAberto(faqAberto === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left">
                <span className="text-[15px] font-semibold">{f.p}</span>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${faqAberto === i ? "rotate-180" : ""}`} style={{ color: C.gold }} />
              </button>
              <div className="grid transition-all duration-300" style={{ gridTemplateRows: faqAberto === i ? "1fr" : "0fr" }}>
                <p className="overflow-hidden text-sm leading-relaxed" style={{ color: C.muted }}>
                  <span className="block pb-5">{f.r}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t py-8 text-center text-[11px]" style={{ borderColor: C.lineSoft, color: C.muted }}>
        V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · <a href="https://v3partners.com.br" className="hover:underline">v3partners.com.br</a>
      </footer>

      {/* CTA fixo no celular */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t p-3 backdrop-blur-md sm:hidden" style={{ borderColor: C.line, background: "rgba(9,8,26,0.85)" }}>
        <Link href={hrefCheckout} onClick={() => trackPixel("InitiateCheckout", { content_name: "webinar_credito_estruturado", currency: "BRL", value: 27 })}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold"
          style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg }}>
          Garantir minha vaga · R$ 27 <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="h-20 sm:hidden" />
    </main>
  );
}
