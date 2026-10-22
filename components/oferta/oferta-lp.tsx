"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight, BadgeCheck, Bot, Briefcase, Building2, CalendarCheck2, CheckCircle2, ChevronDown, Clock3,
  CreditCard, Crown, FileSignature, Gem, GraduationCap, Handshake, Infinity as InfinityIcon, KanbanSquare, Landmark,
  LineChart, Loader2, Lock, PauseCircle, Rocket, ScanSearch, ShieldCheck, Sparkles, Store, Upload, X,
} from "lucide-react";
import { display, C, MOTION_CSS, Backdrop, DDI_PAISES, telefoneCompleto } from "@/components/quiz/partner-quiz-client";
import { trackPixel } from "@/components/quiz/meta-pixel";
import { OFERTA, brl, type PlanoOferta } from "@/lib/oferta-trial";

// LP da oferta única V3 (22/10/2026): 30 dias grátis para subir propostas com toda a estrutura,
// depois Gold (R$ 397/mês, 25%), Diamante (R$ 897/mês, 40%) ou Partner PRO anual (50% + garantia
// de retorno em contrato). Mensais sem fidelidade. Lead → /api/public/oferta. Ver lib/oferta-trial.ts.

const GOLD_TXT = { backgroundImage: `linear-gradient(100deg, ${C.gold} 20%, ${C.goldLight} 45%, ${C.gold} 70%)`, backgroundSize: "200% 100%", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" } as const;

const ESTRUTURA = [
  { icon: Landmark, titulo: "Mesa de Crédito", texto: "Varejo, Estruturado e High Ticket (a partir de R$ 5 milhões), com a esteira completa de análise até o crédito liberado." },
  { icon: Briefcase, titulo: "Mesa Operacional", texto: "Um time que conduz a proposta com você: documentos, checklist, prazos e cada etapa acompanhada." },
  { icon: ScanSearch, titulo: "Análise de crédito", texto: "SCR, situação de crédito, rating V3 e parecer da empresa e dos sócios antes de levar ao mercado." },
  { icon: Building2, titulo: "Avaliação de imóvel", texto: "Avaliação técnica da garantia, urbana ou rural, para saber quanto ela sustenta antes de propor." },
  { icon: KanbanSquare, titulo: "CRM e Prospecção", texto: "Carteira, pipeline arrastável, follow-ups e lembretes no WhatsApp, sem planilha paralela." },
  { icon: FileSignature, titulo: "Central de Contratos", texto: "Mandato de crédito, NDA e minutas prontas, com assinatura digital ponta a ponta." },
  { icon: LineChart, titulo: "Simuladores", texto: "Home Equity, Cash Home e Cash Agro para mostrar ao cliente, na hora, o que a operação entrega." },
  { icon: Bot, titulo: "Squads de IA", texto: "Sete squads para due diligence, tese de investimento e estruturação, em segundos." },
  { icon: GraduationCap, titulo: "Academy", texto: "Formação por trilha e por produto, com certificação, dentro da própria plataforma." },
  { icon: Store, titulo: "Marketplace", texto: "Rede de fornecedores e parceiros B2B para fechar mais rápido." },
  { icon: ShieldCheck, titulo: "KYC e Compliance", texto: "A exigência de uma instituição regulada nos bastidores, sem você montar nada." },
  { icon: Handshake, titulo: "Os sócios com você", texto: "Três sócios que estruturam junto, não um call center. As 4 verticais da V3 à sua disposição." },
];

const MARQUEE = ["Mesa de Crédito", "Mesa Operacional", "Análise de Crédito", "Avaliação de Imóvel", "CRM", "Central de Contratos", "Mandato de Crédito", "Simuladores", "Squads de IA", "Academy", "Marketplace", "KYC e Compliance", "Real Estate", "M&A e Fundos"];

const ETAPAS = [
  { icon: Rocket, quando: "Dia 1", titulo: "Acesso liberado", texto: "Você entra na plataforma com toda a estrutura da V3, sem pagar nada e sem cartão." },
  { icon: Upload, quando: "Dias 1 a 30", titulo: "Suba suas propostas", texto: "Cadastre clientes, suba propostas reais na Mesa de Crédito e veja a esteira trabalhar por você." },
  { icon: Gem, quando: "Dia 30", titulo: "Escolha o seu plano", texto: "Gold, Diamante ou Partner PRO anual. Ou não continue: sem cobrança, sem multa." },
  { icon: InfinityIcon, quando: "Todo mês", titulo: "Você decide", texto: "No Gold e no Diamante você paga o mês e, se quiser interromper no próximo, interrompe." },
];

const FAQ = [
  { p: "Os 30 dias são grátis mesmo?", r: "Sim. Durante 30 dias você usa toda a estrutura da V3 sem pagar nada, e não pedimos cartão para começar." },
  { p: "O que acontece no fim dos 30 dias?", r: "Você escolhe o seu plano: Gold, Diamante ou Partner PRO anual. Se decidir não continuar, o acesso é encerrado sem nenhum custo." },
  { p: "Gold e Diamante têm fidelidade?", r: "Não. Você paga mês a mês e pode interromper quando quiser: paga o mês em curso e, se não quiser o próximo, não renova. Sem multa." },
  { p: "Qual a diferença entre Gold e Diamante?", r: "A estrutura é a mesma, completa nos dois. Muda a sua comissão: 25% no Gold e 40% no Diamante, em cada operação que você originar." },
  { p: "Como funciona a garantia do Partner PRO?", r: "No Partner PRO você paga o ano de forma integral e recebe 50% de comissão. Mantido o KPI de originação definido em contrato, se não houver retorno sobre o valor investido, devolvemos o seu dinheiro. Está no contrato." },
  { p: "Preciso ter experiência bancária?", r: "Não. A V3 ensina o mercado pela Academy e a Mesa Operacional conduz cada proposta com você." },
];

// ─── Hooks e peças de movimento ──────────────────────────────────────────────

function useVisivel<T extends HTMLElement>(margem = "0px 0px -10% 0px") {
  const ref = useRef<T>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { const t = setTimeout(() => setVisivel(true), 0); return () => clearTimeout(t); }
    const io = new IntersectionObserver(([en]) => { if (en?.isIntersecting) { setVisivel(true); io.disconnect(); } }, { rootMargin: margem });
    io.observe(el);
    return () => io.disconnect();
  }, [margem]);
  return [ref, visivel] as const;
}

function Revelar({ children, delay = 0, className = "", efeito = "sobe" }: { children: React.ReactNode; delay?: number; className?: string; efeito?: "sobe" | "cortina" | "zoom" }) {
  const [ref, visivel] = useVisivel<HTMLDivElement>();
  return <div ref={ref} className={`o-rev o-${efeito} ${visivel ? "o-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

/** Número que corre até o valor quando muda (easeOutCubic). */
function useTween(alvo: number, duracao = 900) {
  const [v, setV] = useState(alvo);
  const atual = useRef(alvo);
  useEffect(() => {
    const de = atual.current;
    if (de === alvo) return;
    const t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / duracao);
      const n = de + (alvo - de) * (1 - Math.pow(1 - k, 3));
      atual.current = n;
      setV(n);
      if (k < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracao]);
  return v;
}

function Conta({ ate, prefixo = "", sufixo = "", duracao = 1400 }: { ate: number; prefixo?: string; sufixo?: string; duracao?: number }) {
  const [ref, visivel] = useVisivel<HTMLSpanElement>();
  const v = useTween(visivel ? ate : 0, duracao);
  return <span ref={ref} className="tabular-nums">{prefixo}{Math.round(v).toLocaleString("pt-BR")}{sufixo}</span>;
}

/** Botão que é atraído pelo cursor (desktop). */
function Magnetico({ children, onClick, grande = false, variante = "ouro" }: { children: React.ReactNode; onClick: () => void; grande?: boolean; variante?: "ouro" | "linha" }) {
  const ref = useRef<HTMLButtonElement>(null);
  const mover = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px, ${(e.clientY - r.top - r.height / 2) * 0.32}px)`;
  };
  const soltar = () => { if (ref.current) ref.current.style.transform = ""; };
  const ouro = variante === "ouro";
  return (
    <button ref={ref} type="button" onClick={onClick} onMouseMove={mover} onMouseLeave={soltar}
      className={`${ouro ? "q-btn" : ""} o-mag group inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-xl font-bold ${grande ? "px-8 sm:px-10 py-[18px] text-[15px] sm:text-base" : "px-7 py-4 text-[15px]"} ${ouro ? "" : "border hover:bg-[#C9A84C]/10"}`}
      style={ouro
        ? { background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg, boxShadow: `0 18px 48px -16px ${C.gold}` }
        : { borderColor: C.line, color: C.goldLight }}>
      {children}
      <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
    </button>
  );
}

/** Abertura: cortina navy com o logo e a linha de ouro, que sobe e revela a página. */
function Abertura() {
  const [fora, setFora] = useState(false);
  useEffect(() => {
    const reduzido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setFora(true), reduzido ? 0 : 1600);
    return () => clearTimeout(t);
  }, []);
  if (fora) return null;
  return (
    <div aria-hidden className="o-curtain fixed inset-0 z-[60] flex flex-col items-center justify-center" style={{ background: C.bg }}>
      <Image src="/v3-logo-flat-gold-alpha.png" alt="" width={120} height={74} className="o-curtain-logo h-16 w-auto object-contain" priority />
      <span className="o-curtain-line mt-6 block h-px w-40" style={{ background: `linear-gradient(90deg, transparent, ${C.goldLight}, transparent)` }} />
      <span className="o-curtain-txt mt-5 text-[10px] font-bold uppercase tracking-[0.5em]" style={{ color: C.gold }}>Oferta única</span>
    </div>
  );
}

function BarraProgresso() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const medir = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (ref.current) ref.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(medir); };
    medir();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); };
  }, []);
  return <div ref={ref} aria-hidden className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left" style={{ transform: "scaleX(0)", background: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})`, boxShadow: `0 0 12px ${C.gold}` }} />;
}

/** Mostrador dos 30 dias: o anel desenha, os 30 traços acendem e o número corre até 30. */
function Mostrador() {
  const [ref, visivel] = useVisivel<HTMLDivElement>("0px");
  const dias = useTween(visivel ? 30 : 0, 2200);
  const acesos = Math.round(dias);
  return (
    <div ref={ref} className="relative mx-auto aspect-square w-full max-w-[400px]">
      <div aria-hidden className="absolute inset-[12%] rounded-full q-breathe" style={{ background: `radial-gradient(closest-side, ${C.gold}33, transparent 75%)` }} />
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="100" cy="100" r="86" fill="none" stroke={C.lineSoft} strokeWidth="1" />
        <circle cx="100" cy="100" r="86" fill="none" stroke="url(#o-ouro)" strokeWidth="2.2" strokeLinecap="round"
          strokeDasharray={540.4} strokeDashoffset={540.4 * (1 - dias / 30)} />
        <defs>
          <linearGradient id="o-ouro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={C.goldLight} /><stop offset="1" stopColor={C.gold} />
          </linearGradient>
        </defs>
        {Array.from({ length: 30 }, (_, i) => {
          const a = (i / 30) * Math.PI * 2;
          const on = i < acesos;
          return <line key={i} x1={100 + Math.cos(a) * 72} y1={100 + Math.sin(a) * 72} x2={100 + Math.cos(a) * (on ? 64 : 67)} y2={100 + Math.sin(a) * (on ? 64 : 67)}
            stroke={on ? C.goldLight : "rgba(240,236,228,0.16)"} strokeWidth={on ? 1.8 : 1} strokeLinecap="round" style={{ transition: "all .4s" }} />;
        })}
      </svg>
      {/* órbita */}
      <div aria-hidden className="o-orbit absolute inset-0">
        <span className="absolute left-1/2 top-[7%] -ml-1.5 h-3 w-3 rounded-full" style={{ background: C.goldLight, boxShadow: `0 0 18px 4px ${C.gold}` }} />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.34em]" style={{ color: C.gold }}>Trial</p>
        <p className={`${display.className} text-[112px] sm:text-[132px] font-semibold leading-[0.85] tabular-nums`} style={{ color: C.cream }}>{acesos}</p>
        <p className="mt-1 text-sm font-bold uppercase tracking-[0.3em]" style={{ color: C.cream }}>dias grátis</p>
        <p className="mt-2 text-[11px]" style={{ color: C.muted }}>sem cartão · sem fidelidade</p>
      </div>
    </div>
  );
}

function Marquee() {
  const itens = [...MARQUEE, ...MARQUEE];
  return (
    <div className="relative overflow-hidden border-y py-5" style={{ borderColor: C.line, background: "rgba(17,31,53,0.55)", maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)" }}>
      <div className="o-marquee flex w-max items-center gap-10">
        {itens.map((t, i) => (
          <span key={i} className={`${display.className} flex items-center gap-10 whitespace-nowrap text-2xl sm:text-3xl italic`} style={{ color: i % 3 === 0 ? C.goldLight : C.cream }}>
            {t}<Sparkles className="h-4 w-4 not-italic" style={{ color: C.gold }} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** Linha do tempo da oferta: o trilho enche com a rolagem e cada etapa acende ao passar. */
function LinhaOferta() {
  const ref = useRef<HTMLOListElement>(null);
  const [progresso, setProgresso] = useState(0);
  const [ativos, setAtivos] = useState(0);
  useEffect(() => {
    let raf = 0;
    const medir = () => {
      const el = ref.current;
      if (!el) return;
      const corte = window.innerHeight * 0.6;
      const box = el.getBoundingClientRect();
      setProgresso(Math.min(1, Math.max(0, (corte - box.top) / box.height)));
      setAtivos(Array.from(el.querySelectorAll<HTMLElement>("[data-item]")).filter((it) => it.getBoundingClientRect().top < corte).length);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(medir); };
    raf = requestAnimationFrame(medir);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);
  return (
    <ol ref={ref} className="relative">
      <span aria-hidden className="absolute left-[31px] top-2 bottom-2 w-px" style={{ background: C.lineSoft }} />
      <span aria-hidden className="absolute left-[31px] top-2 w-px transition-[height] duration-300"
        style={{ height: `calc((100% - 16px) * ${progresso})`, background: `linear-gradient(${C.goldLight}, ${C.gold})`, boxShadow: `0 0 16px ${C.gold}` }} />
      {ETAPAS.map((e, i) => {
        const on = i < ativos;
        return (
          <li key={e.titulo} data-item className="relative flex gap-6 sm:gap-8 pb-14 last:pb-0">
            <span className="relative z-10 flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border transition-all duration-700"
              style={{ borderColor: on ? `${C.gold}AA` : C.lineSoft, background: on ? `radial-gradient(circle at 30% 25%, #243A66, ${C.bg})` : C.bg, color: on ? C.goldLight : C.muted, boxShadow: on ? `0 0 36px -6px ${C.gold}` : "none", transform: on ? "rotate(0deg) scale(1)" : "rotate(-12deg) scale(.88)" }}>
              <e.icon className="h-6 w-6" />
            </span>
            <div className="pt-1 transition-all duration-700" style={{ opacity: on ? 1 : 0.35, transform: on ? "none" : "translateX(14px)" }}>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.26em]" style={{ color: C.gold }}>{e.quando}</p>
              <h3 className={`${display.className} mt-1 text-3xl sm:text-4xl font-semibold`} style={{ color: C.cream }}>{e.titulo}</h3>
              <p className="mt-2 max-w-lg text-sm sm:text-[15px] leading-relaxed" style={{ color: C.muted }}>{e.texto}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Card com inclinação 3D e reflexo que seguem o cursor. */
function Tilt({ children, className = "", style, forca = 9 }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; forca?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const mover = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * forca}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * forca}deg`);
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
    el.style.setProperty("--go", "1");
  };
  const soltar = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); el.style.setProperty("--go", "0");
  };
  return (
    <div ref={ref} onMouseMove={mover} onMouseLeave={soltar} className={`o-tilt relative ${className}`} style={style}>
      {children}
      <span aria-hidden className="o-glare pointer-events-none absolute inset-0 rounded-[inherit]" />
    </div>
  );
}

/** Estrutura: no desktop a seção fica presa e os cards correm na horizontal com a rolagem. */
function Estrutura() {
  const secao = useRef<HTMLElement>(null);
  const trilho = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState<number | null>(null);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    let raf = 0;
    const medir = () => {
      const s = secao.current, t = trilho.current;
      if (!s || !t) return;
      if (!mq.matches) { setAltura(null); t.style.transform = ""; return; }
      const sobra = t.scrollWidth - window.innerWidth;
      setAltura(window.innerHeight + Math.max(0, sobra));
      const top = s.getBoundingClientRect().top;
      const p = Math.min(1, Math.max(0, -top / Math.max(1, sobra)));
      t.style.transform = `translate3d(${-p * Math.max(0, sobra)}px,0,0)`;
      setPct(p);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(medir); };
    medir();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    mq.addEventListener("change", onScroll);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); mq.removeEventListener("change", onScroll); };
  }, []);
  return (
    <section ref={secao} id="estrutura" className="relative z-10" style={altura ? { height: altura } : undefined}>
      <div className={altura ? "sticky top-0 flex h-screen flex-col justify-center overflow-hidden" : "py-20 sm:py-28"}>
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <Revelar efeito="cortina">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>Toda a estrutura da V3</p>
            <h2 className={`${display.className} mt-4 max-w-3xl text-[40px] sm:text-6xl font-semibold leading-[1.02]`}>
              Tudo o que um banco tem. <em style={GOLD_TXT} className="q-gold-text">Liberado para você.</em>
            </h2>
          </Revelar>
        </div>
        <div className={altura ? "mt-12" : "mt-10 overflow-x-auto pb-4 [scrollbar-width:none] snap-x snap-mandatory"}>
          <div ref={trilho} className="flex w-max gap-5 px-4 sm:px-6 lg:px-[max(24px,calc((100vw-1152px)/2+24px))] will-change-transform">
            {ESTRUTURA.map((e, i) => (
              <Tilt key={e.titulo} className="snap-start w-[280px] sm:w-[340px] flex-shrink-0 rounded-3xl border p-7"
                style={{ borderColor: C.line, background: `linear-gradient(160deg, rgba(36,58,102,0.5), rgba(9,8,26,0.85))` }}>
                <p className={`${display.className} text-sm italic`} style={{ color: C.gold }}>{String(i + 1).padStart(2, "0")}</p>
                <span className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl border" style={{ borderColor: `${C.gold}66`, background: `${C.gold}12`, color: C.goldLight }}>
                  <e.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-6 text-xl font-bold" style={{ color: C.cream }}>{e.titulo}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: C.muted }}>{e.texto}</p>
              </Tilt>
            ))}
          </div>
        </div>
        {altura && (
          <div className="mx-auto mt-10 w-full max-w-6xl px-6">
            <div className="h-px w-full" style={{ background: C.lineSoft }}>
              <div className="h-px origin-left" style={{ transform: `scaleX(${pct})`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})`, boxShadow: `0 0 10px ${C.gold}` }} />
            </div>
            <p className="mt-3 text-[11px] uppercase tracking-[0.24em]" style={{ color: C.muted }}>
              {String(Math.min(ESTRUTURA.length, Math.max(1, Math.ceil(pct * ESTRUTURA.length)))).padStart(2, "0")} / {ESTRUTURA.length} · role para ver tudo
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

type Plano = { id: PlanoOferta; icone: typeof Crown; selo?: string; frase: string; itens: string[] };
const PLANOS: Plano[] = [
  { id: "gold", icone: Crown, frase: "Para começar a originar com a estrutura completa.",
    itens: ["Toda a estrutura da V3", "Comissão de 25% por operação", "Sem fidelidade: interrompa quando quiser"] },
  { id: "diamante", icone: Gem, selo: "Maior comissão mensal", frase: "Para quem já tem carteira e quer ganhar mais em cada operação.",
    itens: ["Toda a estrutura da V3", "Comissão de 40% por operação", "Sem fidelidade: interrompa quando quiser"] },
  { id: "partner_pro", icone: ShieldCheck, selo: "Garantia em contrato", frase: "Para quem vai a longo prazo, com o retorno garantido em contrato.",
    itens: ["Toda a estrutura da V3", "Comissão de 50% por operação", "Garantia de retorno do investimento em contrato"] },
];

function CardPlano({ p, delay, onEscolher }: { p: Plano; delay: number; onEscolher: (id: PlanoOferta) => void }) {
  const cfg = OFERTA.planos[p.id];
  const diamante = p.id === "diamante";
  const pro = p.id === "partner_pro";
  return (
    <Revelar delay={delay} efeito="zoom" className="h-full">
      <Tilt forca={7} className={`h-full rounded-[28px] ${diamante ? "o-prisma p-px" : ""}`}>
        <div className="relative flex h-full flex-col overflow-hidden rounded-[27px] border p-7 sm:p-8"
          style={{
            borderColor: diamante ? "transparent" : pro ? `${C.gold}55` : C.line,
            background: diamante ? `radial-gradient(120% 90% at 50% 0%, rgba(240,236,228,0.10), rgba(17,31,53,0.96) 45%, ${C.bg})` : `linear-gradient(170deg, rgba(36,58,102,0.45), rgba(9,8,26,0.92))`,
          }}>
          {diamante && <span aria-hidden className="o-facetas pointer-events-none absolute inset-0 opacity-60" />}
          <div className="relative flex items-center justify-between gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border"
              style={{ borderColor: diamante ? "rgba(240,236,228,0.45)" : `${C.gold}77`, background: diamante ? "rgba(240,236,228,0.08)" : `${C.gold}14`, color: diamante ? C.cream : C.goldLight }}>
              <p.icone className="h-5 w-5" />
            </span>
            {p.selo && (
              <span className="rounded-full border px-3 py-1 text-[9.5px] font-bold uppercase tracking-[0.18em]"
                style={{ borderColor: diamante ? "rgba(240,236,228,0.4)" : `${C.gold}66`, color: diamante ? C.cream : C.goldLight, background: "rgba(9,8,26,0.5)" }}>{p.selo}</span>
            )}
          </div>
          <h3 className={`${display.className} relative mt-6 text-[44px] font-semibold leading-none ${diamante ? "o-diamante-txt" : ""}`} style={diamante ? undefined : { color: C.cream }}>{cfg.nome}</h3>
          <p className="relative mt-2 min-h-[42px] text-sm leading-relaxed" style={{ color: C.muted }}>{p.frase}</p>
          <div className="relative mt-6 flex items-end gap-2">
            <span className="mb-2 text-lg" style={{ color: C.muted }}>R$</span>
            <span className={`${display.className} text-[64px] font-semibold leading-none`} style={{ color: C.cream }}><Conta ate={cfg.preco} /></span>
            <span className="mb-2 text-sm" style={{ color: C.muted }}>/{cfg.periodo}</span>
          </div>
          <p className="relative mt-1 text-xs" style={{ color: C.muted }}>{pro ? "Valor integral do ano" : `Depois dos ${OFERTA.trialDias} dias grátis`}</p>
          <div className="relative mt-6 rounded-2xl border px-5 py-4" style={{ borderColor: diamante ? "rgba(240,236,228,0.22)" : C.line, background: "rgba(9,8,26,0.55)" }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: C.muted }}>Sua comissão</p>
            <p className={`${display.className} mt-1 text-5xl font-semibold leading-none`} style={{ color: diamante ? C.cream : C.goldLight }}><Conta ate={cfg.comissao} sufixo="%" /></p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: C.lineSoft }}>
              <ComissaoBarra pct={cfg.comissao} claro={diamante} />
            </div>
          </div>
          <ul className="relative mt-6 flex-1 space-y-3 text-sm">
            {p.itens.map((x) => (
              <li key={x} className="flex items-start gap-3" style={{ color: C.cream }}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: diamante ? C.cream : C.gold }} /> {x}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => onEscolher(p.id)}
            className={`group relative mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl py-4 text-sm font-bold transition-all duration-300 hover:-translate-y-0.5 ${diamante || pro ? "q-btn" : "border hover:bg-[#C9A84C]/10"}`}
            style={diamante
              ? { background: `linear-gradient(135deg, ${C.cream}, #CFC6B4 55%, ${C.goldLight})`, color: C.bg }
              : pro ? { background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg } : { borderColor: `${C.gold}66`, color: C.goldLight }}>
            {pro ? "Quero o Partner PRO" : `Começar e seguir no ${cfg.nome}`}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </Tilt>
    </Revelar>
  );
}

function ComissaoBarra({ pct, claro }: { pct: number; claro?: boolean }) {
  const [ref, visivel] = useVisivel<HTMLDivElement>();
  return <div ref={ref} className="h-full rounded-full transition-[width] duration-[1600ms] ease-out" style={{ width: visivel ? `${pct * 2}%` : "0%", background: claro ? `linear-gradient(90deg, #A9B4C2, ${C.cream})` : `linear-gradient(90deg, ${C.gold}, ${C.goldLight})` }} />;
}

/** Simulador: arraste a receita da V3 na operação e veja a comissão de cada plano. */
function Simulador() {
  const [receita, setReceita] = useState(60000);
  const g = useTween(receita * 0.25, 600);
  const d = useTween(receita * 0.40, 600);
  const p = useTween(receita * 0.50, 600);
  const linhas = [
    { nome: "Gold", v: g, pct: 25, cor: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})` },
    { nome: "Diamante", v: d, pct: 40, cor: `linear-gradient(90deg, #A9B4C2, ${C.cream})` },
    { nome: "Partner PRO", v: p, pct: 50, cor: `linear-gradient(90deg, ${C.goldLight}, #FFF3D1)` },
  ];
  const min = 10000, max = 500000;
  const pos = ((receita - min) / (max - min)) * 100;
  return (
    <div className="rounded-3xl border p-6 sm:p-10" style={{ borderColor: C.line, background: "rgba(17,31,53,0.7)", boxShadow: `0 50px 120px -60px ${C.gold}` }}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>Receita da V3 na operação</p>
          <p className={`${display.className} mt-2 text-5xl sm:text-6xl font-semibold tabular-nums`}>{brl(receita)}</p>
        </div>
        <p className="max-w-xs text-xs leading-relaxed" style={{ color: C.muted }}>Arraste para simular. A comissão é um percentual da receita que a V3 recebe na operação que você originou.</p>
      </div>
      <input type="range" min={min} max={max} step={5000} value={receita} onChange={(e) => setReceita(Number(e.target.value))}
        aria-label="Receita da V3 na operação" className="o-range mt-8 w-full" style={{ "--pos": `${pos}%` } as React.CSSProperties} />
      <div className="mt-10 space-y-6">
        {linhas.map((l) => (
          <div key={l.nome}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold">{l.nome} <span className="ml-1 font-semibold" style={{ color: C.muted }}>{l.pct}%</span></p>
              <p className={`${display.className} text-3xl sm:text-4xl font-semibold tabular-nums`} style={{ color: C.cream }}>{brl(l.v)}</p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: C.lineSoft }}>
              <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${l.pct * 2}%`, background: l.cor, boxShadow: `0 0 18px -2px ${C.gold}` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-9 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border p-4" style={{ borderColor: C.lineSoft, background: "rgba(9,8,26,0.5)" }}>
          <p className="text-xs" style={{ color: C.muted }}>Nesta operação, o Diamante paga a mais que o Gold</p>
          <p className={`${display.className} mt-1 text-3xl font-semibold tabular-nums`} style={{ color: C.goldLight }}>+ {brl(d - g)}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ borderColor: C.lineSoft, background: "rgba(9,8,26,0.5)" }}>
          <p className="text-xs" style={{ color: C.muted }}>A diferença de mensalidade entre os dois é</p>
          <p className={`${display.className} mt-1 text-3xl font-semibold`} style={{ color: C.cream }}>{brl(OFERTA.planos.diamante.preco - OFERTA.planos.gold.preco)}<span className="text-base" style={{ color: C.muted }}>/mês</span></p>
        </div>
      </div>
      <p className="mt-4 text-[11px]" style={{ color: C.muted }}>Simulação ilustrativa. A receita de cada operação depende do produto, do porte e das condições aprovadas.</p>
    </div>
  );
}

/** Sem fidelidade: os meses se acendem em sequência, mostrando que você para quando quiser. */
const MESES = [
  { rot: "Mês 1", st: "gratis" }, { rot: "Mês 2", st: "pago" }, { rot: "Mês 3", st: "pago" },
  { rot: "Mês 4", st: "pausa" }, { rot: "Mês 5", st: "livre" }, { rot: "Mês 6", st: "livre" },
] as const;
function SemFidelidade() {
  const [ref, visivel] = useVisivel<HTMLDivElement>();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!visivel) return;
    const t = setInterval(() => setN((x) => (x >= MESES.length ? 0 : x + 1)), 700);
    return () => clearInterval(t);
  }, [visivel]);
  const info = {
    gratis: { txt: "Grátis", icon: Sparkles, cor: C.goldLight },
    pago: { txt: "Mensalidade", icon: CreditCard, cor: C.cream },
    pausa: { txt: "Interrompeu", icon: PauseCircle, cor: C.muted },
    livre: { txt: "Sem cobrança", icon: Lock, cor: C.muted },
  } as const;
  return (
    <div ref={ref} className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {MESES.map((m, i) => {
        const on = i < n;
        const I = info[m.st];
        const destaque = m.st === "gratis" || m.st === "pausa";
        return (
          <div key={m.rot} className="rounded-2xl border px-3 py-5 text-center transition-all duration-500"
            style={{ borderColor: on ? (destaque ? `${C.gold}88` : C.line) : C.lineSoft, background: on ? (m.st === "gratis" ? `${C.gold}18` : "rgba(17,31,53,0.7)") : "rgba(9,8,26,0.4)", transform: on ? "translateY(0)" : "translateY(8px)", opacity: on ? 1 : 0.4 }}>
            <I.icon className="mx-auto h-5 w-5" style={{ color: I.cor }} />
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: C.muted }}>{m.rot}</p>
            <p className="mt-1 text-sm font-bold" style={{ color: I.cor }}>{I.txt}</p>
          </div>
        );
      })}
    </div>
  );
}

// ─── Formulário ──────────────────────────────────────────────────────────────

function Formulario({ aberto, plano, onFechar, tracking }: { aberto: boolean; plano: PlanoOferta | null; onFechar: () => void; tracking: Record<string, string> }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [ddi, setDdi] = useState("+55");
  const [telefone, setTelefone] = useState("");
  const [escolha, setEscolha] = useState<PlanoOferta | "depois">(plano ?? "depois");
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [plano0, setPlano0] = useState(plano);
  if (plano !== plano0) { setPlano0(plano); setEscolha(plano ?? "depois"); }

  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; };
  }, [aberto, onFechar]);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (nome.trim().length < 3) return setErro("Informe o seu nome.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro("Informe um e-mail válido.");
    if (telefone.replace(/\D/g, "").length < 10) return setErro("Informe o WhatsApp com DDD.");
    if (!aceite) return setErro("Confirme que podemos falar com você.");
    setEnviando(true);
    try {
      const r = await fetch("/api/public/oferta", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nome.trim(), email: email.trim(), telefone: telefoneCompleto({ ddi, telefone }), plano: escolha === "depois" ? null : escolha, consentimento: true, tracking }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Não foi possível enviar. Tente novamente.");
      trackPixel("Lead", { content_name: "oferta_trial_30_dias", plano: escolha });
      setOk(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  };

  const opcoes: { v: PlanoOferta | "depois"; t: string }[] = [
    { v: "gold", t: "Gold" }, { v: "diamante", t: "Diamante" }, { v: "partner_pro", t: "Partner PRO" }, { v: "depois", t: "Decido depois" },
  ];

  return (
    <div className={`fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6 transition-all duration-500 ${aberto ? "visible" : "invisible"}`} aria-hidden={!aberto}>
      <div onClick={onFechar} className="absolute inset-0 transition-all duration-500" style={{ background: "rgba(9,8,26,0.72)", backdropFilter: aberto ? "blur(10px)" : "blur(0px)", opacity: aberto ? 1 : 0 }} />
      <div role="dialog" aria-modal="true" aria-label="Começar os 30 dias grátis"
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl border p-6 sm:p-9 transition-all duration-500"
        style={{ borderColor: `${C.gold}55`, background: `radial-gradient(120% 80% at 50% 0%, rgba(201,168,76,0.14), ${C.base} 50%, ${C.bg})`, boxShadow: `0 60px 140px -40px ${C.gold}`, opacity: aberto ? 1 : 0, transform: aberto ? "translateY(0) scale(1)" : "translateY(40px) scale(.96)", filter: aberto ? "blur(0)" : "blur(6px)" }}>
        <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${C.goldLight}, transparent)` }} />
        <button type="button" onClick={onFechar} aria-label="Fechar" className="absolute right-4 top-4 rounded-lg p-2 transition-colors hover:bg-white/5" style={{ color: C.muted }}><X className="h-5 w-5" /></button>

        {ok ? (
          <div className="py-6 text-center">
            <div className="relative mx-auto h-24 w-24">
              {Array.from({ length: 12 }, (_, i) => <span key={i} className="q-spark" style={{ "--a": `${i * 30}deg`, animationDelay: `${300 + i * 25}ms` } as React.CSSProperties} />)}
              <svg viewBox="0 0 100 100" className="h-24 w-24">
                <circle cx="50" cy="50" r="48" fill="none" stroke={C.gold} strokeWidth="2" className="q-seal-ring" />
                <path d="M30 52 L44 65 L71 37" fill="none" stroke={C.goldLight} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className="q-seal-check" />
              </svg>
            </div>
            <h3 className={`${display.className} mt-6 text-4xl font-semibold`}>Pedido recebido!</h3>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed" style={{ color: C.muted }}>
              Enviamos uma mensagem no seu WhatsApp. Nossa equipe vai falar com você para liberar o seu acesso aos {OFERTA.trialDias} dias grátis.
            </p>
            <button type="button" onClick={onFechar} className="mt-8 rounded-xl border px-6 py-3 text-sm font-bold" style={{ borderColor: C.line, color: C.goldLight }}>Fechar</button>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>Oferta única · {OFERTA.trialDias} dias grátis</p>
            <h3 className={`${display.className} mt-3 text-[34px] sm:text-4xl font-semibold leading-[1.05]`}>Comece agora. <em style={GOLD_TXT}>Escolha depois.</em></h3>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>Sem cartão. Leva menos de 1 minuto.</p>

            <div className="mt-7 space-y-4">
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: C.muted }}>Nome completo</span>
                <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" className="q-input mt-1.5 w-full rounded-xl border bg-transparent px-4 py-3.5 text-[15px] outline-none" style={{ borderColor: "rgba(240,236,228,0.14)", color: C.cream }} />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: C.muted }}>E-mail</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="q-input mt-1.5 w-full rounded-xl border bg-transparent px-4 py-3.5 text-[15px] outline-none" style={{ borderColor: "rgba(240,236,228,0.14)", color: C.cream }} />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: C.muted }}>WhatsApp</span>
                <div className="mt-1.5 flex gap-2">
                  <select value={ddi} onChange={(e) => setDdi(e.target.value)} aria-label="País" className="rounded-xl border px-2 py-3.5 text-sm outline-none" style={{ borderColor: "rgba(240,236,228,0.14)", color: C.cream, background: C.base }}>
                    {DDI_PAISES.map((p) => <option key={p.sigla} value={p.ddi}>{p.sigla} {p.ddi}</option>)}
                  </select>
                  <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" autoComplete="tel-national" placeholder={ddi === "+55" ? "(51) 99999-9999" : ""} className="q-input w-full rounded-xl border bg-transparent px-4 py-3.5 text-[15px] outline-none" style={{ borderColor: "rgba(240,236,228,0.14)", color: C.cream }} />
                </div>
              </label>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: C.muted }}>Depois dos 30 dias, pretendo seguir no</span>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {opcoes.map((o) => {
                    const on = escolha === o.v;
                    return (
                      <button key={o.v} type="button" onClick={() => setEscolha(o.v)} className="rounded-xl border px-3 py-3 text-sm font-bold transition-all duration-300"
                        style={{ borderColor: on ? C.gold : "rgba(240,236,228,0.14)", background: on ? `${C.gold}1F` : "transparent", color: on ? C.goldLight : C.cream, transform: on ? "scale(1.02)" : "none" }}>
                        {o.t}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-xs leading-relaxed" style={{ color: C.muted }}>
                <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#C9A84C]" />
                Autorizo a V3 Partners a falar comigo por WhatsApp e e-mail sobre a oferta, conforme a <a href="/politica-privacidade" target="_blank" className="underline" style={{ color: C.goldLight }}>política de privacidade</a>.
              </label>
            </div>
            {erro && <p className="mt-4 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "rgba(224,120,120,0.4)", color: "#E07878" }}>{erro}</p>}
            <button type="submit" disabled={enviando} className="q-btn mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl py-4 text-[15px] font-bold transition-all hover:brightness-110 disabled:opacity-70"
              style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg }}>
              {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando…</> : <>Quero meus 30 dias grátis <ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Página ──────────────────────────────────────────────────────────────────

const HEADLINE_A = ["30", "dias", "com", "a", "estrutura", "de", "um", "banco."];

export function OfertaLp() {
  const searchParams = useSearchParams();
  const [form, setForm] = useState<{ aberto: boolean; plano: PlanoOferta | null }>({ aberto: false, plano: null });
  const [faqAberto, setFaqAberto] = useState<number | null>(0);
  const [barra, setBarra] = useState(false);
  useEffect(() => {
    const onScroll = () => setBarra(window.scrollY > 700);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const tracking = useMemo(() => {
    const t: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]) {
      const v = searchParams.get(k);
      if (v) t[k] = v.slice(0, 200);
    }
    return t;
  }, [searchParams]);

  const abrir = (plano: PlanoOferta | null = null) => {
    trackPixel("InitiateCheckout", { content_name: "oferta_trial_30_dias", plano: plano ?? "indefinido" });
    setForm({ aberto: true, plano });
  };
  const fechar = useCallback(() => setForm((f) => ({ ...f, aberto: false })), []);

  return (
    <main className="relative min-h-screen overflow-x-clip" style={{ background: C.bg, color: C.cream }}>
      <style>{MOTION_CSS + `
        .o-rev { transition: opacity 1s cubic-bezier(.2,.7,.2,1), transform 1s cubic-bezier(.2,.7,.2,1), clip-path 1.1s cubic-bezier(.7,0,.2,1), filter 1s; }
        .o-sobe { opacity: 0; transform: translateY(34px); }
        .o-cortina { clip-path: inset(0 0 100% 0); transform: translateY(24px); }
        .o-zoom { opacity: 0; transform: translateY(40px) scale(.94); filter: blur(8px); }
        .o-rev.o-in { opacity: 1; transform: none; clip-path: inset(0 0 0 0); filter: none; }
        @keyframes o-curtain { 0%, 62% { clip-path: inset(0 0 0 0); } 100% { clip-path: inset(0 0 100% 0); } }
        @keyframes o-fade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes o-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        .o-curtain { animation: o-curtain 1.6s cubic-bezier(.76,0,.24,1) forwards; }
        .o-curtain-logo { opacity: 0; animation: o-fade .6s cubic-bezier(.2,.7,.1,1) .1s forwards; }
        .o-curtain-line { transform: scaleX(0); animation: o-grow .7s cubic-bezier(.7,0,.2,1) .3s forwards; }
        .o-curtain-txt { opacity: 0; animation: o-fade .5s ease .55s forwards; }
        @keyframes o-spin { to { transform: rotate(360deg); } }
        .o-orbit { animation: o-spin 9s linear infinite; }
        @keyframes o-marquee { to { transform: translateX(-50%); } }
        .o-marquee { animation: o-marquee 42s linear infinite; }
        .o-marquee:hover { animation-play-state: paused; }
        .o-mag { transition: transform .45s cubic-bezier(.2,.7,.1,1), filter .3s; }
        .o-mag:hover { filter: brightness(1.08); }
        .o-tilt { --rx: 0deg; --ry: 0deg; --gx: 50%; --gy: 50%; --go: 0; transform: perspective(1100px) rotateX(var(--rx)) rotateY(var(--ry)); transition: transform .5s cubic-bezier(.2,.7,.1,1); transform-style: preserve-3d; }
        .o-glare { background: radial-gradient(420px circle at var(--gx) var(--gy), rgba(232,201,122,.16), transparent 45%); opacity: var(--go); transition: opacity .4s; }
        .o-prisma { position: relative; overflow: hidden; isolation: isolate; }
        .o-prisma::before { content: ""; position: absolute; inset: -60%; z-index: -1; background: conic-gradient(from 0deg, #F0ECE4, #7A8FA8, #E8C97A, #F0ECE4, #243A66, #C9A84C, #F0ECE4); animation: o-spin 6s linear infinite; }
        .o-facetas { background: linear-gradient(115deg, transparent 30%, rgba(240,236,228,.10) 45%, transparent 55%), linear-gradient(245deg, transparent 40%, rgba(232,201,122,.08) 50%, transparent 62%); background-size: 250% 100%; animation: q-shine 6s ease-in-out infinite; }
        .o-diamante-txt { background: linear-gradient(100deg, #A9B4C2 0%, #F0ECE4 30%, #FFF3D1 45%, #E8C97A 60%, #F0ECE4 75%, #A9B4C2 100%); background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: q-shine 4.5s ease-in-out infinite; }
        .o-range { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 9999px; background: linear-gradient(90deg, #C9A84C 0, #E8C97A var(--pos), rgba(240,236,228,.1) var(--pos)); outline: none; }
        .o-range::-webkit-slider-thumb { -webkit-appearance: none; width: 26px; height: 26px; border-radius: 9999px; background: radial-gradient(circle at 35% 30%, #FFF3D1, #C9A84C); box-shadow: 0 0 0 6px rgba(201,168,76,.18), 0 0 24px #C9A84C; cursor: grab; transition: transform .2s; }
        .o-range::-webkit-slider-thumb:active { transform: scale(1.15); cursor: grabbing; }
        .o-range::-moz-range-thumb { width: 26px; height: 26px; border: 0; border-radius: 9999px; background: radial-gradient(circle at 35% 30%, #FFF3D1, #C9A84C); box-shadow: 0 0 0 6px rgba(201,168,76,.18), 0 0 24px #C9A84C; cursor: grab; }
        @media (prefers-reduced-motion: reduce) {
          .o-rev { opacity: 1 !important; transform: none !important; clip-path: none !important; filter: none !important; transition: none; }
          .o-orbit, .o-marquee, .o-prisma::before, .o-facetas, .o-diamante-txt { animation: none !important; }
          .o-tilt { transform: none !important; }
        }
      `}</style>
      <Abertura />
      <BarraProgresso />
      <Backdrop />

      {/* Barra fixa (desktop) */}
      <div className="fixed inset-x-0 top-0 z-40 hidden sm:block border-b backdrop-blur-xl transition-all duration-500"
        style={{ borderColor: C.line, background: "rgba(9,8,26,0.82)", transform: barra ? "translateY(0)" : "translateY(-110%)", opacity: barra ? 1 : 0 }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-4">
            <Image src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" width={52} height={32} className="h-7 w-auto object-contain" />
            <span className="hidden md:inline text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: C.gold }}>Oferta única · {OFERTA.trialDias} dias grátis</span>
          </div>
          <button type="button" onClick={() => abrir()} className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-5 py-2.5 text-sm font-bold transition-all hover:brightness-110"
            style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg }}>
            Começar grátis <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 py-5">
        <Image src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" width={72} height={44} className="h-10 w-auto object-contain" priority />
        <button type="button" onClick={() => abrir()} className="hidden sm:inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-colors hover:bg-[#C9A84C]/10"
          style={{ borderColor: C.line, color: C.gold }}>
          <CalendarCheck2 className="w-3.5 h-3.5" /> 30 dias grátis
        </button>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-6 sm:pt-14 pb-16 sm:pb-24">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <p className="q-rise inline-flex items-center gap-3 rounded-full border px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold, borderColor: C.line, background: "rgba(17,31,53,0.6)", animationDelay: "1450ms" }}>
              <Sparkles className="h-3.5 w-3.5" /> Oferta única V3 Partners
            </p>
            <h1 className={`${display.className} mt-6 text-[44px] leading-[1.0] sm:text-6xl lg:text-[78px] font-semibold tracking-[-0.01em]`}>
              {HEADLINE_A.map((w, i) => (
                <span key={i} className="q-word mr-[0.22em]" style={{ animationDelay: `${1500 + i * 70}ms` }}>{w}</span>
              ))}
              <br />
              <span className="q-word q-gold-text italic" style={{ animationDelay: `${1500 + HEADLINE_A.length * 70 + 80}ms`, ...GOLD_TXT }}>De graça.</span>
            </h1>
            <p className="q-rise mt-7 max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: C.muted, animationDelay: "2150ms" }}>
              Suba suas propostas na Mesa de Crédito, use a análise, os contratos e o time da V3 por <strong style={{ color: C.cream }}>30 dias sem pagar nada</strong>. Depois, escolha o seu plano ou cancele. <strong style={{ color: C.cream }}>Sem fidelidade.</strong>
            </p>
            <div className="q-rise mt-9 flex flex-col sm:flex-row sm:items-center gap-4" style={{ animationDelay: "2300ms" }}>
              <Magnetico onClick={() => abrir()} grande>Quero meus 30 dias grátis</Magnetico>
              <a href="#planos" className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:text-[#E8C97A]" style={{ color: C.muted }}>
                Ver os planos <ChevronDown className="h-4 w-4" />
              </a>
            </div>
            <div className="q-rise mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs" style={{ color: C.muted, animationDelay: "2450ms" }}>
              {[{ i: CreditCard, t: "Sem cartão para começar" }, { i: PauseCircle, t: "Cancele quando quiser" }, { i: BadgeCheck, t: "Toda a estrutura liberada" }].map((x) => (
                <span key={x.t} className="flex items-center gap-2"><x.i className="h-4 w-4" style={{ color: C.gold }} /> {x.t}</span>
              ))}
            </div>
          </div>
          <div className="q-rise" style={{ animationDelay: "1650ms" }}><Mostrador /></div>
        </div>
      </section>

      <div className="relative z-10"><Marquee /></div>

      {/* Manifesto */}
      <section className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 py-20 sm:py-32 text-center">
        <Revelar efeito="cortina">
          <p className={`${display.className} text-[30px] sm:text-[48px] leading-[1.12] font-medium`}>
            Você não precisa acreditar na V3. <em style={{ color: C.gold }}>Precisa usar.</em>
            <span className="block mt-3" style={{ color: C.muted }}>Por isso, os primeiros 30 dias são por nossa conta.</span>
          </p>
        </Revelar>
      </section>

      {/* Como funciona */}
      <section className="relative z-10 border-y" style={{ borderColor: C.line, background: "linear-gradient(180deg, rgba(17,31,53,0.65), rgba(9,8,26,0.4))" }}>
        <div className="mx-auto grid max-w-6xl gap-14 px-4 sm:px-6 py-20 sm:py-32 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Revelar>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>Como funciona</p>
              <h2 className={`${display.className} mt-4 text-[40px] sm:text-6xl font-semibold leading-[1.02]`}>
                Primeiro você usa. <em className="q-gold-text" style={GOLD_TXT}>Depois decide.</em>
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed" style={{ color: C.muted }}>
                Uma oferta simples: 30 dias com tudo liberado para subir propostas reais. No fim, você escolhe como seguir, ou não segue.
              </p>
              <div className="mt-8 hidden lg:block"><Magnetico onClick={() => abrir()}>Começar meu trial</Magnetico></div>
            </Revelar>
          </div>
          <LinhaOferta />
        </div>
      </section>

      <Estrutura />

      {/* Planos */}
      <section id="planos" className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-32">
        <Revelar className="text-center">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>Depois dos 30 dias</p>
          <h2 className={`${display.className} mx-auto mt-4 max-w-3xl text-[40px] sm:text-6xl font-semibold leading-[1.02]`}>
            Três caminhos. <em className="q-gold-text" style={GOLD_TXT}>A mesma estrutura.</em>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed" style={{ color: C.muted }}>
            Em todos os planos você tem a V3 inteira. O que muda é a sua comissão e a forma de pagar.
          </p>
        </Revelar>
        <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:items-stretch">
          {PLANOS.map((p, i) => <CardPlano key={p.id} p={p} delay={i * 140} onEscolher={(id) => abrir(id)} />)}
        </div>
        <Revelar delay={200}>
          <div className="mx-auto mt-10 flex max-w-3xl items-start gap-4 rounded-2xl border p-5 sm:p-6" style={{ borderColor: `${C.gold}44`, background: `${C.gold}0D` }}>
            <ShieldCheck className="mt-0.5 h-6 w-6 flex-shrink-0" style={{ color: C.goldLight }} />
            <p className="text-sm leading-relaxed" style={{ color: C.cream }}>
              <strong>Garantia do Partner PRO, em contrato:</strong> <span style={{ color: C.muted }}>mantido o KPI de originação definido em contrato, se não houver retorno sobre o valor investido, devolvemos o seu dinheiro.</span>
            </p>
          </div>
        </Revelar>
      </section>

      {/* Simulador */}
      <section className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 pb-20 sm:pb-32">
        <Revelar className="text-center">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>Faça a conta</p>
          <h2 className={`${display.className} mx-auto mt-4 max-w-3xl text-4xl sm:text-[56px] font-semibold leading-[1.04]`}>
            Quanto fica com você em <em style={{ color: C.gold }}>uma operação</em>.
          </h2>
        </Revelar>
        <Revelar efeito="zoom" delay={120} className="mt-12"><Simulador /></Revelar>
      </section>

      {/* Sem fidelidade */}
      <section className="relative z-10 border-y" style={{ borderColor: C.line, background: "rgba(17,31,53,0.55)" }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <Revelar>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>Gold e Diamante</p>
              <h2 className={`${display.className} mt-4 text-[40px] sm:text-[56px] font-semibold leading-[1.02]`}>
                Sem fidelidade. <em className="q-gold-text" style={GOLD_TXT}>Sem multa.</em>
              </h2>
              <p className="mt-6 max-w-md text-base leading-relaxed" style={{ color: C.muted }}>
                Você paga a mensalidade do mês. Se no próximo quiser interromper, interrompe. Acabou o trial e não quer seguir? Cancela, sem custo nenhum.
              </p>
            </Revelar>
            <Revelar delay={150}><SemFidelidade /></Revelar>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-32">
        <Revelar efeito="zoom">
          <div className="relative overflow-hidden rounded-[32px] border px-7 py-16 sm:px-14 sm:py-24 text-center"
            style={{ borderColor: `${C.gold}55`, background: `radial-gradient(120% 140% at 50% 0%, rgba(201,168,76,0.2), rgba(17,31,53,0.7) 45%, rgba(9,8,26,0.95))`, boxShadow: `0 60px 160px -60px ${C.gold}` }}>
            <span aria-hidden className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${C.goldLight}, transparent)` }} />
            <div aria-hidden className="o-orbit absolute left-1/2 top-1/2 -ml-[340px] -mt-[340px] h-[680px] w-[680px] rounded-full border opacity-40" style={{ borderColor: C.lineSoft }}>
              <span className="absolute left-1/2 -top-1 h-2 w-2 rounded-full" style={{ background: C.goldLight, boxShadow: `0 0 14px ${C.gold}` }} />
            </div>
            <p className="relative text-[10.5px] font-bold uppercase tracking-[0.28em]" style={{ color: C.gold }}>Oferta única</p>
            <h2 className={`${display.className} relative mx-auto mt-4 max-w-3xl text-[42px] sm:text-[68px] font-semibold leading-[1.0]`}>
              A estrutura está pronta. <em className="q-gold-text" style={GOLD_TXT}>Os 30 dias começam quando você quiser.</em>
            </h2>
            <p className="relative mx-auto mt-6 max-w-xl text-base sm:text-lg leading-relaxed" style={{ color: C.muted }}>
              Deixe seu contato e a equipe da V3 libera o seu acesso.
            </p>
            <div className="relative mt-10 flex justify-center"><Magnetico onClick={() => abrir()} grande>Quero meus 30 dias grátis</Magnetico></div>
            <p className="relative mt-5 flex items-center justify-center gap-2 text-[11px]" style={{ color: C.muted }}>
              <Clock3 className="w-3.5 h-3.5" /> Leva menos de 1 minuto · sem cartão
            </p>
          </div>
        </Revelar>
      </section>

      {/* FAQ */}
      <section className="relative z-10 mx-auto max-w-3xl px-4 sm:px-6 pb-24">
        <Revelar><h2 className={`${display.className} text-3xl sm:text-4xl font-semibold`}>Perguntas frequentes</h2></Revelar>
        <div className="mt-8 divide-y border-y" style={{ borderColor: C.lineSoft }}>
          {FAQ.map((f, i) => (
            <div key={f.p} style={{ borderColor: C.lineSoft }}>
              <button onClick={() => setFaqAberto(faqAberto === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left">
                <span className="text-[15px] font-semibold">{f.p}</span>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${faqAberto === i ? "rotate-180" : ""}`} style={{ color: C.gold }} />
              </button>
              <div className="grid transition-all duration-300" style={{ gridTemplateRows: faqAberto === i ? "1fr" : "0fr" }}>
                <p className="overflow-hidden text-sm leading-relaxed" style={{ color: C.muted }}><span className="block pb-5">{f.r}</span></p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t py-8 text-center text-[11px]" style={{ borderColor: C.lineSoft, color: C.muted }}>
        V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · <a href="https://v3partners.com.br" className="hover:underline">v3partners.com.br</a>
      </footer>

      {/* CTA fixo no celular */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t p-3 backdrop-blur-md sm:hidden" style={{ borderColor: C.line, background: "rgba(9,8,26,0.85)" }}>
        <button type="button" onClick={() => abrir()} className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold"
          style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg }}>
          Quero meus 30 dias grátis <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <div className="h-20 sm:hidden" />

      <Formulario aberto={form.aberto} plano={form.plano} onFechar={fechar} tracking={tracking} />
    </main>
  );
}
