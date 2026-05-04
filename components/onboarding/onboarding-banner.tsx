"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp,
  Users, CreditCard, GraduationCap, UserCircle, Sparkles,
} from "lucide-react";

const WIZARD_KEY  = "v3_onboarding_wizard_done";
const ACADEMY_KEY = "v3_onboarding_academy_visited";
const DONE_KEY    = "v3_onboarding_banner_done";

interface OnboardingBannerProps {
  role: string;
  hasFullName: boolean;
}

interface StepData {
  id: string;
  label: string;
  icon: React.ReactNode;
  done: boolean;
  action?: string;
  actionLabel?: string;
}

export function OnboardingBanner({ role, hasFullName }: OnboardingBannerProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [crmDone, setCrmDone] = useState(false);
  const [propostaDone, setPropostaDone] = useState(false);
  const [wizardDone, setWizardDone] = useState(false);
  const [academyDone, setAcademyDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!["PARTNER", "PARTNER_PRO"].includes(role)) {
      setLoading(false);
      return;
    }
    if (typeof window !== "undefined") {
      setWizardDone(!!localStorage.getItem(WIZARD_KEY));
      setAcademyDone(!!localStorage.getItem(ACADEMY_KEY));
      setHidden(!!localStorage.getItem(DONE_KEY));
    }
    fetch("/api/onboarding/progress")
      .then((r) => r.json())
      .then((d) => {
        setCrmDone(d.crmLeads > 0);
        setPropostaDone(d.proposals > 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [role]);

  if (!["PARTNER", "PARTNER_PRO"].includes(role) || hidden || loading) return null;

  const steps: StepData[] = [
    {
      id: "wizard",
      label: "Concluir o tour de boas-vindas",
      icon: <Sparkles className="w-4 h-4" />,
      done: wizardDone,
    },
    {
      id: "profile",
      label: "Completar seu perfil",
      icon: <UserCircle className="w-4 h-4" />,
      done: hasFullName,
      action: "/perfil",
      actionLabel: "Completar perfil",
    },
    {
      id: "crm",
      label: "Cadastrar o primeiro lead no CRM",
      icon: <Users className="w-4 h-4" />,
      done: crmDone,
      action: "/crm",
      actionLabel: "Ir para o CRM",
    },
    {
      id: "proposta",
      label: "Enviar a primeira proposta de crédito",
      icon: <CreditCard className="w-4 h-4" />,
      done: propostaDone,
      action: "/mesa-credito",
      actionLabel: "Mesa de Crédito",
    },
    {
      id: "academy",
      label: "Explorar o Academy V3",
      icon: <GraduationCap className="w-4 h-4" />,
      done: academyDone,
      action: "/academy",
      actionLabel: "Acessar Academy",
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const totalSteps     = steps.length;
  const progress       = Math.round((completedCount / totalSteps) * 100);
  const allDone        = completedCount === totalSteps;

  function dismissBanner() {
    localStorage.setItem(DONE_KEY, "true");
    setHidden(true);
  }

  function goTo(path: string) {
    if (path === "/academy") localStorage.setItem(ACADEMY_KEY, "true");
    router.push(path);
  }

  if (allDone) {
    return (
      <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-emerald-400">Onboarding concluído! Você está pronto para operar. 🚀</p>
          <p className="text-xs text-emerald-400/60 mt-0.5">Explore todos os módulos e comece a fechar operações.</p>
        </div>
        <button
          onClick={dismissBanner}
          className="text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors px-3 py-1.5 border border-[#243A66] rounded-lg"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#243A66] overflow-hidden" style={{ background: "#0D1929" }}>
      {/* Header */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #C9A84C22, #E8C97A11)", border: "1px solid #C9A84C33" }}>
          <Sparkles className="w-4 h-4 text-[#C9A84C]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-bold text-[#F0ECE4]">
              Primeiros Passos — {completedCount}/{totalSteps} concluídos
            </p>
            <span className="text-xs font-semibold text-[#C9A84C] ml-4 flex-shrink-0">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #C9A84C, #E8C97A)",
              }}
            />
          </div>
        </div>
        <div className="text-[#7A8FA8] ml-3">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Checklist expandido */}
      {expanded && (
        <div className="px-5 pb-4 border-t border-[#1B3050]">
          <div className="flex flex-col gap-2 mt-3">
            {steps.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors
                  ${s.done
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-[#1B3050] bg-[#0A1628]"
                  }`}
              >
                <div className={s.done ? "text-emerald-400" : "text-[#7A8FA8]"}>
                  {s.done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                </div>
                <div className={`flex-1 flex items-center gap-2`}>
                  <span className={s.done ? "text-emerald-400" : "text-[#7A8FA8]"}>{s.icon}</span>
                  <span className={`text-sm ${s.done ? "text-emerald-400 line-through" : "text-[#F0ECE4]"}`}>
                    {s.label}
                  </span>
                </div>
                {!s.done && s.action && (
                  <button
                    onClick={() => goTo(s.action!)}
                    className="text-xs font-semibold text-[#C9A84C] hover:text-[#E8C97A] transition-colors flex-shrink-0"
                  >
                    {s.actionLabel} →
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end mt-3">
            <button
              onClick={dismissBanner}
              className="text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
            >
              Ocultar este painel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
