"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  UserCircle,
  ShoppingBag,
  Send,
  GraduationCap,
  Users,
  Handshake,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";

const DISMISSED_KEY = "onboarding-dismissed";

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  href?: string;
  ctaLabel?: string;
  alwaysDone?: boolean;
}

const STEPS: Step[] = [
  {
    id: "account_created",
    icon: <CheckCircle2 className="w-4 h-4" />,
    title: "Conta criada",
    subtitle: "Bem-vindo à V3 Partners!",
    alwaysDone: true,
  },
  {
    id: "profile_configured",
    icon: <UserCircle className="w-4 h-4" />,
    title: "Configure seu perfil",
    subtitle: "Adicione suas informações e foto",
    href: "/perfil",
    ctaLabel: "Configurar",
  },
  {
    id: "marketplace_explored",
    icon: <ShoppingBag className="w-4 h-4" />,
    title: "Explore o Marketplace",
    subtitle: "Conheça nossos produtos e comissões",
    href: "/marketplace",
    ctaLabel: "Explorar",
  },
  {
    id: "first_lead_sent",
    icon: <Send className="w-4 h-4" />,
    title: "Envie seu primeiro lead",
    subtitle: "Indique um cliente para ganhar comissão",
    href: "/marketplace",
    ctaLabel: "Enviar lead",
  },
  {
    id: "academy_trail",
    icon: <GraduationCap className="w-4 h-4" />,
    title: "Complete uma trilha na Academy",
    subtitle: "Treinamentos para acelerar seus deals",
    href: "/academy",
    ctaLabel: "Ir para Academy",
  },
  {
    id: "crm_contact",
    icon: <Users className="w-4 h-4" />,
    title: "Cadastre um contato no CRM",
    subtitle: "Organize seus leads e follow-ups",
    href: "/crm",
    ctaLabel: "Abrir CRM",
  },
  {
    id: "first_indication",
    icon: <Handshake className="w-4 h-4" />,
    title: "Faça sua primeira indicação",
    subtitle: "Comece a gerar receita agora",
    href: "/indicacoes",
    ctaLabel: "Indicar",
  },
];

interface OnboardingChecklistProps {
  completedSteps: string[];
}

export function OnboardingChecklist({ completedSteps }: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    setDismissed(isDismissed);
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  const resolvedCompleted = new Set([
    ...completedSteps,
    "account_created", // always done
  ]);

  const totalDone = STEPS.filter((s) => resolvedCompleted.has(s.id)).length;
  const allDone = totalDone === STEPS.length;
  const progressPct = Math.round((totalDone / STEPS.length) * 100);

  // Collapse automatically when all done
  useEffect(() => {
    if (allDone) setCollapsed(true);
  }, [allDone]);

  if (!mounted || dismissed) return null;

  // Circumference for ring: r=18 → C ≈ 113.1
  const RADIUS = 18;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC - (progressPct / 100) * CIRC;

  return (
    <div
      className="rounded-xl border border-[#C9A84C]/30 bg-[#111F35] overflow-hidden"
      style={{ fontFamily: "DM Sans, sans-serif" }}
    >
      {/* Gold progress bar at very top */}
      <div className="h-1 bg-[#243A66] w-full">
        <div
          className="h-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] transition-all duration-700"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Header row */}
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Circular progress ring */}
        <div className="flex-shrink-0 relative w-12 h-12">
          <svg width="48" height="48" className="-rotate-90">
            <circle
              cx="24"
              cy="24"
              r={RADIUS}
              fill="none"
              stroke="#243A66"
              strokeWidth="4"
            />
            <circle
              cx="24"
              cy="24"
              r={RADIUS}
              fill="none"
              stroke="#C9A84C"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={dashOffset}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            {allDone ? (
              <Trophy className="w-4 h-4 text-[#C9A84C]" />
            ) : (
              <span className="text-[9px] font-bold text-[#C9A84C] leading-none">
                {totalDone}/{STEPS.length}
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-0.5">
            Jornada de Onboarding
          </p>
          <p className="text-sm font-bold text-[#F0ECE4] leading-tight">
            Conquiste seu primeiro deal em 7 dias!
          </p>
          <p className="text-xs text-[#7A8FA8] mt-0.5">
            {totalDone}/{STEPS.length} completos · {progressPct}% concluído
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="w-8 h-8 rounded-lg bg-[#162744] hover:bg-[#243A66] flex items-center justify-center transition-colors text-[#7A8FA8] hover:text-[#F0ECE4]"
            aria-label={collapsed ? "Expandir checklist" : "Recolher checklist"}
          >
            {collapsed ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleDismiss}
            className="w-8 h-8 rounded-lg bg-[#162744] hover:bg-[#243A66] flex items-center justify-center transition-colors text-[#7A8FA8] hover:text-red-400"
            aria-label="Dispensar onboarding"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Steps list */}
      {!collapsed && (
        <div className="px-5 pb-5 space-y-2">
          <div className="h-px bg-[#243A66] mb-4" />
          {STEPS.map((step, idx) => {
            const done = resolvedCompleted.has(step.id);
            return (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  done
                    ? "border-[#C9A84C]/20 bg-[#C9A84C]/5"
                    : "border-[#243A66] bg-[#09081A] hover:border-[#C9A84C]/30"
                }`}
              >
                {/* Step number / check icon */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-colors ${
                    done
                      ? "bg-[#C9A84C]/20 text-[#C9A84C]"
                      : "bg-[#162744] text-[#7A8FA8]"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span className="text-[10px]">{idx + 1}</span>
                  )}
                </div>

                {/* Step icon */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    done ? "text-[#C9A84C]" : "text-[#7A8FA8]"
                  }`}
                >
                  {step.icon}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-semibold leading-tight ${
                      done ? "text-[#C9A84C] line-through opacity-70" : "text-[#F0ECE4]"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-[11px] text-[#7A8FA8] mt-0.5 leading-tight">
                    {step.subtitle}
                  </p>
                </div>

                {/* CTA or checkmark */}
                {done ? (
                  <div className="flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-[#C9A84C]" />
                  </div>
                ) : step.href ? (
                  <Link
                    href={step.href}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-bold hover:bg-[#C9A84C]/20 transition-colors whitespace-nowrap"
                  >
                    {step.ctaLabel}
                  </Link>
                ) : (
                  <Circle className="w-5 h-5 text-[#243A66] flex-shrink-0" />
                )}
              </div>
            );
          })}

          {allDone && (
            <div className="mt-4 flex items-center gap-3 p-4 rounded-xl border border-[#C9A84C]/40 bg-[#C9A84C]/10">
              <Trophy className="w-6 h-6 text-[#C9A84C] flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-[#C9A84C]">
                  Parabens! Onboarding completo.
                </p>
                <p className="text-xs text-[#7A8FA8] mt-0.5">
                  Voce esta pronto para conquistar seus primeiros deals!
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
