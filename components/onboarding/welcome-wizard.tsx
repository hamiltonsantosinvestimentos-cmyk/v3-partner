"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  X, ChevronRight, ChevronLeft, Users, CreditCard,
  GraduationCap, DollarSign, ArrowRight, Sparkles,
  CheckCircle2, Building2, TrendingUp,
} from "lucide-react";

const STORAGE_KEY = "v3_onboarding_wizard_done";

interface WelcomeWizardProps {
  userName: string;
  role: string;
}

const STEPS = [
  { id: "welcome",   label: "Boas-vindas" },
  { id: "como",      label: "Como funciona" },
  { id: "checklist", label: "Seus primeiros passos" },
  { id: "acao",      label: "Comece agora" },
];

export function WelcomeWizard({ userName, role }: WelcomeWizardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);
  const firstName = userName.split(" ")[0];

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done && ["PARTNER", "PARTNER_PRO"].includes(role)) {
      // Pequeno delay para não bloquear o carregamento inicial
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, [role]);

  // Dispara e-mail de boas-vindas na abertura
  useEffect(() => {
    if (open) {
      fetch("/api/onboarding/welcome", { method: "POST" }).catch(() => {});
    }
  }, [open]);

  function close() {
    setClosing(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "true");
      setOpen(false);
      setClosing(false);
    }, 300);
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  }

  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  function navigate(path: string) {
    close();
    setTimeout(() => router.push(path), 350);
  }

  if (!open) return null;

  const isLast = step === STEPS.length - 1;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all duration-300
        ${closing ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
      style={{ background: "rgba(9,8,26,0.92)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-[#243A66] overflow-hidden shadow-2xl"
        style={{ background: "linear-gradient(160deg, #111F35 0%, #0D1929 100%)" }}
      >
        {/* Faixa dourada topo */}
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #C9A84C, #E8C97A, #C9A84C)" }} />

        {/* Botão fechar */}
        <button
          onClick={close}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors z-10"
        >
          <X className="w-4 h-4 text-[#7A8FA8]" />
        </button>

        {/* Indicador de etapas */}
        <div className="flex items-center gap-2 px-8 pt-6 pb-0">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i <= step ? "bg-[#C9A84C]" : "bg-[#243A66]"
                } ${i === step ? "w-8" : "w-4"}`}
              />
            </div>
          ))}
          <span className="ml-2 text-xs text-[#7A8FA8]">
            {step + 1}/{STEPS.length}
          </span>
        </div>

        {/* Conteúdo das etapas */}
        <div className="px-8 py-7 min-h-[360px] flex flex-col justify-between">

          {/* ETAPA 1 — Boas-vindas */}
          {step === 0 && (
            <div className="flex flex-col items-center text-center gap-5">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #C9A84C22, #E8C97A11)", border: "1px solid #C9A84C33" }}>
                <Sparkles className="w-9 h-9 text-[#E8C97A]" />
              </div>
              <div>
                <p className="text-xs font-bold text-[#C9A84C] tracking-widest mb-2">V3 PARTNERS</p>
                <h2 className="text-2xl font-bold text-[#F0ECE4] mb-3">
                  Bem-vindo, {firstName}! 🎉
                </h2>
                <p className="text-[#7A8FA8] text-sm leading-relaxed">
                  Sua conta <span className="text-[#E8C97A] font-semibold">
                    {role === "PARTNER_PRO" ? "Partner PRO" : "Partner"}
                  </span> está ativa.
                  Em 4 etapas rápidas vamos te mostrar como começar a operar e gerar sua primeira comissão.
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A1628] border border-[#1B3050] text-xs text-[#7A8FA8]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Leva menos de 2 minutos
              </div>
            </div>
          )}

          {/* ETAPA 2 — Como funciona */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs font-bold text-[#C9A84C] tracking-widest mb-1">COMO FUNCIONA</p>
                <h2 className="text-xl font-bold text-[#F0ECE4]">O fluxo de uma operação</h2>
                <p className="text-[#7A8FA8] text-sm mt-1">Do lead ao pagamento em 3 etapas simples.</p>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  {
                    icon: <Users className="w-5 h-5 text-blue-400" />,
                    color: "bg-blue-500/15 border-blue-500/20",
                    step: "01",
                    title: "Cadastre seus leads",
                    desc: "No CRM, registre seus clientes com potencial para crédito, M&A ou Split Fiscal.",
                  },
                  {
                    icon: <CreditCard className="w-5 h-5 text-[#C9A84C]" />,
                    color: "bg-[#C9A84C]/10 border-[#C9A84C]/20",
                    step: "02",
                    title: "Envie uma proposta",
                    desc: "Nossa Mesa de Crédito analisa em até 48h e você acompanha cada estágio em tempo real.",
                  },
                  {
                    icon: <DollarSign className="w-5 h-5 text-emerald-400" />,
                    color: "bg-emerald-500/10 border-emerald-500/20",
                    step: "03",
                    title: "Receba sua comissão",
                    desc: `Operação fechada = ${role === "PARTNER_PRO" ? "50%" : "30%"} de comissão creditada automaticamente.`,
                  },
                ].map((item) => (
                  <div key={item.step} className={`flex items-start gap-4 p-4 rounded-xl border ${item.color}`}>
                    <div className={`w-9 h-9 rounded-lg ${item.color} flex items-center justify-center flex-shrink-0`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#7A8FA8] mb-0.5">PASSO {item.step}</p>
                      <p className="text-sm font-semibold text-[#F0ECE4]">{item.title}</p>
                      <p className="text-xs text-[#7A8FA8] mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ETAPA 3 — Checklist */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs font-bold text-[#C9A84C] tracking-widest mb-1">SEUS PRIMEIROS PASSOS</p>
                <h2 className="text-xl font-bold text-[#F0ECE4]">5 metas para a primeira semana</h2>
                <p className="text-[#7A8FA8] text-sm mt-1">Complete estas tarefas e estará operando a pleno vapor.</p>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { icon: <CheckCircle2 className="w-4 h-4" />, label: "Concluir o tour de boas-vindas", done: true },
                  { icon: <Users className="w-4 h-4" />, label: "Cadastrar o primeiro lead no CRM", done: false },
                  { icon: <CreditCard className="w-4 h-4" />, label: "Enviar a primeira proposta de crédito", done: false },
                  { icon: <Building2 className="w-4 h-4" />, label: "Explorar o pipeline M&A", done: false },
                  { icon: <GraduationCap className="w-4 h-4" />, label: "Assistir ao primeiro módulo do Academy", done: false },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors
                      ${item.done
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-[#1B3050] bg-[#0A1628]"
                      }`}
                  >
                    <div className={item.done ? "text-emerald-400" : "text-[#7A8FA8]"}>
                      {item.icon}
                    </div>
                    <span className={`text-sm ${item.done ? "text-emerald-400 line-through" : "text-[#F0ECE4]"}`}>
                      {item.label}
                    </span>
                    {item.done && (
                      <span className="ml-auto text-xs text-emerald-400 font-semibold">Feito!</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ETAPA 4 — Escolha sua primeira ação */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs font-bold text-[#C9A84C] tracking-widest mb-1">COMECE AGORA</p>
                <h2 className="text-xl font-bold text-[#F0ECE4]">Por onde quer começar?</h2>
                <p className="text-[#7A8FA8] text-sm mt-1">Escolha a área que mais faz sentido para você agora.</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    icon: <Users className="w-6 h-6 text-blue-400" />,
                    color: "border-blue-500/20 hover:border-blue-500/40 hover:bg-blue-500/5",
                    title: "CRM — Meus Leads",
                    desc: "Comece cadastrando seus clientes",
                    path: "/crm",
                  },
                  {
                    icon: <CreditCard className="w-6 h-6 text-[#C9A84C]" />,
                    color: "border-[#C9A84C]/20 hover:border-[#C9A84C]/40 hover:bg-[#C9A84C]/5",
                    title: "Mesa de Crédito",
                    desc: "Envie sua primeira proposta agora",
                    path: "/mesa-credito",
                  },
                  {
                    icon: <GraduationCap className="w-6 h-6 text-purple-400" />,
                    color: "border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-500/5",
                    title: "Academy V3",
                    desc: "Aprenda a fechar operações maiores",
                    path: "/academy",
                  },
                  {
                    icon: <TrendingUp className="w-6 h-6 text-emerald-400" />,
                    color: "border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/5",
                    title: "Explorar o Dashboard",
                    desc: "Conheça todos os seus KPIs",
                    path: "/dashboard",
                  },
                ].map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border bg-[#0A1628] text-left transition-all duration-200 ${item.color}`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#F0ECE4]">{item.title}</p>
                      <p className="text-xs text-[#7A8FA8]">{item.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#7A8FA8]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navegação */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#1B3050]">
            <button
              onClick={back}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors
                ${step === 0 ? "invisible" : ""}`}
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>

            {!isLast ? (
              <button
                onClick={next}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-[#09081A] transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #C9A84C, #E8C97A)" }}
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={close}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-[#7A8FA8] border border-[#243A66] hover:border-[#C9A84C]/30 hover:text-[#F0ECE4] transition-all"
              >
                Fechar tour
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
