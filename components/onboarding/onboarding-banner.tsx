"use client";

import { useState, useEffect } from "react";
import { X, CheckCircle2, Circle, User, Zap, Wallet, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Step {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    id: "profile",
    label: "Complete seu perfil",
    description: "Adicione nome, telefone e CPF nas configurações",
    href: "/configuracoes",
    icon: <User className="w-4 h-4" />,
  },
  {
    id: "operation",
    label: "Cadastre sua primeira operação",
    description: "Envie uma proposta de crédito ou M&A para sua carteira",
    href: "/mesa-credito/nivel-1",
    icon: <Zap className="w-4 h-4" />,
  },
  {
    id: "commission",
    label: "Acompanhe suas comissões",
    description: "Veja seu histórico financeiro e status de repasses",
    href: "/comissoes",
    icon: <Wallet className="w-4 h-4" />,
  },
];

interface Props {
  role: string;
  hasFullName: boolean;
}

export function OnboardingBanner({ role, hasFullName }: Props) {
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    if (!["PARTNER", "PARTNER_PRO"].includes(role)) return;
    fetch("/api/profile")
      .then(r => r.json())
      .then(({ profile }) => {
        if (!profile?.onboarding_dismissed) setVisible(true);
      })
      .catch(() => {});
  }, [role]);

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_dismissed: true }),
      });
    } catch {
      // ignore
    }
    setVisible(false);
    setDismissing(false);
  };

  if (!visible) return null;

  const completedSteps = hasFullName ? 1 : 0;
  const totalSteps = STEPS.length;

  return (
    <div
      className="rounded-2xl border border-[#C9A84C]/20 bg-[#111F35] p-5"
      style={{ boxShadow: "0 0 0 1px rgba(201,168,76,0.06), 0 8px 24px rgba(0,0,0,0.3)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-[#C9A84C]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#F0ECE4]">Primeiros passos na V3</p>
            <p className="text-xs text-[#7A8FA8] mt-0.5">
              {completedSteps}/{totalSteps} etapas concluídas
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors text-[#7A8FA8] hover:text-[#F0ECE4]"
          title="Dispensar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-4">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] transition-all duration-500"
          style={{ width: `${Math.round((completedSteps / totalSteps) * 100)}%` }}
        />
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STEPS.map((step, idx) => {
          const done = idx === 0 && hasFullName;
          return (
            <Link
              key={step.id}
              href={step.href}
              className="flex items-start gap-3 p-3 rounded-xl bg-[#0D1929]/60 border border-[#243A66]/60 hover:border-[#C9A84C]/30 hover:bg-[#C9A84C]/05 transition-all group"
            >
              <div className={`mt-0.5 flex-shrink-0 ${done ? "text-emerald-400" : "text-[#7A8FA8]"}`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${done ? "text-emerald-400 line-through" : "text-[#F0ECE4]"}`}>
                  {step.label}
                </p>
                <p className="text-[10px] text-[#7A8FA8] mt-0.5 leading-relaxed">{step.description}</p>
              </div>
              <ArrowRight className="w-3 h-3 text-[#7A8FA8] group-hover:text-[#C9A84C] transition-colors flex-shrink-0 mt-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
