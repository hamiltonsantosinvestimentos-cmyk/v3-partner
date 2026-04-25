"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy, Medal, Crown, TrendingUp, CheckCircle2, DollarSign,
  Star, Award, Flame, Target, Zap, Building2, Sparkles,
  Shield, Gem, ChevronUp, Users, Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RankingScore {
  id: string; name: string; avatar: string; role: string;
  score: number; proposals: number; approvals: number; deals: number; volume: number;
}
export interface RankingPropostas {
  id: string; name: string; avatar: string; role: string;
  proposals: number; growth: number; region: string;
}
export interface RankingAprovacoes {
  id: string; name: string; avatar: string; role: string;
  approved: number; rate: number; volume: number;
}
export interface RankingVolume {
  id: string; name: string; avatar: string; role: string;
  volume: number; deals: number; avg: number;
}
export interface PartnerGoal {
  partner_id: string;
  goal_proposals: number;
  goal_approvals: number;
  goal_volume: number;
  goal_deals: number;
}
export interface RankingData {
  score:      RankingScore[];
  propostas:  RankingPropostas[];
  aprovacoes: RankingAprovacoes[];
  volume:     RankingVolume[];
}

type Tab = "score" | "propostas" | "aprovacoes" | "volume";

// ─── Tier System ─────────────────────────────────────────────────────────────

const TIERS = [
  { id: "bronze",   label: "Bronze",   minScore: 0,   maxScore: 49,   color: "#CD7F32", bg: "from-[#CD7F32]/20 to-[#CD7F32]/5",  icon: <Shield className="w-4 h-4" />,  next: 50  },
  { id: "prata",    label: "Prata",    minScore: 50,  maxScore: 149,  color: "#C0C0C0", bg: "from-[#C0C0C0]/20 to-[#C0C0C0]/5",  icon: <Medal className="w-4 h-4" />,   next: 150 },
  { id: "ouro",     label: "Ouro",     minScore: 150, maxScore: 299,  color: "#FFD700", bg: "from-[#FFD700]/20 to-[#FFD700]/5",  icon: <Star className="w-4 h-4" />,    next: 300 },
  { id: "diamante", label: "Diamante", minScore: 300, maxScore: 499,  color: "#a78bfa", bg: "from-[#a78bfa]/20 to-[#a78bfa]/5",  icon: <Gem className="w-4 h-4" />,     next: 500 },
  { id: "elite",    label: "Elite",    minScore: 500, maxScore: 99999,color: "#C9A84C", bg: "from-[#C9A84C]/20 to-[#C9A84C]/5",  icon: <Crown className="w-4 h-4" />,   next: null },
];

function getTier(score: number) {
  return TIERS.find(t => score >= t.minScore && score <= t.maxScore) ?? TIERS[0];
}

function getTierProgress(score: number) {
  const tier = getTier(score);
  if (!tier.next) return 100;
  return Math.min(Math.round(((score - tier.minScore) / (tier.next - tier.minScore)) * 100), 100);
}

// ─── Badge System ─────────────────────────────────────────────────────────────

interface BadgeDef {
  id: string;
  label: string;
  desc: string;
  icon: string;
  color: string;
  check: (s: RankingScore, isTop1Score: boolean, isTop1Volume: boolean) => boolean;
}

const BADGE_DEFS: BadgeDef[] = [
  { id: "primeiro_passo",  label: "Primeiro Passo",    desc: "Enviou a primeira proposta",         icon: "🚀", color: "#3B82F6", check: (s) => s.proposals >= 1 },
  { id: "em_chamas",       label: "Em Chamas",          desc: "5+ propostas no período",            icon: "🔥", color: "#F97316", check: (s) => s.proposals >= 5 },
  { id: "imparavel",       label: "Imparável",          desc: "10+ propostas no período",           icon: "⚡", color: "#EAB308", check: (s) => s.proposals >= 10 },
  { id: "aprovador",       label: "Aprovador",          desc: "Primeira operação aprovada",         icon: "✅", color: "#10B981", check: (s) => s.approvals >= 1 },
  { id: "atirador",        label: "Atirador de Elite",  desc: "3+ aprovações no período",           icon: "🎯", color: "#10B981", check: (s) => s.approvals >= 3 },
  { id: "milionario",      label: "Milionário",         desc: "R$ 1M+ em volume captado",           icon: "💰", color: "#C9A84C", check: (s) => s.volume >= 1_000_000 },
  { id: "mega_captador",   label: "Mega Captador",      desc: "R$ 5M+ em volume captado",           icon: "💎", color: "#a78bfa", check: (s) => s.volume >= 5_000_000 },
  { id: "deal_maker",      label: "Deal Maker",         desc: "Fechou um deal M&A",                 icon: "🤝", color: "#6366F1", check: (s) => s.deals >= 1 },
  { id: "top_captador",    label: "Top Captador",       desc: "Líder em volume no período",         icon: "👑", color: "#FFD700", check: (_, _s, isTop1Volume) => isTop1Volume },
  { id: "partner_mes",     label: "Partner do Mês",     desc: "1º lugar no ranking geral",          icon: "🏆", color: "#FFD700", check: (_, isTop1Score) => isTop1Score },
  { id: "consistente",     label: "Consistente",        desc: "3+ propostas e 1+ aprovação",        icon: "🌟", color: "#E8C97A", check: (s) => s.proposals >= 3 && s.approvals >= 1 },
  { id: "alta_conversao",  label: "Alta Conversão",     desc: "Taxa de aprovação acima de 70%",     icon: "📈", color: "#10B981",
    check: (s) => s.proposals >= 2 && (s.approvals / s.proposals) >= 0.7 },
];

function computeBadges(entry: RankingScore, isTop1Score: boolean, isTop1Volume: boolean): BadgeDef[] {
  return BADGE_DEFS.filter(b => b.check(entry, isTop1Score, isTop1Volume));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  { id: "propostas",  label: "Mais Propostas",  icon: <Target className="w-4 h-4" />,       color: "#3B82F6", desc: "Parceiros que mais submeteram propostas no período" },
  { id: "aprovacoes", label: "Mais Aprovações", icon: <CheckCircle2 className="w-4 h-4" />, color: "#10B981", desc: "Parceiros com maior número de operações aprovadas" },
  { id: "volume",     label: "Maior Volume",    icon: <DollarSign className="w-4 h-4" />,   color: "#C9A84C", desc: "Parceiros com maior volume financeiro de operações" },
];

const PERIOD_LABELS: Record<string, string> = {
  semana: "7 dias", mes: "Este mês", trim: "Trimestre", ano: "Este ano",
};

const MEDAL_COLORS = [
  { bg: "from-[#FFD700] to-[#FFA500]", text: "#7A5A00", ring: "#FFD700", label: "Ouro" },
  { bg: "from-[#C0C0C0] to-[#A8A8A8]", text: "#4A4A4A", ring: "#C0C0C0", label: "Prata" },
  { bg: "from-[#CD7F32] to-[#A0522D]", text: "#FFFFFF", ring: "#CD7F32", label: "Bronze" },
];

function formatVolume(v: number) {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

type AnyRank = RankingScore | RankingPropostas | RankingAprovacoes | RankingVolume;

function getValue(tab: Tab, item: AnyRank): string {
  if (tab === "score")      return `${(item as RankingScore).score} pts`;
  if (tab === "propostas")  return `${(item as RankingPropostas).proposals} propostas`;
  if (tab === "aprovacoes") return `${(item as RankingAprovacoes).approved} aprovações`;
  return formatVolume((item as RankingVolume).volume);
}

// ─── Podium ───────────────────────────────────────────────────────────────────

function Podium({ tab, data, scoreData }: { tab: Tab; data: AnyRank[]; scoreData: RankingScore[] }) {
  const top3 = data.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]];
  const heights = ["h-24", "h-36", "h-16"];
  const positions = [2, 1, 3];
  const top1ScoreId = scoreData[0]?.id;
  const top1VolumeId = [...scoreData].sort((a, b) => b.volume - a.volume)[0]?.id;

  return (
    <div className="flex items-end justify-center gap-3 pt-4 pb-2">
      {order.map((item, idx) => {
        if (!item) return <div key={idx} className="w-28" />;
        const medal = MEDAL_COLORS[positions[idx] - 1];
        const isFirst = positions[idx] === 1;
        const scoreEntry = scoreData.find(s => s.id === item.id);
        const tier = scoreEntry ? getTier(scoreEntry.score) : TIERS[0];
        return (
          <div key={item.id} className="flex flex-col items-center gap-2 w-28">
            {isFirst && (
              <div className="flex flex-col items-center gap-1">
                <Crown className="w-6 h-6 animate-bounce" style={{ color: "#FFD700", filter: "drop-shadow(0 0 8px #FFD70088)" }} />
                <span className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest">Campeão</span>
              </div>
            )}
            <div className="relative">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-black shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${medal.ring}CC, ${medal.ring}88)`,
                  color: medal.text,
                  boxShadow: `0 0 0 3px ${medal.ring}66, 0 8px 24px rgba(0,0,0,0.4)`,
                }}>
                {item.avatar}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                style={{ background: medal.ring, color: medal.text, boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}>
                {positions[idx]}
              </div>
              {/* Tier badge */}
              <div className="absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: tier.color, boxShadow: `0 0 6px ${tier.color}88` }}
                title={tier.label}>
                <span className="text-[8px] font-black text-white">{tier.label[0]}</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-white leading-tight">{item.name.split(" ")[0]}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{item.name.split(" ").slice(1).join(" ")}</p>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: `${tier.color}22`, color: tier.color }}>{tier.label}</span>
            </div>
            <p className="text-xs font-bold text-center" style={{ color: medal.ring }}>{getValue(tab, item)}</p>
            {/* Badges preview */}
            {scoreEntry && (
              <div className="flex gap-0.5 flex-wrap justify-center">
                {computeBadges(scoreEntry, scoreEntry.id === top1ScoreId, scoreEntry.id === top1VolumeId).slice(0, 3).map(b => (
                  <span key={b.id} title={b.label} className="text-sm">{b.icon}</span>
                ))}
              </div>
            )}
            <div className={`w-full ${heights[idx]} rounded-t-xl flex items-start justify-center pt-2`}
              style={{
                background: `linear-gradient(180deg, ${medal.ring}30 0%, ${medal.ring}10 100%)`,
                border: `1px solid ${medal.ring}40`,
                borderBottom: "none",
              }}>
              <span className="text-xl font-black" style={{ color: `${medal.ring}88` }}>{positions[idx]}º</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Rank Row ─────────────────────────────────────────────────────────────────

function RankRow({ item, position, tab, maxVal, scoreData }: {
  item: AnyRank; position: number; tab: Tab; maxVal: number; scoreData: RankingScore[];
}) {
  const [expanded, setExpanded] = useState(false);
  const scoreEntry = scoreData.find(s => s.id === item.id);
  const tier = scoreEntry ? getTier(scoreEntry.score) : TIERS[0];
  const top1ScoreId = scoreData[0]?.id;
  const top1VolumeId = [...scoreData].sort((a, b) => b.volume - a.volume)[0]?.id;
  const badges = scoreEntry ? computeBadges(scoreEntry, item.id === top1ScoreId, item.id === top1VolumeId) : [];
  const tierProgress = scoreEntry ? getTierProgress(scoreEntry.score) : 0;
  const nextTier = TIERS[TIERS.findIndex(t => t.id === tier.id) + 1];

  function getBarVal() {
    if (tab === "score")      return (item as RankingScore).score;
    if (tab === "propostas")  return (item as RankingPropostas).proposals;
    if (tab === "aprovacoes") return (item as RankingAprovacoes).approved;
    return (item as RankingVolume).volume;
  }
  function getExtra() {
    if (tab === "score") {
      const s = item as RankingScore;
      return (
        <div className="flex gap-2 text-[10px] text-muted-foreground">
          <span>{s.proposals}p</span>
          <span className="text-emerald-400">{s.approvals}✓</span>
          {s.deals > 0 && <span className="text-purple-400">{s.deals} M&A</span>}
        </div>
      );
    }
    if (tab === "aprovacoes") {
      const r = (item as RankingAprovacoes).rate;
      return <span className="text-xs text-muted-foreground">{r}% aprovação</span>;
    }
    if (tab === "volume") {
      const avg = (item as RankingVolume).avg;
      return avg > 0 ? <span className="text-xs text-muted-foreground">média {formatVolume(avg)}</span> : null;
    }
    return null;
  }

  const barPct = maxVal > 0 ? (getBarVal() / maxVal) * 100 : 0;
  const tabColors: Record<Tab, string> = { score: "#C9A84C", propostas: "#3B82F6", aprovacoes: "#10B981", volume: "#C9A84C" };
  const barColor = tabColors[tab];
  const isTop3 = position <= 3;

  return (
    <div className={`rounded-xl transition-all ${isTop3 ? "bg-[#0F1E35] border border-[#C9A84C]/20" : "hover:bg-[#0F1E35]/50"}`}>
      <div className="flex items-center gap-4 px-4 py-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {/* Position */}
        <div className="w-7 flex-shrink-0 text-center">
          {position === 1 ? <Crown className="w-5 h-5 mx-auto" style={{ color: "#FFD700" }} />
          : position === 2 ? <Medal className="w-5 h-5 mx-auto" style={{ color: "#C0C0C0" }} />
          : position === 3 ? <Medal className="w-5 h-5 mx-auto" style={{ color: "#CD7F32" }} />
          : <span className="text-sm font-bold text-muted-foreground">{position}º</span>}
        </div>

        {/* Avatar com tier */}
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: position <= 3
                ? `linear-gradient(135deg, ${MEDAL_COLORS[position - 1].ring}88, ${MEDAL_COLORS[position - 1].ring}44)`
                : `${tier.color}22`,
              color: position <= 3 ? MEDAL_COLORS[position - 1].text : tier.color,
              border: `1px solid ${position <= 3 ? MEDAL_COLORS[position - 1].ring + "44" : tier.color + "44"}`,
            }}>
            {item.avatar}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: tier.color }} title={tier.label}>
            <span className="text-[7px] font-black text-white">{tier.label[0]}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white truncate">{item.name}</span>
            {position === 1 && <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
            {/* Badges preview — top 4 */}
            <div className="flex gap-0.5">
              {badges.slice(0, 4).map(b => (
                <span key={b.id} title={b.label} className="text-xs">{b.icon}</span>
              ))}
              {badges.length > 4 && <span className="text-[9px] text-muted-foreground">+{badges.length - 4}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[#122036] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barPct}%`, background: barColor }} />
            </div>
            {getExtra()}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-base font-black text-white">{getValue(tab, item)}</p>
          <span className="text-[10px] font-semibold" style={{ color: tier.color }}>{tier.label}</span>
        </div>
        <ChevronUp className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expanded ? "" : "rotate-180"}`} />
      </div>

      {/* Expanded: tier progress + badges */}
      {expanded && scoreEntry && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#122036]/50 pt-3">
          {/* Tier progress */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span style={{ color: tier.color }}>{tier.icon}</span>
                <span className="text-xs font-bold" style={{ color: tier.color }}>{tier.label}</span>
              </div>
              {nextTier ? (
                <span className="text-[10px] text-muted-foreground">
                  {scoreEntry.score} / {tier.next} pts → <span style={{ color: nextTier.color }}>{nextTier.label}</span>
                </span>
              ) : (
                <span className="text-[10px] font-bold text-[#C9A84C]">Nível máximo ✓</span>
              )}
            </div>
            <div className="h-2 bg-[#122036] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${tierProgress}%`, background: `linear-gradient(90deg, ${tier.color}99, ${tier.color})` }} />
            </div>
          </div>

          {/* Badges conquistadas */}
          {badges.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Conquistas desbloqueadas</p>
              <div className="flex flex-wrap gap-2">
                {badges.map(b => (
                  <div key={b.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border"
                    style={{ background: `${b.color}15`, borderColor: `${b.color}40` }}>
                    <span className="text-sm">{b.icon}</span>
                    <div>
                      <p className="text-[10px] font-bold leading-tight" style={{ color: b.color }}>{b.label}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Badges bloqueadas (primeiras 3) */}
          {(() => {
            const locked = BADGE_DEFS.filter(b => !badges.find(x => x.id === b.id)).slice(0, 3);
            return locked.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Próximas conquistas</p>
                <div className="flex flex-wrap gap-2">
                  {locked.map(b => (
                    <div key={b.id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-[#122036] opacity-50">
                      <Lock className="w-3 h-3 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground">{b.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

// ─── My Profile Card (para partners) ─────────────────────────────────────────

function MyProfileCard({ entry, allScores }: { entry: RankingScore; allScores: RankingScore[] }) {
  const tier = getTier(entry.score);
  const tierProgress = getTierProgress(entry.score);
  const nextTier = TIERS[TIERS.findIndex(t => t.id === tier.id) + 1];
  const myRankPosition = allScores.findIndex(s => s.id === entry.id) + 1;
  const top1ScoreId = allScores[0]?.id;
  const top1VolumeId = [...allScores].sort((a, b) => b.volume - a.volume)[0]?.id;
  const badges = computeBadges(entry, entry.id === top1ScoreId, entry.id === top1VolumeId);

  return (
    <div className="p-5 rounded-2xl border relative overflow-hidden"
      style={{ borderColor: `${tier.color}40`, background: `linear-gradient(135deg, ${tier.color}08 0%, #091221 60%)` }}>
      {/* Glow */}
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${tier.color}, transparent)`, transform: "translate(30%, -30%)" }} />

      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Meu Perfil</p>
          <h3 className="text-lg font-black text-white">{entry.name.split(" ")[0]}</h3>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: `${tier.color}22`, border: `1px solid ${tier.color}44` }}>
              <span style={{ color: tier.color }}>{tier.icon}</span>
              <span className="text-xs font-bold" style={{ color: tier.color }}>{tier.label}</span>
            </div>
            <span className="text-xs text-muted-foreground">#{myRankPosition}º lugar</span>
          </div>
        </div>
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black shadow-lg flex-shrink-0"
          style={{
            background: `linear-gradient(135deg, ${tier.color}88, ${tier.color}44)`,
            boxShadow: `0 0 20px ${tier.color}44`,
            color: "#fff",
          }}>
          {entry.avatar}
        </div>
      </div>

      {/* Score destaque */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Score", value: `${entry.score}pts`, color: "#C9A84C" },
          { label: "Propostas", value: entry.proposals, color: "#3B82F6" },
          { label: "Aprovações", value: entry.approvals, color: "#10B981" },
          { label: "Volume", value: formatVolume(entry.volume), color: "#a78bfa" },
        ].map(s => (
          <div key={s.label} className="text-center p-2 rounded-xl bg-[#09081A]/50 border border-[#122036]">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className="text-sm font-black mt-0.5" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tier progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Progresso para {nextTier?.label ?? "nível máximo"}</span>
          <span className="text-xs font-bold" style={{ color: tier.color }}>{tierProgress}%</span>
        </div>
        <div className="h-3 bg-[#122036] rounded-full overflow-hidden relative">
          <div className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${tierProgress}%`, background: `linear-gradient(90deg, ${tier.color}88, ${tier.color})` }} />
          {tierProgress > 10 && (
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
              style={{ color: tierProgress > 50 ? "#09081A" : tier.color }}>
              {entry.score} / {tier.next ?? "MAX"} pts
            </span>
          )}
        </div>
        {nextTier && (
          <p className="text-[10px] text-muted-foreground mt-1">Faltam <strong style={{ color: nextTier.color }}>{(tier.next ?? 0) - entry.score} pts</strong> para {nextTier.label}</p>
        )}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Minhas Conquistas ({badges.length}/{BADGE_DEFS.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {badges.map(b => (
              <div key={b.id} title={b.desc}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border cursor-default"
                style={{ background: `${b.color}15`, borderColor: `${b.color}40` }}>
                <span className="text-sm">{b.icon}</span>
                <span className="text-[10px] font-semibold" style={{ color: b.color }}>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hall of Fame ─────────────────────────────────────────────────────────────

function HallOfFame({ scoreData }: { scoreData: RankingScore[] }) {
  const top5 = scoreData.slice(0, 5);
  if (top5.length === 0) return null;

  return (
    <div className="p-5 rounded-2xl bg-[#091221] border border-[#C9A84C]/20 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #C9A84C, transparent 70%)" }} />
      <div className="flex items-center gap-2 mb-4">
        <Award className="w-4 h-4 text-[#C9A84C]" />
        <h3 className="text-sm font-bold text-white">Hall da Fama</h3>
        <span className="text-[10px] text-muted-foreground ml-1">Top performers do período</span>
      </div>
      <div className="space-y-2">
        {top5.map((entry, i) => {
          const tier = getTier(entry.score);
          const top1VolumeId = [...scoreData].sort((a, b) => b.volume - a.volume)[0]?.id;
          const badges = computeBadges(entry, i === 0, entry.id === top1VolumeId);
          return (
            <div key={entry.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#0F1E35] transition-colors">
              <span className="text-lg w-6 text-center flex-shrink-0">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
              </span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: `${tier.color}22`, color: tier.color, border: `1px solid ${tier.color}44` }}>
                {entry.avatar}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white truncate">{entry.name}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: `${tier.color}22`, color: tier.color }}>{tier.label}</span>
                </div>
                <div className="flex gap-0.5 mt-0.5">
                  {badges.slice(0, 5).map(b => <span key={b.id} title={b.label} className="text-xs">{b.icon}</span>)}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-black text-white">{entry.score} pts</p>
                <p className="text-[10px] text-muted-foreground">{entry.proposals}p · {entry.approvals}✓</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tier Legend ──────────────────────────────────────────────────────────────

function TierLegend() {
  return (
    <div className="p-4 rounded-xl bg-[#091221] border border-[#122036]">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-[#C9A84C]" />
        <span className="text-xs font-bold text-white">Níveis de Partner</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {TIERS.map(t => (
          <div key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
            style={{ background: `${t.color}15`, borderColor: `${t.color}40` }}>
            <span style={{ color: t.color }}>{t.icon}</span>
            <span className="text-xs font-bold" style={{ color: t.color }}>{t.label}</span>
            <span className="text-[9px] text-muted-foreground">{t.minScore}{t.next ? `–${t.next - 1}` : "+"} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Goals Card ───────────────────────────────────────────────────────────────

function GoalBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  if (!goal) return null;
  const pct = Math.min(Math.round((value / goal) * 100), 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-white">{value} / {goal} <span className="text-muted-foreground">({pct}%)</span></span>
      </div>
      <div className="h-2 bg-[#122036] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: pct >= 100 ? "#10B981" : color }} />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface RankingClientProps {
  userRole: string;
  userName: string;
  rankingData: RankingData;
  period?: string;
  goals?: PartnerGoal[];
  currentUserId?: string;
}

export function RankingClient({ userRole, userName, rankingData, period = "mes", goals = [], currentUserId }: RankingClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("score");

  function setPeriod(p: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("period", p);
    router.push(url.pathname + url.search);
  }

  const currentData = rankingData[activeTab] as AnyRank[];

  function getMaxVal() {
    if (activeTab === "score")      return Math.max(0, ...rankingData.score.map(x => x.score));
    if (activeTab === "propostas")  return Math.max(0, ...rankingData.propostas.map(x => x.proposals));
    if (activeTab === "aprovacoes") return Math.max(0, ...rankingData.aprovacoes.map(x => x.approved));
    return Math.max(0, ...rankingData.volume.map(x => x.volume));
  }

  const totalPropostas  = rankingData.propostas.reduce((s, x) => s + x.proposals, 0);
  const totalAprovacoes = rankingData.aprovacoes.reduce((s, x) => s + x.approved, 0);
  const totalVolume     = rankingData.volume.reduce((s, x) => s + x.volume, 0);

  const isAdmin = ["ADMIN", "GESTAO", "FINANCEIRO", "MESA_OPERACIONAL"].includes(userRole);
  const myEntry = rankingData.score.find(s => s.name === userName) ?? rankingData.score[0];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #C9A84C, #E8C97A)", boxShadow: "0 8px 24px rgba(196,146,46,0.3)" }}>
            <Trophy className="w-6 h-6 text-[#09081A]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Ranking de Performance</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isAdmin ? "Visão Administrador" : `Bem-vindo, ${userName.split(" ")[0]}`} — {PERIOD_LABELS[period]}
            </p>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-[#091221] border border-[#122036]">
          {Object.entries(PERIOD_LABELS).map(([id, label]) => (
            <button key={id} onClick={() => setPeriod(id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={period === id
                ? { background: "linear-gradient(120deg,#C9A84C,#E8C97A)", color: "#09081A" }
                : { color: "#7A8FA8" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Total de Propostas", value: totalPropostas, icon: <Target className="w-4 h-4" />, color: "#3B82F6" },
          { label: "Total de Aprovações", value: totalAprovacoes, icon: <CheckCircle2 className="w-4 h-4" />, color: "#10B981" },
          { label: "Volume Total", value: formatVolume(totalVolume), icon: <DollarSign className="w-4 h-4" />, color: "#C9A84C" },
        ].map((kpi) => (
          <div key={kpi.label} className="p-4 rounded-xl bg-[#091221] border border-[#122036] flex items-center gap-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px]"
              style={{ background: `linear-gradient(90deg, transparent, ${kpi.color}44, transparent)` }} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${kpi.color}18`, color: kpi.color }}>
              {kpi.icon}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-black text-white">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Score legend */}
      {activeTab === "score" && (
        <div className="p-3 rounded-xl bg-[#091221] border border-[#C4922E]/20 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="font-semibold text-[#C4922E]">Como o score é calculado:</span>
          <span>Proposta submetida <strong className="text-white">+1pt</strong></span>
          <span>Operação aprovada <strong className="text-white">+5pt</strong></span>
          <span>Volume aprovado <strong className="text-white">+1pt/R$100K</strong></span>
          <span>Deal M&A fechado <strong className="text-white">+10pt</strong></span>
          <span>Comissão recebida <strong className="text-white">+2pt</strong></span>
        </div>
      )}

      {/* Tier legend */}
      <TierLegend />

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border"
            style={activeTab === tab.id
              ? { background: `${tab.color}18`, color: tab.color, borderColor: `${tab.color}40` }
              : { color: "#7A8FA8", borderColor: "#122036", background: "transparent" }}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      {currentData.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#091221] border border-[#122036] text-center">
          <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">Nenhum dado disponível no período selecionado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* Left: Podium + My Profile */}
          <div className="xl:col-span-2 space-y-4">
            <div className="px-4 py-4 bg-[#091221] rounded-2xl border border-[#122036]">
              <Podium tab={activeTab} data={currentData} scoreData={rankingData.score} />
            </div>

            {/* My profile (partners) ou Hall of Fame (admins) */}
            {!isAdmin && myEntry ? (
              <MyProfileCard entry={myEntry} allScores={rankingData.score} />
            ) : (
              <HallOfFame scoreData={rankingData.score} />
            )}
          </div>

          {/* Right: Full ranking list */}
          <div className="xl:col-span-3 bg-[#091221] rounded-2xl border border-[#122036] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#122036] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-[#C9A84C]" />
                <span className="text-sm font-bold text-white">Classificação Geral</span>
                <span className="text-[10px] text-muted-foreground ml-1">Clique para expandir</span>
              </div>
              <Badge className="text-[10px] bg-[#C9A84C]/10 text-[#E8C97A] border-[#C9A84C]/30">
                Top {currentData.length} Partners
              </Badge>
            </div>
            <div className="p-3 space-y-1">
              {currentData.map((item, idx) => (
                <RankRow key={item.id} item={item} position={idx + 1} tab={activeTab} maxVal={getMaxVal()} scoreData={rankingData.score} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Badge showcase */}
      <div className="p-5 rounded-2xl bg-[#091221] border border-[#122036]">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-[#C9A84C]" />
          <h3 className="text-sm font-bold text-white">Todas as Conquistas Disponíveis</h3>
          <span className="text-[10px] text-muted-foreground">— desbloqueie acumulando resultados</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {BADGE_DEFS.map(b => (
            <div key={b.id} className="flex items-center gap-2 p-2.5 rounded-xl border"
              style={{ background: `${b.color}10`, borderColor: `${b.color}30` }}>
              <span className="text-xl flex-shrink-0">{b.icon}</span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold truncate" style={{ color: b.color }}>{b.label}</p>
                <p className="text-[9px] text-muted-foreground leading-tight">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Premiação notice */}
      <div className="p-4 rounded-xl border border-[#C9A84C]/25 bg-[#C9A84C]/5 flex items-start gap-3">
        <Trophy className="w-4 h-4 text-[#E8C97A] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-[#E8C97A] mb-1">Programa de Premiação V3 Partners</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            O ranking é atualizado em tempo real. Os top 3 de cada categoria são elegíveis para premiação mensal.
            Acumule pontos, suba de nível e desbloqueie conquistas exclusivas.
            {isAdmin && " Como administrador, você pode definir metas individuais via API POST /api/partner-goals."}
          </p>
        </div>
      </div>
    </div>
  );
}
