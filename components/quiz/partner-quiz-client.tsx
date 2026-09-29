"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Cormorant_Garamond } from "next/font/google";
import { ArrowRight, ArrowLeft, Clock3, Check, MessageCircle, ShieldCheck } from "lucide-react";
import { maskPhone } from "./wizard-ui";
import { trackPixel } from "./meta-pixel";
import {
  OBJETIVO, OCUPACAO, RENDA_FAIXA, EXPERIENCIA_B2B, PRIORIDADE, INVESTIMENTO,
  type QuizOption,
} from "@/lib/quiz-partner";

// Display serifado do manual de marca V4.2 — só nos títulos grandes; o resto é DM Sans.
const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], style: ["normal", "italic"], display: "swap" });

const C = {
  bg: "#09081A",
  base: "#111F35",
  card: "#162744",
  gold: "#C9A84C",
  goldLight: "#E8C97A",
  cream: "#F0ECE4",
  muted: "#7A8FA8",
  line: "rgba(201,168,76,0.18)",
  lineSoft: "rgba(240,236,228,0.08)",
};

// Roteiro do PDF "Landing Page / Hero": 5 passos. O Passo 4 (contato, perfil
// financeiro & prioridade) é mostrado em 4 telas curtas, todas como "Passo 4".
type Step =
  | "intro" | "objetivo" | "ocupacao" | "nome"
  | "contato" | "renda" | "experiencia" | "prioridade"
  | "investimento" | "enviando" | "concluido";

const FLOW: Step[] = ["intro", "objetivo", "ocupacao", "nome", "contato", "renda", "experiencia", "prioridade", "investimento", "concluido"];
const PASSO: Partial<Record<Step, number>> = {
  objetivo: 1, ocupacao: 2, nome: 3, contato: 4, renda: 4, experiencia: 4, prioridade: 4, investimento: 5, enviando: 5,
};
const PASSO_TITULO: Record<number, string> = {
  1: "Momento atual",
  2: "Atuação profissional",
  3: "Identificação inicial",
  4: "Contato, perfil financeiro & prioridade",
  5: "Modalidade & capacidade de investimento",
};

// WhatsApp do time comercial V3 — botão da tela final quando o link não veio de
// um partner (?ref=). Pode ser trocado pela env NEXT_PUBLIC_QUIZ_WHATSAPP.
const WHATSAPP_V3 = (process.env.NEXT_PUBLIC_QUIZ_WHATSAPP || "5511937639475").replace(/\D/g, "");

const LETRAS = "ABCDEFGH";
const SAIDA_MS = 320;

interface FormState {
  objetivo: string; ocupacao: string; nome: string;
  telefone: string; email: string; renda_faixa: string; experiencia_b2b: string; prioridade: string;
  investimento: string; consentimento: boolean;
}
const INITIAL: FormState = {
  objetivo: "", ocupacao: "", nome: "",
  telefone: "", email: "", renda_faixa: "", experiencia_b2b: "", prioridade: "",
  investimento: "", consentimento: false,
};

// ─── Movimento (CSS puro, respeita "reduzir movimento" do sistema) ────────────
const MOTION_CSS = `
@keyframes q-word { from { opacity: 0; transform: translateY(0.45em); filter: blur(10px); } to { opacity: 1; transform: none; filter: blur(0); } }
@keyframes q-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
@keyframes q-line { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes q-leave { to { opacity: 0; transform: translateY(-14px); filter: blur(8px); } }
@keyframes q-shine { 0% { background-position: -150% 0; } 60%, 100% { background-position: 250% 0; } }
@keyframes q-sweep { 0% { transform: translateX(-120%) skewX(-18deg); } 55%, 100% { transform: translateX(260%) skewX(-18deg); } }
@keyframes q-drift-a { 0% { transform: translate(-50%, 0) scale(1); } 100% { transform: translate(-42%, 60px) scale(1.12); } }
@keyframes q-drift-b { 0% { transform: translate(0, 0) scale(1); } 100% { transform: translate(-80px, -50px) scale(1.15); } }
@keyframes q-pop { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.18); opacity: 1; } 100% { transform: scale(1); } }
@keyframes q-ring { 0% { box-shadow: 0 0 0 0 rgba(201,168,76,0.55); } 100% { box-shadow: 0 0 0 14px rgba(201,168,76,0); } }
@keyframes q-draw { to { stroke-dashoffset: 0; } }
@keyframes q-spark { 0% { opacity: 0; transform: rotate(var(--a)) translateY(0) scale(0.4); } 25% { opacity: 1; } 100% { opacity: 0; transform: rotate(var(--a)) translateY(-120px) scale(1); } }
@keyframes q-breathe { 0%, 100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }
@keyframes q-dots { 0%, 80%, 100% { opacity: 0.2; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-6px); } }
.q-word { display: inline-block; opacity: 0; animation: q-word .7s cubic-bezier(.2,.7,.1,1) forwards; }
.q-rise { opacity: 0; animation: q-rise .7s cubic-bezier(.2,.7,.1,1) forwards; }
.q-line { transform-origin: left; transform: scaleX(0); animation: q-line .9s cubic-bezier(.2,.7,.1,1) forwards; }
.q-leave { animation: q-leave ${SAIDA_MS}ms cubic-bezier(.4,0,.6,1) forwards; }
.q-gold-text { background: linear-gradient(100deg, #C9A84C 0%, #E8C97A 35%, #FFF3D1 50%, #E8C97A 65%, #C9A84C 100%); background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; animation: q-shine 5.5s ease-in-out 1.2s infinite; }
.q-btn { position: relative; overflow: hidden; isolation: isolate; }
.q-btn::after { content: ""; position: absolute; inset: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); transform: translateX(-120%) skewX(-18deg); animation: q-sweep 4.2s ease-in-out 1.5s infinite; z-index: -1; }
.q-opt { transition: transform .35s cubic-bezier(.2,.7,.1,1), border-color .25s, background .35s, box-shadow .35s; }
.q-opt:hover { transform: translateX(6px); }
.q-opt .q-key { transition: transform .35s cubic-bezier(.2,.7,.1,1), background .25s, color .25s, border-color .25s; }
.q-opt:hover .q-key { transform: scale(1.08); }
.q-opt[data-on="true"] .q-key { animation: q-ring .7s ease-out; }
.q-check { animation: q-pop .45s cubic-bezier(.2,.9,.2,1.2) both; }
.q-input { transition: border-color .3s; background-image: linear-gradient(#C9A84C, #C9A84C); background-size: 0% 2px; background-repeat: no-repeat; background-position: 0 100%; transition: background-size .5s cubic-bezier(.2,.7,.1,1), border-color .3s; }
.q-input:focus { background-size: 100% 2px; }
.q-glow-a { animation: q-drift-a 16s ease-in-out infinite alternate; }
.q-glow-b { animation: q-drift-b 20s ease-in-out infinite alternate; }
.q-seal-ring { stroke-dasharray: 302; stroke-dashoffset: 302; animation: q-draw 1.1s cubic-bezier(.6,0,.2,1) .15s forwards; }
.q-seal-check { stroke-dasharray: 60; stroke-dashoffset: 60; animation: q-draw .55s cubic-bezier(.6,0,.2,1) 1.05s forwards; }
.q-spark { position: absolute; left: 50%; top: 50%; width: 5px; height: 5px; margin: -2.5px; border-radius: 9999px; background: #E8C97A; box-shadow: 0 0 10px #C9A84C; opacity: 0; animation: q-spark 1.4s cubic-bezier(.2,.7,.1,1) forwards; }
.q-breathe { animation: q-breathe 3.2s ease-in-out infinite; }
.q-dot { display: inline-block; width: 8px; height: 8px; border-radius: 9999px; background: #C9A84C; animation: q-dots 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .q-word, .q-rise, .q-line, .q-leave, .q-check, .q-seal-ring, .q-seal-check, .q-spark { animation-duration: 1ms !important; animation-delay: 0ms !important; }
  .q-gold-text, .q-btn::after, .q-glow-a, .q-glow-b, .q-breathe, .q-dot { animation: none !important; }
  .q-opt:hover { transform: none; }
}
`;

// ─── Peças visuais ────────────────────────────────────────────────────────────

function Backdrop() {
  const ref = useRef<HTMLDivElement>(null);
  // Luz que segue o cursor (desktop).
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${e.clientX}px`);
        el.style.setProperty("--my", `${e.clientY}px`);
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ "--mx": "50%", "--my": "-20%" } as React.CSSProperties}>
      <div className="q-glow-a absolute -top-72 left-1/2 w-[1000px] h-[1000px] rounded-full"
        style={{ background: `radial-gradient(closest-side, ${C.gold}24, transparent 70%)` }} />
      <div className="q-glow-b absolute -bottom-72 -right-48 w-[760px] h-[760px] rounded-full"
        style={{ background: `radial-gradient(closest-side, #243A6670, transparent 70%)` }} />
      <div className="absolute inset-0 opacity-[0.035]"
        style={{ backgroundImage: `linear-gradient(${C.cream} 1px, transparent 1px), linear-gradient(90deg, ${C.cream} 1px, transparent 1px)`, backgroundSize: "64px 64px", maskImage: "radial-gradient(ellipse at 50% 30%, black 20%, transparent 75%)" }} />
      <div className="absolute inset-0"
        style={{ background: `radial-gradient(420px circle at var(--mx) var(--my), ${C.gold}14, transparent 60%)` }} />
    </div>
  );
}

function Eyebrow({ children, delay = 0, center }: { children: React.ReactNode; delay?: number; center?: boolean }) {
  return (
    <p className={`q-rise flex items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.28em] ${center ? "justify-center" : ""}`}
      style={{ color: C.gold, animationDelay: `${delay}ms` }}>
      <span className="q-line h-px w-8" style={{ background: C.gold, animationDelay: `${delay + 100}ms` }} />
      {children}
    </p>
  );
}

// Título revelado palavra por palavra. `destaque` sai em itálico dourado.
function Pergunta({ antes = "", destaque = "", depois = "", className = "", delay = 120, as = "h2" }: {
  antes?: string; destaque?: string; depois?: string; className?: string; delay?: number; as?: "h1" | "h2";
}) {
  const partes: { w: string; em: boolean }[] = [
    ...antes.split(/\s+/).filter(Boolean).map((w) => ({ w, em: false })),
    ...destaque.split(/\s+/).filter(Boolean).map((w) => ({ w, em: true })),
    ...depois.split(/\s+/).filter(Boolean).map((w) => ({ w, em: false })),
  ];
  const Tag = as;
  return (
    <Tag className={`${display.className} font-semibold leading-[1.1] text-[34px] sm:text-[48px] ${className}`} style={{ color: C.cream }}>
      {partes.map((p, i) => (
        <span key={i}>
          <span className={`q-word ${p.em ? "italic" : ""}`} style={{ animationDelay: `${delay + i * 55}ms`, color: p.em ? C.goldLight : undefined }}>
            {p.w}
          </span>{i < partes.length - 1 ? " " : ""}
        </span>
      ))}
    </Tag>
  );
}

function Opcoes({ options, selected, onSelect, delay = 380 }: {
  options: QuizOption[]; selected?: string; onSelect: (v: string) => void; delay?: number;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {options.map((o, i) => {
        const active = selected === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onSelect(o.value)} data-on={active}
            className="q-rise q-opt group w-full flex items-center gap-4 text-left rounded-2xl border px-4 sm:px-5 py-4"
            style={{
              animationDelay: `${delay + i * 75}ms`,
              background: active ? `linear-gradient(90deg, ${C.gold}26, ${C.gold}08)` : "rgba(22,39,68,0.5)",
              borderColor: active ? C.gold : C.lineSoft,
              boxShadow: active ? `0 0 0 1px ${C.gold}55, 0 12px 34px -12px ${C.gold}66` : "none",
              backdropFilter: "blur(6px)",
            }}>
            <span className="q-key w-8 h-8 shrink-0 rounded-lg border flex items-center justify-center text-[11px] font-bold"
              style={{
                borderColor: active ? C.gold : "rgba(201,168,76,0.35)",
                background: active ? C.gold : "transparent",
                color: active ? C.bg : C.gold,
              }}>
              {active ? <Check className="q-check w-4 h-4" strokeWidth={3} /> : LETRAS[i]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold leading-snug" style={{ color: C.cream }}>{o.label}</span>
              {o.hint && <span className="block text-[13px] italic leading-snug mt-1" style={{ color: C.muted }}>{o.hint}</span>}
            </span>
            <ArrowRight className="w-4 h-4 shrink-0 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" style={{ color: C.gold }} />
          </button>
        );
      })}
      <p className="q-rise hidden sm:block text-[11px] mt-2" style={{ color: C.muted, animationDelay: `${delay + options.length * 75 + 100}ms` }}>
        Dica: pressione a letra da opção no teclado.
      </p>
    </div>
  );
}

function Campo({ label, children, delay = 0 }: { label: string; children: React.ReactNode; delay?: number }) {
  return (
    <label className="q-rise block" style={{ animationDelay: `${delay}ms` }}>
      <span className="block text-[10.5px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: C.gold }}>{label}</span>
      {children}
    </label>
  );
}

const inputPremium =
  "q-input w-full bg-transparent border-0 border-b-2 px-0 py-3 text-xl sm:text-2xl outline-none placeholder:text-[#7A8FA8]/50";
const inputPremiumStyle = { color: C.cream, borderColor: "rgba(240,236,228,0.14)" } as const;

function BotaoOuro({ children, onClick, disabled, type = "button" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit";
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="q-btn group inline-flex items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-[15px] font-bold transition-all duration-300 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-30 disabled:hover:translate-y-0 disabled:cursor-not-allowed w-full sm:w-auto"
      style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg, boxShadow: `0 16px 44px -14px ${C.gold}` }}>
      {children}
    </button>
  );
}

function Voltar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="group inline-flex items-center justify-center gap-2 text-[13px] font-semibold transition-colors hover:text-[#F0ECE4]" style={{ color: C.muted }}>
      <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" /> Voltar
    </button>
  );
}

// Contador animado do hero: 0 → 21 trilhões.
function Contador({ ate, duracao = 1700, delay = 350 }: { ate: number; duracao?: number; delay?: number }) {
  const [semMovimento] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [v, setV] = useState(semMovimento ? ate : 0);
  useEffect(() => {
    if (semMovimento) return;
    let raf = 0;
    let inicio = 0;
    const t = window.setTimeout(() => {
      const tick = (now: number) => {
        if (!inicio) inicio = now;
        const p = Math.min(1, (now - inicio) / duracao);
        setV(Math.round(ate * (1 - Math.pow(1 - p, 4))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { window.clearTimeout(t); cancelAnimationFrame(raf); };
  }, [ate, duracao, delay, semMovimento]);
  return <>{v}</>;
}

function SeloAprovado() {
  const faiscas = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className="relative mx-auto w-28 h-28 mb-8">
      <div className="q-breathe absolute -inset-6 rounded-full" style={{ background: `radial-gradient(closest-side, ${C.gold}40, transparent)` }} />
      {faiscas.map((i) => (
        <span key={i} className="q-spark" style={{ "--a": `${(360 / faiscas.length) * i}deg`, animationDelay: `${1150 + (i % 3) * 60}ms` } as React.CSSProperties} />
      ))}
      <svg viewBox="0 0 112 112" className="relative w-28 h-28">
        <circle cx="56" cy="56" r="48" fill={`${C.gold}14`} />
        <circle className="q-seal-ring" cx="56" cy="56" r="48" fill="none" stroke={C.gold} strokeWidth="2" transform="rotate(-90 56 56)" />
        <path className="q-seal-check" d="M36 57 L50 71 L77 43" fill="none" stroke={C.goldLight} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ─── Quiz ─────────────────────────────────────────────────────────────────────

export function PartnerQuizClient() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") ?? "";

  // Captura de origem do tráfego (anúncios Meta/Google etc.) — só o que vier na URL.
  const tracking = useMemo(() => {
    const keys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    const t: Record<string, string> = {};
    for (const k of keys) {
      const v = searchParams.get(k);
      if (v) t[k] = v.slice(0, 200);
    }
    if (typeof document !== "undefined" && document.referrer) t.referrer = document.referrer.slice(0, 300);
    return Object.keys(t).length ? t : null;
  }, [searchParams]);

  const [partner, setPartner] = useState<{ full_name: string | null; whatsapp: string | null } | null>(null);
  useEffect(() => {
    if (!ref) return;
    fetch(`/api/public/partner-card?id=${encodeURIComponent(ref)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPartner(d))
      .catch(() => {});
  }, [ref]);

  const [step, setStep] = useState<Step>("intro");
  const [saindo, setSaindo] = useState(false);
  const historyRef = useRef<Step[]>([]);
  const trocandoRef = useRef(false);

  // ── Rastreio de funil: reporta cada passo alcançado (1x por sessão) ──
  const sessionIdRef = useRef<string>("");
  const reportedRef = useRef<Set<string>>(new Set());
  if (!sessionIdRef.current && typeof crypto !== "undefined") {
    sessionIdRef.current = (crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2));
  }
  useEffect(() => {
    const sid = sessionIdRef.current;
    if (!sid || step === "enviando" || reportedRef.current.has(step)) return;
    reportedRef.current.add(step);
    const idx = FLOW.indexOf(step);
    try {
      fetch("/api/public/quiz-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          session_id: sid, quiz: "seja_partner", step, step_index: idx < 0 ? 99 : idx,
          ref: ref || null, utm: tracking,
        }),
      }).catch(() => {});
    } catch { /* ignora */ }
  }, [step, ref, tracking]);

  const [form, setForm] = useState<FormState>(INITIAL);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Troca de tela com animação de saída antes de montar a próxima.
  const trocar = useCallback((next: Step, empilhar: boolean) => {
    if (trocandoRef.current) return;
    trocandoRef.current = true;
    setSaindo(true);
    window.setTimeout(() => {
      setStep((atual) => {
        if (empilhar) historyRef.current.push(atual);
        return next;
      });
      setSaindo(false);
      trocandoRef.current = false;
      window.scrollTo({ top: 0 });
    }, SAIDA_MS);
  }, []);
  const goTo = useCallback((next: Step) => trocar(next, true), [trocar]);
  function goBack() {
    const prev = historyRef.current.pop();
    if (prev) trocar(prev, false);
  }
  function reiniciar() {
    setForm(INITIAL); historyRef.current = []; setSubmitError(null); trocar("intro", false);
  }

  // Seleção com um respiro para o candidato ver a opção marcada antes de avançar.
  const escolher = useCallback(<K extends keyof FormState>(k: K, v: FormState[K], next: Step) => {
    if (trocandoRef.current) return;
    setForm((f) => ({ ...f, [k]: v }));
    window.setTimeout(() => goTo(next), 380);
  }, [goTo]);

  const partnerName = partner?.full_name ?? null;
  const waNumero = partner?.whatsapp ? `55${partner.whatsapp.replace(/\D/g, "")}` : WHATSAPP_V3;
  const waLink = `https://wa.me/${waNumero}?text=${encodeURIComponent(
    `Olá! Sou ${form.nome.trim() || "candidato(a)"} e minha aplicação para Partner V3 foi pré-aprovada. Quero agendar a apresentação estratégica.`,
  )}`;

  const nomeValid = form.nome.trim().length >= 3;
  const contatoValid = form.telefone.replace(/\D/g, "").length >= 10 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && form.consentimento;

  const finalizar = useCallback(async (investimento: string) => {
    if (trocandoRef.current) return;
    setSubmitError(null);
    setForm((f) => ({ ...f, investimento }));
    const minimo = new Promise((r) => setTimeout(r, 2000));
    window.setTimeout(() => trocar("enviando", false), 380);
    try {
      const res = await fetch("/api/public/partner-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: ref || null,
          objetivo: form.objetivo, ocupacao: form.ocupacao,
          renda_faixa: form.renda_faixa, experiencia_b2b: form.experiencia_b2b,
          prioridade: form.prioridade, investimento,
          nome: form.nome.trim(), email: form.email.trim(), telefone: form.telefone,
          tracking,
          consentimento: true,
        }),
      });
      const json = await res.json();
      await minimo;
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar a aplicação");
      trackPixel("Lead", { content_name: "quiz_seja_partner", tier: json.tier, currency: "BRL", value: 0 });
      historyRef.current = [];
      trocar("concluido", false);
    } catch (e) {
      await minimo;
      setSubmitError((e as Error).message);
      trocar("investimento", false);
    }
  }, [form, ref, tracking, trocar]);

  // Opções de cada tela de múltipla escolha (também usadas no atalho A/B/C…).
  const opcoesDoPasso = useMemo((): { list: QuizOption[]; pick: (v: string) => void; selected: string } | null => {
    switch (step) {
      case "objetivo": return { list: OBJETIVO, selected: form.objetivo, pick: (v) => escolher("objetivo", v, "ocupacao") };
      case "ocupacao": return { list: OCUPACAO, selected: form.ocupacao, pick: (v) => escolher("ocupacao", v, "nome") };
      case "renda": return { list: RENDA_FAIXA, selected: form.renda_faixa, pick: (v) => escolher("renda_faixa", v, "experiencia") };
      case "experiencia": return { list: EXPERIENCIA_B2B, selected: form.experiencia_b2b, pick: (v) => escolher("experiencia_b2b", v, "prioridade") };
      case "prioridade": return { list: PRIORIDADE, selected: form.prioridade, pick: (v) => escolher("prioridade", v, "investimento") };
      case "investimento": return { list: INVESTIMENTO, selected: form.investimento, pick: (v) => { finalizar(v); } };
      default: return null;
    }
  }, [step, form, escolher, finalizar]);
  useEffect(() => {
    if (!opcoesDoPasso) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const i = LETRAS.indexOf(e.key.toUpperCase());
      if (i >= 0 && i < opcoesDoPasso.list.length) opcoesDoPasso.pick(opcoesDoPasso.list[i].value);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opcoesDoPasso]);

  const passo = PASSO[step];
  const idx = FLOW.indexOf(step === "enviando" ? "investimento" : step);
  const progressPct = step === "intro" ? 0 : step === "concluido" ? 100 : Math.max(4, (idx / (FLOW.length - 1)) * 100);
  const primeiroNome = form.nome.trim().split(/\s+/)[0] ?? "";

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden" style={{ background: C.bg, color: C.cream }}>
      <style>{MOTION_CSS}</style>
      <Backdrop />

      {/* ── Topo ── */}
      <header className="relative z-10">
        <div className="h-[2px] w-full" style={{ background: C.lineSoft }}>
          <div className="h-full transition-[width] duration-700 ease-[cubic-bezier(.2,.7,.1,1)]"
            style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})`, boxShadow: `0 0 14px ${C.gold}` }} />
        </div>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" width={72} height={44} className="h-11 w-auto object-contain" priority />
          </div>
          {passo ? (
            <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wider" style={{ color: C.muted }}>
              Passo
              <span className="relative inline-flex h-4 w-3 overflow-hidden justify-center">
                <span key={passo} className="q-rise tabular-nums" style={{ color: C.gold }}>{passo}</span>
              </span>
              de 5
            </span>
          ) : (
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: C.muted }}>
              <ShieldCheck className="w-3.5 h-3.5" style={{ color: C.gold }} /> Aplicação confidencial
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-start sm:items-center">
        <div key={step} className={`w-full max-w-3xl mx-auto px-5 sm:px-8 pt-8 pb-16 sm:py-14 ${saindo ? "q-leave" : ""}`}>

          {/* ── Hero (Tela Inicial) ── */}
          {step === "intro" && (
            <section className="max-w-2xl">
              <Eyebrow>Aplicação de elegibilidade · Seja Partner V3</Eyebrow>
              <div className="mt-8 mb-8">
                <p className={`q-rise ${display.className} italic text-[22px] sm:text-[26px]`} style={{ color: C.goldLight, animationDelay: "150ms" }}>mais de</p>
                <p className={`q-rise ${display.className} font-semibold leading-none tracking-tight text-[68px] sm:text-[116px]`}
                  style={{ animationDelay: "250ms", fontVariantNumeric: "lining-nums tabular-nums" }}>
                  <span className="q-gold-text">R$ <Contador ate={21} /> trilhões</span>
                </p>
                <p className="q-rise text-[11px] font-bold uppercase tracking-[0.22em] mt-3" style={{ color: C.muted, animationDelay: "450ms" }}>
                  movimentados na intermediação de crédito
                </p>
              </div>

              <div className="q-line h-px w-full mb-8" style={{ background: `linear-gradient(90deg, ${C.gold}88, transparent)`, animationDelay: "600ms" }} />

              <p className="q-rise text-[17px] sm:text-[19px] leading-relaxed" style={{ color: C.cream, animationDelay: "750ms" }}>
                O mercado de intermediação de crédito movimenta mais de R$ 21 trilhões de reais entre bancos
                tradicionais e instituições privadas. Esta é a sua oportunidade de entrar nesse mercado e faturar
                comissões de alto valor.
              </p>
              <p className="q-rise mt-5 text-[15px] leading-relaxed" style={{ color: C.muted, animationDelay: "900ms" }}>
                Clique no botão abaixo para preencher a aplicação de elegibilidade. Caso seja aprovado(a), um dos
                nossos diretores entrará em contato.
              </p>

              {partnerName && (
                <p className="q-rise mt-6 text-[13px]" style={{ color: C.goldLight, animationDelay: "1000ms" }}>Convite de {partnerName} — Partner V3</p>
              )}

              <p className="q-rise mt-10 flex items-center gap-2 text-[13px] font-semibold" style={{ color: C.muted, animationDelay: "1050ms" }}>
                <Clock3 className="w-4 h-4" style={{ color: C.gold }} /> Leva 1 minuto
              </p>
              <div className="q-rise mt-4" style={{ animationDelay: "1150ms" }}>
                <BotaoOuro onClick={() => goTo("objetivo")}>
                  Aplicar Agora <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </BotaoOuro>
              </div>
            </section>
          )}

          {/* ── Passos de múltipla escolha ── */}
          {opcoesDoPasso && (
            <section>
              <Eyebrow>Passo {passo} · {PASSO_TITULO[passo ?? 1]}</Eyebrow>

              {step === "objetivo" && <Pergunta className="mt-5 mb-9" antes="O que mais representa o seu" destaque="momento atual?" />}
              {step === "ocupacao" && <Pergunta className="mt-5 mb-9" antes="Qual é a sua" destaque="atuação profissional" depois="hoje?" />}
              {step === "renda" && (
                <>
                  <Pergunta className="mt-5" antes="Renda" destaque="mensal atual" />
                  <p className="q-rise mt-3 mb-9 text-[14px] italic" style={{ color: C.muted, animationDelay: "300ms" }}>
                    Sigiloso — utilizado para indicação do plano/modelo ideal.
                  </p>
                </>
              )}
              {step === "experiencia" && <Pergunta className="mt-5 mb-9" antes="Você tem experiência com" destaque="vendas B2B" depois="ou atendimento a empresas?" />}
              {step === "prioridade" && <Pergunta className="mt-5 mb-9" antes="Qual o seu nível de" destaque="prioridade" depois="para dar início?" />}
              {step === "investimento" && (
                <>
                  <p className="q-rise mt-5 text-[15px] leading-relaxed max-w-2xl" style={{ color: C.muted, animationDelay: "80ms" }}>
                    Para ter acesso ao nosso ecossistema completo e acelerar seus negócios com acompanhamento
                    personalizado, existem 3 modalidades para você decidir.
                  </p>
                  <Pergunta className="mt-5 mb-9" delay={220}
                    antes="Quanto você está disposto a investir para entrar no mercado com as maiores oportunidades de faturar"
                    destaque="grandes comissões?" />
                </>
              )}

              <Opcoes options={opcoesDoPasso.list} selected={opcoesDoPasso.selected} onSelect={opcoesDoPasso.pick}
                delay={step === "investimento" ? 900 : 420} />

              {submitError && step === "investimento" && (
                <p className="mt-4 text-[13px] text-red-400">{submitError}</p>
              )}

              {step !== "objetivo" && (
                <div className="q-rise mt-9" style={{ animationDelay: "700ms" }}><Voltar onClick={goBack} /></div>
              )}
            </section>
          )}

          {/* ── Passo 3: Identificação inicial ── */}
          {step === "nome" && (
            <form className="max-w-2xl" onSubmit={(e) => { e.preventDefault(); if (nomeValid) goTo("contato"); }}>
              <Eyebrow>Passo 3 · {PASSO_TITULO[3]}</Eyebrow>
              <Pergunta className="mt-5 mb-10" antes="Qual é o seu" destaque="nome completo?" />
              <Campo label="Nome completo" delay={400}>
                <input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Digite seu nome"
                  autoFocus autoComplete="name" className={inputPremium} style={inputPremiumStyle} />
              </Campo>
              <div className="q-rise mt-10 flex flex-col-reverse sm:flex-row sm:items-center gap-5" style={{ animationDelay: "550ms" }}>
                <Voltar onClick={goBack} />
                <div className="sm:ml-auto"><BotaoOuro type="submit" disabled={!nomeValid}>Continuar <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" /></BotaoOuro></div>
              </div>
            </form>
          )}

          {/* ── Passo 4: Contato ── */}
          {step === "contato" && (
            <form className="max-w-2xl" onSubmit={(e) => { e.preventDefault(); if (contatoValid) goTo("renda"); }}>
              <Eyebrow>Passo 4 · {PASSO_TITULO[4]}</Eyebrow>
              <Pergunta className="mt-5 mb-10" antes={primeiroNome ? `Prazer, ${primeiroNome}. Onde podemos` : "Onde podemos"} destaque="falar com você?" />
              <div className="space-y-8">
                <Campo label="WhatsApp (com DDD e código do país)" delay={450}>
                  <div className="flex items-end gap-3">
                    <span className="pb-3 text-xl sm:text-2xl font-semibold" style={{ color: C.muted }}>+55</span>
                    <input value={form.telefone} onChange={(e) => set("telefone", maskPhone(e.target.value))} placeholder="(11) 99999-9999"
                      inputMode="tel" autoComplete="tel-national" autoFocus className={inputPremium} style={inputPremiumStyle} />
                  </div>
                </Campo>
                <Campo label="E-mail corporativo/pessoal" delay={550}>
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="seu@email.com"
                    autoComplete="email" className={inputPremium} style={inputPremiumStyle} />
                </Campo>
                <label className="q-rise flex items-start gap-3 cursor-pointer" style={{ animationDelay: "650ms" }}>
                  <input type="checkbox" checked={form.consentimento} onChange={(e) => set("consentimento", e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#C9A84C]" />
                  <span className="text-[13px] leading-relaxed" style={{ color: C.muted }}>
                    Autorizo a V3 Partners a entrar em contato e tratar meus dados conforme a{" "}
                    <a href="/politica-privacidade" target="_blank" rel="noreferrer" className="underline underline-offset-2" style={{ color: C.gold }}>Política de Privacidade</a>.
                  </span>
                </label>
              </div>
              <div className="q-rise mt-10 flex flex-col-reverse sm:flex-row sm:items-center gap-5" style={{ animationDelay: "750ms" }}>
                <Voltar onClick={goBack} />
                <div className="sm:ml-auto"><BotaoOuro type="submit" disabled={!contatoValid}>Continuar <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" /></BotaoOuro></div>
              </div>
            </form>
          )}

          {/* ── Enviando ── */}
          {step === "enviando" && (
            <section className="flex flex-col items-center justify-center text-center py-20 gap-6">
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => <span key={i} className="q-dot" style={{ animationDelay: `${i * 150}ms` }} />)}
              </div>
              <Pergunta as="h2" className="!text-[30px] sm:!text-[40px]" antes="Analisando sua" destaque="aplicação…" delay={0} />
              <p className="q-rise text-[13px]" style={{ color: C.muted, animationDelay: "400ms" }}>
                Cruzando seu perfil com as modalidades de parceria da V3.
              </p>
            </section>
          )}

          {/* ── Tela Final: Elegibilidade & Agendamento ── */}
          {step === "concluido" && (
            <section className="max-w-2xl mx-auto text-center">
              <SeloAprovado />
              <Eyebrow center delay={900}>Elegibilidade & agendamento</Eyebrow>
              <Pergunta as="h1" className="mt-5 !text-[42px] sm:!text-[62px] !leading-[1.05]" antes="Sua aplicação foi" destaque="pré-aprovada!" delay={1000} />
              <p className="q-rise mt-5 text-[17px] leading-relaxed" style={{ color: C.cream, animationDelay: "1500ms" }}>
                Você está elegível para uma apresentação estratégica com um diretor da V3 Partners.
              </p>

              <div className="q-rise mt-8 rounded-2xl border p-5 text-left" style={{ background: "rgba(22,39,68,0.6)", borderColor: C.line, animationDelay: "1700ms", backdropFilter: "blur(6px)" }}>
                <p className="text-[13.5px] leading-relaxed" style={{ color: C.muted }}>
                  <strong style={{ color: C.goldLight }}>⚠️ Importante:</strong> Ao agendar ou chamar no WhatsApp, certifique-se de
                  escolher um horário em que possa participar com certeza. Esta etapa não garante aprovação final no
                  programa de parceiros.
                </p>
              </div>

              <div className="q-rise mt-8" style={{ animationDelay: "1900ms" }}>
                <a href={waLink} target="_blank" rel="noreferrer"
                  className="q-btn group inline-flex items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-[15px] font-bold transition-all duration-300 hover:brightness-110 hover:-translate-y-0.5 w-full sm:w-auto"
                  style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg, boxShadow: `0 16px 44px -14px ${C.gold}` }}>
                  <MessageCircle className="w-5 h-5" /> Falar com Responsável Agora no WhatsApp
                </a>
              </div>

              <button onClick={reiniciar} className="q-rise mt-8 text-[12px] font-semibold hover:opacity-80" style={{ color: C.muted, animationDelay: "2100ms" }}>
                Refazer aplicação
              </button>
            </section>
          )}
        </div>
      </main>

      <footer className="relative z-10 pb-6 text-center text-[11px]" style={{ color: `${C.muted}99` }}>
        V3 Partners · Boutique institucional multiproduto · Presença em 24 estados
      </footer>
    </div>
  );
}
