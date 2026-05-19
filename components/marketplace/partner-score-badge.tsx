"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Trophy, TrendingUp, Star, BookOpen, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreBreakdown {
  commissions_closed: number;
  commission_volume: number;
  leads_converted: number;
  academy_certs: number;
  crm_activity: number;
}

interface PartnerScoreData {
  score: number;
  tier: string;
  tier_color: string;
  badge_label: string;
  breakdown: ScoreBreakdown;
}

const TIER_STYLES: Record<string, { ring: string; bg: string; text: string; label: string }> = {
  iniciando:   { ring: "border-[#7A8FA8]/40",  bg: "bg-[#7A8FA8]/10",  text: "text-[#7A8FA8]",  label: "Iniciando" },
  construindo: { ring: "border-amber-700/40",   bg: "bg-amber-700/10",  text: "text-amber-600",   label: "Construindo" },
  ativo:       { ring: "border-[#7A8FA8]/60",   bg: "bg-[#7A8FA8]/15",  text: "text-[#F0ECE4]",  label: "Ativo" },
  expert:      { ring: "border-[#C9A84C]/50",   bg: "bg-[#C9A84C]/10",  text: "text-[#C9A84C]",  label: "Expert" },
  elite:       { ring: "border-purple-500/50",  bg: "bg-purple-500/10", text: "text-purple-400", label: "Elite V3" },
};

const BREAKDOWN_ITEMS = [
  { key: "commissions_closed" as const, label: "Comissões fechadas",  max: 30, icon: Trophy },
  { key: "commission_volume"  as const, label: "Volume de comissões", max: 25, icon: TrendingUp },
  { key: "leads_converted"    as const, label: "Leads convertidos",   max: 20, icon: Star },
  { key: "academy_certs"      as const, label: "Certificações",        max: 15, icon: BookOpen },
  { key: "crm_activity"       as const, label: "Atividade CRM",        max: 10, icon: Activity },
];

/* ── Score Breakdown Modal ──────────────────────────────── */
function ScoreModal({ data, onClose }: { data: PartnerScoreData; onClose: () => void }) {
  const style = TIER_STYLES[data.tier] ?? TIER_STYLES.iniciando;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#09081A] border border-[#1B3050] rounded-2xl w-full max-w-sm">
        {/* Header */}
        <div className="border-b border-[#1B3050] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#C9A84C]" />
            <h2 className="text-[#F0ECE4] font-bold text-sm">Meu Score V3</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-[#7A8FA8]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Score display */}
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-20 h-20 rounded-2xl border-2 flex flex-col items-center justify-center flex-shrink-0",
              style.ring, style.bg
            )}>
              <span className={cn("text-3xl font-bold", style.text)}>{data.score}</span>
              <span className="text-[#7A8FA8] text-[9px] uppercase tracking-wider">pts</span>
            </div>
            <div>
              <div className={cn("inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-bold mb-1", style.ring, style.bg, style.text)}>
                {data.badge_label}
              </div>
              <p className="text-[#7A8FA8] text-xs">Pontuação baseada em sua atividade na plataforma</p>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[9px] text-[#7A8FA8] uppercase tracking-wider mb-1.5">
              <span>0</span><span>Iniciando</span><span>Construindo</span><span>Ativo</span><span>Expert</span><span>Elite</span>
            </div>
            <div className="h-2 bg-[#111F35] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] rounded-full transition-all duration-500"
                style={{ width: `${data.score}%` }}
              />
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider">Detalhamento</p>
            {BREAKDOWN_ITEMS.map(({ key, label, max, icon: Icon }) => {
              const pts = data.breakdown[key];
              const pct = Math.round((pts / max) * 100);
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icon className="w-3 h-3 text-[#7A8FA8]" />
                      <span className="text-[#7A8FA8] text-xs">{label}</span>
                    </div>
                    <span className="text-[#F0ECE4] text-xs font-semibold">{pts}/{max} pts</span>
                  </div>
                  <div className="h-1 bg-[#111F35] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#C9A84C]/60 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[#7A8FA8] text-[10px] text-center">
            Atualize vendas, leads e certificados para subir de tier.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Partner Score Badge ─────────────────────────────────── */
export function PartnerScoreBadge({ partnerId, compact = false }: {
  partnerId?: string;
  compact?: boolean;
}) {
  const [data, setData] = useState<PartnerScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const url = partnerId
      ? `/api/marketplace/partner-score?partner_id=${partnerId}`
      : "/api/marketplace/partner-score";

    fetch(url)
      .then(r => r.json())
      .then(j => { if (j.score !== undefined) setData(j); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [partnerId]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111F35] border border-[#1B3050]">
        <Loader2 className="w-3 h-3 animate-spin text-[#7A8FA8]" />
        <span className="text-[#7A8FA8] text-xs">Score...</span>
      </div>
    );
  }

  if (!data) return null;

  const style = TIER_STYLES[data.tier] ?? TIER_STYLES.iniciando;

  if (compact) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          title="Ver detalhes do score"
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition-all hover:opacity-80",
            style.ring, style.bg, style.text
          )}
        >
          <Trophy className="w-3 h-3" />
          {data.badge_label} · {data.score}
        </button>
        {modalOpen && <ScoreModal data={data} onClose={() => setModalOpen(false)} />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:opacity-80 w-full text-left",
          style.ring, style.bg
        )}
      >
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", style.bg, "border", style.ring)}>
          <Trophy className={cn("w-5 h-5", style.text)} />
        </div>
        <div>
          <p className={cn("text-sm font-bold", style.text)}>{data.badge_label}</p>
          <p className="text-[#7A8FA8] text-xs">{data.score}/100 pts · Clique para detalhes</p>
        </div>
      </button>
      {modalOpen && <ScoreModal data={data} onClose={() => setModalOpen(false)} />}
    </>
  );
}
