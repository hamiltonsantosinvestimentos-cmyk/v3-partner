"use client";
import { useState, useEffect } from "react";
import { Play, CheckCircle2, Lock, Rocket, ChevronDown, ChevronUp } from "lucide-react";

const TRAIL_STEPS = [
  { id: 0, title: "Como funciona a V3 Partners", duration: "5 min", desc: "Visão geral da plataforma e seus módulos" },
  { id: 1, title: "Seu primeiro deal no Marketplace", duration: "8 min", desc: "Passo a passo para enviar seu primeiro lead" },
  { id: 2, title: "CRM para assessores financeiros", duration: "6 min", desc: "Organize sua carteira e acompanhe clientes" },
  { id: 3, title: "Crédito estruturado — fundamentos", duration: "10 min", desc: "Entenda as principais linhas de crédito" },
  { id: 4, title: "M&A para assessores independentes", duration: "12 min", desc: "Como originar e estruturar operações de M&A" },
];

export function OnboardingTrail({ isNew }: { isNew: boolean }) {
  const [progress, setProgress] = useState<number[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("onboarding-trail-progress");
    if (saved) {
      try { setProgress(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  if (!mounted) return null;
  if (!isNew && progress.length === TRAIL_STEPS.length) return null;

  function markDone(id: number) {
    const next = [...new Set([...progress, id])];
    setProgress(next);
    localStorage.setItem("onboarding-trail-progress", JSON.stringify(next));
  }

  const doneCount = progress.length;
  const pct = Math.round((doneCount / TRAIL_STEPS.length) * 100);
  const allDone = doneCount === TRAIL_STEPS.length;

  return (
    <div className="rounded-2xl border border-[#C9A84C]/40 overflow-hidden mb-6" style={{ background: "#0A1525" }}>
      <div className="h-1" style={{ background: `linear-gradient(90deg, #C9A84C ${pct}%, #162744 ${pct}%)` }} />

      <div className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-[#C9A84C]" />
            <h3 className="text-sm font-bold text-[#F0ECE4]">Trilha de Boas-Vindas V3</h3>
            {allDone && (
              <span className="text-[10px] font-black text-[#09081A] bg-[#C9A84C] px-2 py-0.5 rounded-full">
                COMPLETO 🎉
              </span>
            )}
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-[#7A8FA8] mb-4">
          {doneCount}/{TRAIL_STEPS.length} aulas concluídas · Complete para desbloquear todas as funcionalidades
        </p>

        {!collapsed && (
          <div className="space-y-2">
            {TRAIL_STEPS.map((step, idx) => {
              const done = progress.includes(step.id);
              const locked = idx > 0 && !progress.includes(idx - 1);
              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    done
                      ? "border-[#C9A84C]/30 bg-[#C9A84C]/5"
                      : locked
                      ? "border-[#1B3050] bg-[#111F35] opacity-50"
                      : "border-[#1B3050] bg-[#111F35]"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      done ? "bg-[#C9A84C]/20" : locked ? "bg-[#162744]" : "bg-[#1B3050]"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="w-4 h-4 text-[#C9A84C]" />
                    ) : locked ? (
                      <Lock className="w-4 h-4 text-[#7A8FA8]" />
                    ) : (
                      <Play className="w-4 h-4 text-[#F0ECE4]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#F0ECE4] truncate">{step.title}</p>
                    <p className="text-[10px] text-[#7A8FA8]">
                      {step.duration} · {step.desc}
                    </p>
                  </div>
                  {!done && !locked && (
                    <button
                      onClick={() => markDone(step.id)}
                      className="text-[10px] font-bold text-[#C9A84C] hover:text-[#E8C97A] whitespace-nowrap transition-colors"
                    >
                      Marcar feito ✓
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
