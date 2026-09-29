"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowRight, RotateCcw, MessageCircle, Clock3, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  GOLD, GOLD_LIGHT, NAVY, NAVY_CARD, NAVY_BASE, MUTED,
  inputCls, inputStyle, maskPhone, TopProgress, Field, StepCard,
} from "./wizard-ui";
import { trackPixel } from "./meta-pixel";
import { BrazilMap } from "./brazil-map";
import {
  OBJETIVO, OCUPACAO, RENDA_FAIXA, EXPERIENCIA_B2B, PRIORIDADE, INVESTIMENTO,
  type QuizOption,
} from "@/lib/quiz-partner";

type Step = "intro" | "objetivo" | "ocupacao" | "nome" | "contato" | "investimento" | "concluido";

// Ordem usada pela barra de progresso e pelo beacon de funil.
const PROGRESS_STEPS: Step[] = ["intro", "objetivo", "ocupacao", "nome", "contato", "investimento", "concluido"];
// Passos numerados ("Passo X de N") — pergunta 1 (objetivo) até o investimento.
const NUMBERED: Step[] = ["objetivo", "ocupacao", "nome", "contato", "investimento"];
const TOTAL = NUMBERED.length;
const stepNumOf = (s: Step) => NUMBERED.indexOf(s) + 1;

// WhatsApp do time comercial V3 — usado na tela final quando o link não veio de
// um partner (?ref=). Pode ser trocado pela env NEXT_PUBLIC_QUIZ_WHATSAPP.
const WHATSAPP_V3 = (process.env.NEXT_PUBLIC_QUIZ_WHATSAPP || "5511937639475").replace(/\D/g, "");

// Lista de seleção única (um item por linha, com rádio).
function ChoiceList({ options, selected, onSelect, compact }: {
  options: QuizOption[]; selected?: string; onSelect: (v: string) => void; compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <button key={o.value} type="button" onClick={() => onSelect(o.value)}
            className={`w-full flex items-start gap-3 text-left rounded-xl border transition-colors hover:border-[#C9A84C]/50 ${compact ? "px-3.5 py-2.5" : "px-4 py-3.5"}`}
            style={{ background: active ? `${GOLD}14` : NAVY, borderColor: active ? GOLD : "rgba(255,255,255,0.08)" }}>
            <span className="mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center"
              style={{ borderColor: active ? GOLD : "rgba(255,255,255,0.3)" }}>
              {active && <span className="w-2 h-2 rounded-full" style={{ background: GOLD }} />}
            </span>
            <span className="min-w-0">
              <span className={`block font-semibold text-white leading-snug ${compact ? "text-xs" : "text-sm"}`}>{o.label}</span>
              {o.hint && <span className="block text-xs italic leading-snug mt-0.5" style={{ color: MUTED }}>{o.hint}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface FormState {
  objetivo: string; ocupacao: string; nome: string;
  telefone: string; email: string; renda_faixa: string; experiencia_b2b: string; prioridade: string;
  investimento: string;
  consentimento: boolean;
}
const INITIAL: FormState = {
  objetivo: "", ocupacao: "", nome: "",
  telefone: "", email: "", renda_faixa: "", experiencia_b2b: "", prioridade: "",
  investimento: "", consentimento: false,
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
  const waNumero = partner?.whatsapp ? `55${partner.whatsapp.replace(/\D/g, "")}` : WHATSAPP_V3;
  const waLink = `https://wa.me/${waNumero}?text=${encodeURIComponent(
    `Olá! Sou ${form.nome.trim() || "candidato(a)"} e acabei de preencher a aplicação para ser Partner da V3. Quero agendar a apresentação estratégica.`,
  )}`;

  const contatoValid = Boolean(
    form.telefone.replace(/\D/g, "").length >= 10 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) &&
    form.renda_faixa && form.experiencia_b2b && form.prioridade && form.consentimento,
  );

  async function finalizar(investimento: string) {
    setSubmitting(true);
    setSubmitError(null);
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
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar a aplicação");
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
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Aplicação Partner V3</span>
          <span className="text-[11px] flex items-center gap-1" style={{ color: MUTED }}>
            <Clock3 className="w-3 h-3" /> Leva 1 minuto
          </span>
          {partnerName && <span className="text-[11px]" style={{ color: GOLD }}>Convite de {partnerName}</span>}
        </div>
      )}

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        {/* ── Abertura (hero) ── */}
        {step === "intro" && (
          <div className="w-full max-w-lg mx-auto animate-fade-in">
            <div className="rounded-2xl border p-7 sm:p-9 space-y-6" style={{ background: NAVY_CARD, borderColor: "rgba(255,255,255,0.06)" }}>
              <BrazilMap size={168} />
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Seja Partner V3</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Ganhe até <span style={{ color: GOLD }}>R$ 500 mil</span> em uma única operação
                </h1>
                <p className="text-sm leading-relaxed text-white/90">
                  O mercado de intermediação de crédito movimenta mais de <strong style={{ color: GOLD }}>R$ 21 trilhões</strong> de
                  reais entre bancos tradicionais e instituições privadas. Esta é a sua oportunidade de entrar nesse
                  mercado e faturar comissões de alto valor.
                </p>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  Clique no botão abaixo para preencher a aplicação de elegibilidade. Caso seja aprovado(a),
                  um dos nossos diretores entrará em contato.
                </p>
              </div>

              {partnerName && <p className="text-xs" style={{ color: GOLD }}>Convite de {partnerName} — Partner V3</p>}

              <p className="text-xs text-center flex items-center justify-center gap-1.5 font-semibold" style={{ color: MUTED }}>
                <Clock3 className="w-3.5 h-3.5" /> Leva 1 minuto
              </p>
              <button onClick={() => goTo("objetivo")}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: GOLD }}>
                Aplicar Agora <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === "objetivo" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="O que mais representa o seu" titleHighlight="momento atual?" wide>
            <ChoiceList selected={form.objetivo} onSelect={(v) => { set("objetivo", v); goTo("ocupacao"); }} options={OBJETIVO} />
          </StepCard>
        )}

        {step === "ocupacao" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Qual é a sua" titleHighlight="atuação profissional hoje?"
            onBack={goBack} wide>
            <ChoiceList selected={form.ocupacao} onSelect={(v) => { set("ocupacao", v); goTo("nome"); }} options={OCUPACAO} />
          </StepCard>
        )}

        {step === "nome" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Identificação" titleHighlight="inicial"
            onBack={goBack} onNext={() => goTo("contato")} nextDisabled={form.nome.trim().length < 3} wide>
            <Field label="Nome completo">
              <input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Seu nome completo" autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && form.nome.trim().length >= 3) goTo("contato"); }}
                className={inputCls} style={inputStyle} />
            </Field>
          </StepCard>
        )}

        {step === "contato" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Contato, perfil financeiro" titleHighlight="& prioridade"
            onBack={goBack} onNext={() => goTo("investimento")} nextDisabled={!contatoValid} wide>
            <div className="space-y-5 text-left">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="WhatsApp (com DDD)">
                  <input value={form.telefone} onChange={(e) => set("telefone", maskPhone(e.target.value))} placeholder="(11) 99999-9999"
                    inputMode="tel" className={inputCls} style={inputStyle} />
                </Field>
                <Field label="E-mail corporativo/pessoal">
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="seu@email.com"
                    className={inputCls} style={inputStyle} />
                </Field>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-white">
                  Renda Mensal Atual{" "}
                  <span className="font-normal italic text-xs" style={{ color: MUTED }}>(Sigiloso — utilizado para indicação do plano/modelo ideal)</span>
                </p>
                <ChoiceList compact selected={form.renda_faixa} onSelect={(v) => set("renda_faixa", v)} options={RENDA_FAIXA} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-white">Você tem experiência com vendas B2B ou atendimento a empresas?</p>
                <ChoiceList compact selected={form.experiencia_b2b} onSelect={(v) => set("experiencia_b2b", v)} options={EXPERIENCIA_B2B} />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-white">Qual o seu nível de prioridade para dar início?</p>
                <ChoiceList compact selected={form.prioridade} onSelect={(v) => set("prioridade", v)} options={PRIORIDADE} />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <input type="checkbox" checked={form.consentimento} onChange={(e) => set("consentimento", e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#C9A84C]" />
                <span className="text-xs text-left" style={{ color: "#D8CCA8" }}>
                  Autorizo a V3 Partners a entrar em contato e tratar meus dados conforme a{" "}
                  <a href="/politica-privacidade" target="_blank" rel="noreferrer" className="underline" style={{ color: GOLD }}>Política de Privacidade</a>.
                </span>
              </label>
            </div>
          </StepCard>
        )}

        {step === "investimento" && (
          <StepCard stepNum={stepNumOf(step)} totalSteps={TOTAL} title="Modalidade & capacidade" titleHighlight="de investimento"
            subtitle="Para ter acesso ao nosso ecossistema completo e acelerar seus negócios com acompanhamento personalizado, existem 3 modalidades para você decidir."
            onBack={goBack} wide>
            <div className="space-y-3 text-left">
              <p className="text-sm font-semibold text-white">
                Quanto você está disposto a investir para entrar no mercado com as maiores oportunidades de faturar grandes comissões?
              </p>
              <ChoiceList selected={form.investimento}
                onSelect={(v) => { if (submitting) return; set("investimento", v); finalizar(v); }}
                options={INVESTIMENTO} />
              {submitting && <p className="text-xs text-center" style={{ color: MUTED }}>Enviando sua aplicação…</p>}
              {submitError && <p className="text-xs text-red-400">{submitError}</p>}
            </div>
          </StepCard>
        )}

        {/* ── Tela final: elegibilidade & agendamento ── */}
        {step === "concluido" && enviado && (
          <div className="w-full max-w-md mx-auto space-y-4 animate-fade-in">
            <div className="rounded-2xl border p-6 sm:p-7 space-y-5 text-center" style={{ background: NAVY_CARD, borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: `${GOLD}20` }}>
                <CheckCircle2 className="w-7 h-7" style={{ color: GOLD }} />
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Elegibilidade & agendamento</p>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Sua aplicação foi pré-aprovada!</h2>
                <p className="text-sm" style={{ color: MUTED }}>
                  Você está elegível para uma apresentação estratégica com um diretor da V3 Partners.
                </p>
              </div>

              <div className="rounded-xl p-4 border text-left flex gap-3" style={{ background: `${GOLD}12`, borderColor: `${GOLD}40` }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD_LIGHT }} />
                <p className="text-xs leading-relaxed" style={{ color: "#D8CCA8" }}>
                  <strong style={{ color: GOLD_LIGHT }}>Importante:</strong> Ao agendar ou chamar no WhatsApp, certifique-se de escolher
                  um horário em que possa participar com certeza. Esta etapa não garante aprovação final no programa de parceiros.
                </p>
              </div>

              <a href={waLink} target="_blank" rel="noreferrer"
                className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: GOLD }}>
                <MessageCircle className="w-4 h-4" /> Falar com Responsável Agora no WhatsApp
              </a>
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
