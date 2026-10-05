"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Clock3, MessageCircle, ShieldCheck } from "lucide-react";
import { maskPhone } from "./wizard-ui";
import { trackPixel } from "./meta-pixel";
import {
  display, C, DDI_PAISES, WHATSAPP_V3, LETRAS, SAIDA_MS, MOTION_CSS, inputPremium, inputPremiumStyle,
  telefoneCompleto, Backdrop, Eyebrow, Pergunta, Opcoes, Campo, BotaoOuro, Voltar, SeloAprovado,
} from "./partner-quiz-client";
import type { QuizOption } from "@/lib/quiz-partner";
import {
  WL_OBJETIVO, WL_CAPITAL, WL_DEDICACAO, WL_EXPERIENCIA, WL_PRAZO, WL_PARCIAL_PAROU_EM, type WlLista,
} from "@/lib/quiz-white-label";

// Quiz "White Label" (/white-label): qualificação para a operação própria (Enterprise white label),
// ticket acima de R$ 50 mil. Roteiro do PDF "Sugestão de alteração de quiz": 5 perguntas.
// O contato (nome, WhatsApp, e-mail) entra depois das 2 primeiras respostas (objetivo e capital):
// o candidato já se comprometeu com o quiz e o time já sabe o capital dele se ele parar no meio.
// Mesmo visual e peças do quiz Seja Partner (partner-quiz-client.tsx).

type Step =
  | "intro" | "objetivo" | "capital" | "nome" | "contato"
  | "dedicacao" | "experiencia" | "prazo" | "enviando" | "concluido";

const FLOW: Step[] = ["intro", "objetivo", "capital", "nome", "contato", "dedicacao", "experiencia", "prazo", "concluido"];
const PASSO: Partial<Record<Step, number>> = {
  objetivo: 1, capital: 2, nome: 3, contato: 3, dedicacao: 4, experiencia: 5, prazo: 6, enviando: 6,
};
const TOTAL_PASSOS = 6;
const PASSO_TITULO: Record<number, string> = {
  1: "Momento & objetivo",
  2: "Capital de investimento",
  3: "Seus dados",
  4: "Dedicação & operação",
  5: "Experiência",
  6: "Tempo & urgência",
};

interface FormState {
  objetivo: string; capital: string; nome: string; telefone: string; ddi: string; email: string;
  dedicacao: string; experiencia: string; prazo: string; consentimento: boolean;
}
const INITIAL: FormState = {
  objetivo: "", capital: "", nome: "", telefone: "", ddi: "+55", email: "",
  dedicacao: "", experiencia: "", prazo: "", consentimento: false,
};

export function WhiteLabelQuizClient() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") ?? "";

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
  const [lista, setLista] = useState<WlLista | null>(null);

  // ── Rastreio de funil (mesma tabela do Seja Partner, quiz = "white_label") ──
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
        body: JSON.stringify({ session_id: sid, quiz: "white_label", step, step_index: idx < 0 ? 99 : idx, ref: ref || null, utm: tracking }),
      }).catch(() => {});
    } catch { /* ignora */ }
  }, [step, ref, tracking]);

  const [form, setForm] = useState<FormState>(INITIAL);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Lead parcial: depois do contato, cada passo alcançado grava/atualiza o lead "incompleto"
  // na Prospecção (o 1º registro também avisa o time no WhatsApp).
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; });
  useEffect(() => {
    if (!(step in WL_PARCIAL_PAROU_EM)) return;
    const f = formRef.current;
    const sid = sessionIdRef.current;
    if (!sid || !f.consentimento || f.nome.trim().length < 3 || !f.email.trim() || !f.telefone) return;
    try {
      fetch("/api/public/white-label-quiz/parcial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          session_id: sid, parou_em: step, ref: ref || null, tracking,
          objetivo: f.objetivo || null, capital: f.capital || null,
          dedicacao: f.dedicacao || null, experiencia: f.experiencia || null,
          nome: f.nome.trim(), email: f.email.trim(), telefone: telefoneCompleto(f), consentimento: true,
        }),
      }).catch(() => {});
    } catch { /* ignora */ }
  }, [step, ref, tracking]);

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
    setForm(INITIAL); setLista(null); historyRef.current = []; setSubmitError(null); trocar("intro", false);
  }

  const escolher = useCallback(<K extends keyof FormState>(k: K, v: FormState[K], next: Step) => {
    if (trocandoRef.current) return;
    setForm((f) => ({ ...f, [k]: v }));
    window.setTimeout(() => goTo(next), 380);
  }, [goTo]);

  const partnerName = partner?.full_name ?? null;
  const waNumero = partner?.whatsapp ? `55${partner.whatsapp.replace(/\D/g, "")}` : WHATSAPP_V3;
  const waLink = `https://wa.me/${waNumero}?text=${encodeURIComponent(
    `Olá! Sou ${form.nome.trim() || "candidato(a)"} e fiz a aplicação para o White Label da V3. Quero agendar a conversa.`,
  )}`;

  const nomeValid = form.nome.trim().length >= 3;
  const contatoValid = form.telefone.replace(/\D/g, "").length >= (form.ddi === "+55" ? 10 : 6) &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && form.consentimento;

  const finalizar = useCallback(async (prazo: string) => {
    if (trocandoRef.current) return;
    setSubmitError(null);
    setForm((f) => ({ ...f, prazo }));
    const minimo = new Promise((r) => setTimeout(r, 2000));
    window.setTimeout(() => trocar("enviando", false), 380);
    try {
      const res = await fetch("/api/public/white-label-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: ref || null,
          objetivo: form.objetivo, capital: form.capital, dedicacao: form.dedicacao, experiencia: form.experiencia, prazo,
          nome: form.nome.trim(), email: form.email.trim(), telefone: telefoneCompleto(form),
          tracking, consentimento: true, session_id: sessionIdRef.current || null,
        }),
      });
      const json = await res.json();
      await minimo;
      if (!res.ok) throw new Error(json.error ?? "Falha ao enviar a aplicação");
      trackPixel("Lead", { content_name: "quiz_white_label", tier: json.tier, currency: "BRL", value: 0 });
      setLista(json.lista as WlLista);
      historyRef.current = [];
      trocar("concluido", false);
    } catch (e) {
      await minimo;
      setSubmitError((e as Error).message);
      trocar("prazo", false);
    }
  }, [form, ref, tracking, trocar]);

  const opcoesDoPasso = useMemo((): { list: QuizOption[]; pick: (v: string) => void; selected: string } | null => {
    switch (step) {
      case "objetivo": return { list: WL_OBJETIVO, selected: form.objetivo, pick: (v) => escolher("objetivo", v, "capital") };
      case "capital": return { list: WL_CAPITAL, selected: form.capital, pick: (v) => escolher("capital", v, "nome") };
      case "dedicacao": return { list: WL_DEDICACAO, selected: form.dedicacao, pick: (v) => escolher("dedicacao", v, "experiencia") };
      case "experiencia": return { list: WL_EXPERIENCIA, selected: form.experiencia, pick: (v) => escolher("experiencia", v, "prazo") };
      case "prazo": return { list: WL_PRAZO, selected: form.prazo, pick: (v) => { finalizar(v); } };
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
  const idx = FLOW.indexOf(step === "enviando" ? "prazo" : step);
  const progressPct = step === "intro" ? 0 : step === "concluido" ? 100 : Math.max(4, (idx / (FLOW.length - 1)) * 100);
  const primeiroNome = form.nome.trim().split(/\s+/)[0] ?? "";
  const linkPartner = ref ? `/seja-partner?ref=${encodeURIComponent(ref)}` : "/seja-partner";

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden" style={{ background: C.bg, color: C.cream }}>
      <style>{MOTION_CSS}</style>
      <Backdrop />

      <header className="relative z-10">
        <div className="h-[2px] w-full" style={{ background: C.lineSoft }}>
          <div className="h-full transition-[width] duration-700 ease-[cubic-bezier(.2,.7,.1,1)]"
            style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})`, boxShadow: `0 0 14px ${C.gold}` }} />
        </div>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <Image src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" width={72} height={44} className="h-11 w-auto object-contain" priority />
          {passo ? (
            <span className="flex items-center gap-2 text-[11px] font-semibold tracking-wider" style={{ color: C.muted }}>
              Passo
              <span className="relative inline-flex h-4 w-3 overflow-hidden justify-center">
                <span key={passo} className="q-rise tabular-nums" style={{ color: C.gold }}>{passo}</span>
              </span>
              de {TOTAL_PASSOS}
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

          {/* ── Hero ── */}
          {step === "intro" && (
            <section className="max-w-2xl">
              <Eyebrow>Aplicação · White Label V3</Eyebrow>
              <h1 className={`${display.className} mt-8 font-semibold leading-[1.05] text-[44px] sm:text-[68px]`}>
                <span className="q-rise block" style={{ animationDelay: "150ms" }}>Sua própria</span>
                <span className="q-rise block" style={{ animationDelay: "260ms" }}><span className="q-gold-text italic">empresa de crédito</span>,</span>
                <span className="q-rise block" style={{ animationDelay: "370ms" }}>com a sua marca.</span>
              </h1>

              <div className="q-line h-px w-full my-8" style={{ background: `linear-gradient(90deg, ${C.gold}88, transparent)`, animationDelay: "500ms" }} />

              <div className="q-rise grid grid-cols-3 gap-3 sm:gap-6" style={{ animationDelay: "600ms" }}>
                {[
                  ["R$ 7,4 tri", "mercado de crédito no Brasil"],
                  ["50+", "fundos, FIDCs e securitizadoras parceiros"],
                  ["até 55%", "de comissão, com repasse à sua equipe"],
                ].map(([n, l]) => (
                  <div key={n}>
                    <p className={`${display.className} text-[28px] sm:text-[40px] font-semibold leading-none`} style={{ color: C.goldLight }}>{n}</p>
                    <p className="mt-2 text-[11px] sm:text-[12px] leading-snug" style={{ color: C.muted }}>{l}</p>
                  </div>
                ))}
              </div>

              <p className="q-rise mt-8 text-[17px] sm:text-[18px] leading-relaxed" style={{ color: C.cream, animationDelay: "800ms" }}>
                A operação é sua e a estrutura é nossa: marca e domínio próprios, equipe de até 10 usuários e a
                plataforma completa da V3, com mesa de crédito, CRM e IA.
              </p>
              <p className="q-rise mt-4 text-[15px] leading-relaxed" style={{ color: C.muted, animationDelay: "920ms" }}>
                Modelo para quem tem capital a partir de R$ 50 mil para investir na própria operação.
                Responda a aplicação; se o seu perfil se encaixar, um executivo da V3 fala com você.
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

          {/* ── Perguntas ── */}
          {opcoesDoPasso && (
            <section>
              <Eyebrow>Passo {passo} · {PASSO_TITULO[passo ?? 1]}</Eyebrow>
              {step === "objetivo" && <Pergunta className="mt-5 mb-9" antes="Qual é o seu" destaque="objetivo principal" depois="no momento?" />}
              {step === "capital" && (
                <>
                  <Pergunta className="mt-5" antes="Qual o capital próprio disponível para investir no seu" destaque="próximo negócio?" />
                  <p className="q-rise mt-3 mb-9 text-[14px] italic" style={{ color: C.muted, animationDelay: "300ms" }}>
                    Sigiloso — usado só para indicar o modelo certo para você.
                  </p>
                </>
              )}
              {step === "dedicacao" && <Pergunta className="mt-5 mb-9" antes="Como você pretende" destaque="gerenciar" depois="o novo empreendimento?" />}
              {step === "experiencia" && <Pergunta className="mt-5 mb-9" antes="Qual a sua bagagem no mercado" destaque="comercial ou de negócios?" />}
              {step === "prazo" && <Pergunta className="mt-5 mb-9" antes="Em quanto tempo você planeja" destaque="iniciar a operação?" />}

              <Opcoes options={opcoesDoPasso.list} selected={opcoesDoPasso.selected} onSelect={opcoesDoPasso.pick} delay={420} />

              {submitError && step === "prazo" && <p className="mt-4 text-[13px] text-red-400">{submitError}</p>}

              {step !== "objetivo" && (
                <div className="q-rise mt-9" style={{ animationDelay: "700ms" }}><Voltar onClick={goBack} /></div>
              )}
            </section>
          )}

          {/* ── Passo 3: nome ── */}
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

          {/* ── Passo 3: WhatsApp + e-mail ── */}
          {step === "contato" && (
            <form className="max-w-2xl" onSubmit={(e) => { e.preventDefault(); if (contatoValid) goTo("dedicacao"); }}>
              <Eyebrow>Passo 3 · {PASSO_TITULO[3]}</Eyebrow>
              <Pergunta className="mt-5 mb-10" antes={primeiroNome ? `Prazer, ${primeiroNome}. Onde podemos` : "Onde podemos"} destaque="falar com você?" />
              <div className="space-y-8">
                <Campo label="WhatsApp (com DDD e código do país)" delay={450}>
                  <div className="flex items-end gap-3">
                    <select value={form.ddi} aria-label="Código do país"
                      onChange={(e) => setForm((f) => ({ ...f, ddi: e.target.value, telefone: "" }))}
                      className="pb-3 text-xl sm:text-2xl font-semibold bg-transparent outline-none cursor-pointer shrink-0"
                      style={{ color: C.muted }}>
                      {DDI_PAISES.map((p) => (
                        <option key={p.sigla} value={p.ddi} style={{ background: C.bg, color: C.cream }}>{p.sigla} {p.ddi}</option>
                      ))}
                    </select>
                    <input value={form.telefone}
                      onChange={(e) => set("telefone", form.ddi === "+55" ? maskPhone(e.target.value) : e.target.value.replace(/[^\d ]/g, "").slice(0, 18))}
                      placeholder={form.ddi === "+55" ? "(11) 99999-9999" : "Número com código de área"}
                      inputMode="tel" autoComplete="tel-national" autoFocus className={inputPremium} style={inputPremiumStyle} />
                  </div>
                </Campo>
                <Campo label="E-mail" delay={550}>
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
                Cruzando seu perfil com o modelo White Label da V3.
              </p>
            </section>
          )}

          {/* ── Resultado ── */}
          {step === "concluido" && lista !== "cold" && (
            <section className="max-w-2xl mx-auto text-center">
              <SeloAprovado />
              <Eyebrow center delay={900}>{lista === "hot" ? "Pré-aprovado · prioridade" : "Perfil qualificado"}</Eyebrow>
              <Pergunta as="h1" className="mt-5 !text-[42px] sm:!text-[62px] !leading-[1.05]"
                antes={lista === "hot" ? "Sua aplicação foi" : "Você tem perfil para o"} destaque={lista === "hot" ? "pré-aprovada!" : "White Label."} delay={1000} />
              <p className="q-rise mt-5 text-[17px] leading-relaxed" style={{ color: C.cream, animationDelay: "1500ms" }}>
                {lista === "hot"
                  ? "Um executivo sênior da V3 vai falar com você para apresentar a operação e os próximos passos."
                  : "Vamos te convidar para a próxima apresentação institucional do White Label e agendar uma conversa no seu tempo."}
              </p>
              <div className="q-rise mt-8" style={{ animationDelay: "1800ms" }}>
                <a href={waLink} target="_blank" rel="noreferrer"
                  className="q-btn group inline-flex items-center justify-center gap-2.5 rounded-xl px-8 py-4 text-[15px] font-bold transition-all duration-300 hover:brightness-110 hover:-translate-y-0.5 w-full sm:w-auto"
                  style={{ background: `linear-gradient(135deg, ${C.goldLight}, ${C.gold})`, color: C.bg, boxShadow: `0 16px 44px -14px ${C.gold}` }}>
                  <MessageCircle className="w-5 h-5" /> {lista === "hot" ? "Falar com um executivo agora" : "Falar com a V3 no WhatsApp"}
                </a>
              </div>
              <button onClick={reiniciar} className="q-rise mt-8 text-[12px] font-semibold hover:opacity-80" style={{ color: C.muted, animationDelay: "2000ms" }}>
                Refazer aplicação
              </button>
            </section>
          )}

          {step === "concluido" && lista === "cold" && (
            <section className="max-w-2xl mx-auto text-center">
              <Eyebrow center>Obrigado pela aplicação</Eyebrow>
              <Pergunta as="h1" className="mt-5 !text-[38px] sm:!text-[54px] !leading-[1.08]"
                antes={primeiroNome ? `${primeiroNome}, o melhor começo para você é o` : "O melhor começo para você é o"} destaque="Partner V3." delay={200} />
              <p className="q-rise mt-5 text-[16px] leading-relaxed" style={{ color: C.cream, animationDelay: "700ms" }}>
                O White Label pede capital a partir de R$ 50 mil na própria operação. Para entrar agora no mercado de
                crédito, com investimento menor e o mesmo ecossistema da V3, o caminho é o modelo Partner.
              </p>
              <div className="q-rise mt-8" style={{ animationDelay: "900ms" }}>
                <BotaoOuro onClick={() => { window.location.href = linkPartner; }}>
                  Conhecer o modelo Partner <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                </BotaoOuro>
              </div>
              <button onClick={reiniciar} className="q-rise mt-8 text-[12px] font-semibold hover:opacity-80" style={{ color: C.muted, animationDelay: "1100ms" }}>
                Refazer aplicação
              </button>
            </section>
          )}
        </div>
      </main>

      <footer className="relative z-10 pb-6 text-center text-[11px]" style={{ color: `${C.muted}99` }}>
        V3 Partners · White Label · Presença em 24 estados
      </footer>
    </div>
  );
}
