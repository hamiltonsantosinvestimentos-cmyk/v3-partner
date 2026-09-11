"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight, RotateCcw, MessageCircle, TrendingUp, Briefcase, Users,
  Network, Building2, Wallet, Clock3, CalendarClock, CheckCircle2,
  Search, Rocket, Store, GraduationCap, UserRound, MoreHorizontal, Trophy,
} from "lucide-react";
import {
  GOLD, GOLD_LIGHT, NAVY, NAVY_CARD, NAVY_BASE, MUTED,
  inputCls, inputStyle, maskPhone, TopProgress, Field, StepCard, ChoiceGrid,
} from "./wizard-ui";
import { trackPixel } from "./meta-pixel";
import {
  OBJETIVO, OCUPACAO, EXPERIENCIA_B2B, REDE, PORTE_REDE, DISPONIBILIDADE,
  PRAZO_COMECO, RENDA_FAIXA, RENDA_FAIXA_VALOR,
  type QuizOption,
} from "@/lib/quiz-partner";

type Step =
  | "intro" | "objetivo" | "ocupacao" | "experiencia" | "rede" | "porte"
  | "renda" | "disponibilidade" | "prazo" | "previa" | "dados" | "concluido";

// Ordem usada pela barra de progresso e pelo beacon de funil.
const PROGRESS_STEPS: Step[] = [
  "intro", "objetivo", "ocupacao", "experiencia", "rede", "porte",
  "renda", "disponibilidade", "prazo", "previa", "dados", "concluido",
];
// Passos numerados ("Passo X de N") — pergunta 1 (objetivo) até os dados.
const NUMBERED: Step[] = [
  "objetivo", "ocupacao", "experiencia", "rede", "porte",
  "renda", "disponibilidade", "prazo", "dados",
];
const TOTAL = NUMBERED.length;
const stepNumOf = (s: Step) => NUMBERED.indexOf(s) + 1;

type Icon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

const ICONS: Record<string, Record<string, Icon>> = {
  objetivo: { renda_extra: Wallet, carreira: Rocket, complementar: Briefcase, time_originacao: Users },
  ocupacao: { consultor_financeiro: TrendingUp, corretor: Store, empresario: Building2, executivo_clt: UserRound, contador_advogado: GraduationCap, outro: MoreHorizontal },
  experiencia_b2b: { nenhuma: MoreHorizontal, menos_1: Clock3, "1_3": CalendarClock, "3_mais": Trophy, atuo_credito_ma: TrendingUp },
  rede: { ate_10: Users, "10_50": Users, "50_200": Network, "200_mais": Network },
  porte_rede: { ate_1m: Building2, "1_10m": Building2, "10_50m": Building2, "50m_mais": Building2, nao_sei: Search },
  renda_faixa: { ate_2k: Wallet, "2_5k": Wallet, "5_15k": Wallet, "15_30k": Wallet, "30k_mais": Wallet },
  disponibilidade: { ate_5h: Clock3, "5_15h": Clock3, "15_30h": CalendarClock, full_time: Rocket },
  prazo_comeco: { agora: Rocket, "30_dias": CalendarClock, "90_dias": CalendarClock, pesquisando: Search },
};

function opts(key: string, list: QuizOption[]) {
  return list.map((o) => ({ value: o.value, label: o.label, hint: o.hint, icon: ICONS[key]?.[o.value] ?? MoreHorizontal }));
}

interface FormState {
  objetivo: string; ocupacao: string; experiencia_b2b: string; rede: string; porte_rede: string;
  renda_faixa: string; disponibilidade: string; prazo_comeco: string;
  nome: string; email: string; telefone: string;
  consentimento: boolean;
}
const INITIAL: FormState = {
  objetivo: "", ocupacao: "", experiencia_b2b: "", rede: "", porte_rede: "",
  renda_faixa: "", disponibilidade: "", prazo_comeco: "",
  nome: "", email: "", telefone: "", consentimento: false,
};

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
  const [, setHistory] = useState<Step[]>([]);

  // ── Rastreio de funil: reporta cada passo alcançado (1x por sessão) ──
  const sessionIdRef = useRef<string>("");
  const reportedRef = useRef<Set<string>>(new Set());
  if (!sessionIdRef.current && typeof crypto !== "undefined") {
    sessionIdRef.current = (crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2));
  }
  useEffect(() => {
    const sid = sessionIdRef.current;
    if (!sid || reportedRef.current.has(step)) return;
    reportedRef.current.add(step);
    const idx = PROGRESS_STEPS.indexOf(step);
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

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  function goTo(next: Step) { setHistory((h) => [...h, step]); setStep(next); }
  function goBack() {
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (prev) setStep(prev);
      return h.slice(0, -1);
    });
  }
  function reiniciar() {
    setForm(INITIAL); setHistory([]); setStep("intro"); setEnviado(false); setSubmitError(null);
  }

  const idx = PROGRESS_STEPS.indexOf(step);
  const progressPct = step === "intro" ? 0 : idx >= 0 ? ((idx + 1) / PROGRESS_STEPS.length) * 100 : 100;

  const partnerName = partner?.full_name ?? null;
  const waLink = partner?.whatsapp
    ? `https://wa.me/55${partner.whatsapp}?text=${encodeURIComponent(
        `Olá! Acabei de fazer o quiz para me tornar Partner da V3 e quero conversar sobre os próximos passos.`,
      )}`
    : null;

  const dadosValid = Boolean(
    form.nome.trim().length >= 3 &&
    form.telefone.replace(/\D/g, "").length >= 10 &&
    (form.email === "" || form.email.includes("@")),
  );

  async function finalizar() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/public/partner-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: ref || null,
          objetivo: form.objetivo, ocupacao: form.ocupacao, experiencia_b2b: form.experiencia_b2b,
          rede: form.rede, porte_rede: form.porte_rede,
          renda_mensal: RENDA_FAIXA_VALOR[form.renda_faixa] ?? 0,
          renda_faixa: form.renda_faixa,
          disponibilidade: form.disponibilidade,
          prazo_comeco: form.prazo_comeco,
          nome: form.nome, email: form.email || null, telefone: form.telefone,
          tracking,
          consentimento: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar o quiz");
      trackPixel("Lead", { content_name: "quiz_seja_partner", tier: json.tier, currency: "BRL", value: 0 });
      setEnviado(true);
      goTo("concluido");
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const showHeaderStrip = step !== "concluido" && step !== "intro";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: NAVY }}>
      <TopProgress pct={progressPct} />

      <div className="border-b border-white/5 px-6 py-4 flex items-center gap-3" style={{ background: NAVY_BASE }}>
        <div className="relative w-8 h-8">
          <Image src="/logo.jpg" alt="V3 Partners" fill className="object-contain rounded" />
        </div>
        <span className="text-sm font-bold text-white">V3 Partners</span>
      </div>

      {showHeaderStrip && (
        <div className="px-6 py-2.5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center border-b border-white/5" style={{ background: NAVY_BASE }}>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Seja Partner V3</span>
          <span className="text-[11px] flex items-center gap-1" style={{ color: MUTED }}>
            <Clock3 className="w-3 h-3" /> Leva 2 minutos · sem compromisso
          </span>
          {partnerName && <span className="text-[11px]" style={{ color: GOLD }}>Convite de {partnerName}</span>}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        {/* ── Abertura de venda ── */}
        {step === "intro" && (
          <div className="w-full max-w-lg mx-auto animate-fade-in">
            <div className="rounded-2xl border p-7 sm:p-9 space-y-6" style={{ background: NAVY_CARD, borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Seja Partner V3</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Ganhe até <span style={{ color: GOLD }}>R$ 500 mil</span> em uma única operação
                </h1>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  A V3 Partners é uma boutique institucional multiproduto. Você leva os clientes,
                  a V3 estrutura a operação.
                </p>
              </div>

              <ul className="space-y-2.5">
                {[
                  "Presença em 24 estados do Brasil",
                  "Mesa de operações, IA e materiais de venda prontos pra você",
                ].map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm text-white">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              {partnerName && <p className="text-xs" style={{ color: GOLD }}>Convite de {partnerName} — Partner V3</p>}

              <p className="text-xs text-center" style={{ color: MUTED }}>
                Responda algumas perguntas rápidas e te direcionamos pro cadastro certo.
              </p>

              <button onClick={() => goTo("objetivo")}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: GOLD }}>
                Ver se eu me qualifico <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-center flex items-center justify-center gap-1.5" style={{ color: MUTED }}>
                <Clock3 className="w-3 h-3" /> Leva 2 minutos · sem compromisso
              </p>
            </div>
          </div>
        )}

        {step === "objetivo" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Qual seu" titleHighlight="objetivo com a parceria?"
            subtitle="Comece por aqui — o que você quer alcançar sendo Partner da V3.">
            <ChoiceGrid columns={2} selected={form.objetivo} onSelect={(v) => { set("objetivo", v); goTo("ocupacao"); }} options={opts("objetivo", OBJETIVO)} />
          </StepCard>
        )}

        {step === "ocupacao" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="O que você" titleHighlight="faz hoje?"
            subtitle="Sua ocupação principal no momento." onBack={goBack}>
            <ChoiceGrid columns={2} selected={form.ocupacao} onSelect={(v) => { set("ocupacao", v); goTo("experiencia"); }} options={opts("ocupacao", OCUPACAO)} />
          </StepCard>
        )}

        {step === "experiencia" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Sua experiência com" titleHighlight="vendas B2B / originação"
            subtitle="Prospecção e relacionamento com empresas e decisores." onBack={goBack}>
            <ChoiceGrid columns={2} selected={form.experiencia_b2b} onSelect={(v) => { set("experiencia_b2b", v); goTo("rede"); }} options={opts("experiencia_b2b", EXPERIENCIA_B2B)} />
          </StepCard>
        )}

        {step === "rede" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Quantos" titleHighlight="donos de empresa / decisores"
            subtitle="Pessoas com poder de decisão que você consegue acessar hoje." onBack={goBack}>
            <ChoiceGrid columns={2} selected={form.rede} onSelect={(v) => { set("rede", v); goTo("porte"); }} options={opts("rede", REDE)} />
          </StepCard>
        )}

        {step === "porte" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Qual o" titleHighlight="porte dessas empresas?"
            subtitle="Faturamento médio anual das empresas da sua rede." onBack={goBack}>
            <ChoiceGrid columns={2} selected={form.porte_rede} onSelect={(v) => { set("porte_rede", v); goTo("renda"); }} options={opts("porte_rede", PORTE_REDE)} />
          </StepCard>
        )}

        {step === "renda" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Sua" titleHighlight="renda mensal atual"
            subtitle="Fica só entre você e a V3 — ajuda a recomendar o plano certo." onBack={goBack}>
            <ChoiceGrid columns={2} selected={form.renda_faixa} onSelect={(v) => { set("renda_faixa", v); goTo("disponibilidade"); }} options={opts("renda_faixa", RENDA_FAIXA)} />
          </StepCard>
        )}

        {step === "disponibilidade" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Quanto tempo" titleHighlight="por semana você tem?"
            subtitle="Tempo que consegue dedicar à operação como Partner." onBack={goBack}>
            <ChoiceGrid columns={2} selected={form.disponibilidade} onSelect={(v) => { set("disponibilidade", v); goTo("prazo"); }} options={opts("disponibilidade", DISPONIBILIDADE)} />
          </StepCard>
        )}

        {step === "prazo" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Quando você" titleHighlight="quer começar?"
            subtitle="Seu momento para entrar na operação." onBack={goBack}>
            <ChoiceGrid columns={2} selected={form.prazo_comeco} onSelect={(v) => { set("prazo_comeco", v); goTo("previa"); }} options={opts("prazo_comeco", PRAZO_COMECO)} />
          </StepCard>
        )}

        {/* ── Prévia (antes de pedir contato) — reforça o gancho, não revela plano/faixa ── */}
        {step === "previa" && (
          <div className="w-full max-w-md mx-auto space-y-4 animate-fade-in">
            <div className="rounded-2xl border p-6 sm:p-7 space-y-5 text-center" style={{ background: NAVY_CARD, borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: `${GOLD}20` }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: GOLD }} />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Perfil pré-qualificado</p>
                <p className="text-2xl font-extrabold" style={{ color: GOLD_LIGHT }}>Você tem o perfil de Partner V3</p>
              </div>
              <p className="text-sm" style={{ color: MUTED }}>
                Com esse perfil, você pode originar operações e ganhar até <strong style={{ color: GOLD }}>R$ 500 mil</strong> numa
                única operação. Falta só um passo: deixe seu contato para um especialista da V3 te explicar os próximos passos.
              </p>
              <button onClick={() => goTo("dados")}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: GOLD }}>
                Falar com um especialista <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center">
              <button onClick={goBack} className="px-5 py-2 rounded-full text-xs font-semibold" style={{ background: NAVY_CARD, color: MUTED }}>
                Voltar
              </button>
            </div>
          </div>
        )}

        {step === "dados" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Como a gente" titleHighlight="fala com você?"
            subtitle="Só o essencial — o especialista te chama no WhatsApp."
            onBack={goBack} onNext={finalizar} nextLabel="Quero ser Partner V3" nextLoading={submitting}
            nextDisabled={!dadosValid || !form.consentimento} wide>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Field label="Nome completo">
                <input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Seu nome completo" autoFocus className={inputCls} style={inputStyle} />
              </Field></div>
              <Field label="Telefone / WhatsApp"><input value={form.telefone} onChange={(e) => set("telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" className={inputCls} style={inputStyle} /></Field>
              <Field label="E-mail (opcional)"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="seu@email.com" className={inputCls} style={inputStyle} /></Field>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <input type="checkbox" checked={form.consentimento} onChange={(e) => set("consentimento", e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#C9A84C]" />
              <span className="text-xs text-left" style={{ color: "#D8CCA8" }}>
                Autorizo a V3 Partners a entrar em contato e tratar meus dados conforme a{" "}
                <a href="/politica-privacidade" target="_blank" rel="noreferrer" className="underline" style={{ color: GOLD }}>Política de Privacidade</a>.
              </span>
            </label>
            {submitError && <p className="text-xs text-red-400 text-left">{submitError}</p>}
          </StepCard>
        )}

        {/* ── Confirmação ── */}
        {step === "concluido" && enviado && (
          <div className="w-full max-w-md mx-auto space-y-4 animate-fade-in">
            <div className="rounded-2xl border p-6 sm:p-7 space-y-5 text-center" style={{ background: NAVY_CARD, borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: `${GOLD}20` }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: GOLD }} />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Cadastro recebido</p>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Você está pré-qualificado</h2>
              </div>

              <div className="rounded-xl p-5 border" style={{ background: `${GOLD}12`, borderColor: `${GOLD}40` }}>
                <p className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>Seu potencial como Partner</p>
                <p className="text-2xl font-extrabold" style={{ color: GOLD_LIGHT }}>Até R$ 500 mil por operação</p>
              </div>

              <p className="text-sm" style={{ color: MUTED }}>
                {partnerName
                  ? `${partnerName} e um especialista da V3 vão te chamar no WhatsApp para os próximos passos.`
                  : "Um especialista da V3 vai te chamar no WhatsApp para conversar sobre os próximos passos."}
              </p>

              {waLink ? (
                <a href={waLink} target="_blank" rel="noreferrer"
                  className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  style={{ background: GOLD }}>
                  <MessageCircle className="w-4 h-4" /> Falar no WhatsApp agora
                </a>
              ) : (
                <p className="text-[11px]" style={{ color: MUTED }}>
                  Dúvidas? <a href="mailto:operacional@v3partners.com.br" className="underline" style={{ color: GOLD }}>operacional@v3partners.com.br</a>
                </p>
              )}
            </div>

            <div className="flex justify-center">
              <button onClick={reiniciar} className="flex items-center gap-1.5 text-xs px-5 py-2 rounded-full" style={{ background: NAVY_CARD, color: MUTED }}>
                <RotateCcw className="w-3 h-3" /> Refazer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
