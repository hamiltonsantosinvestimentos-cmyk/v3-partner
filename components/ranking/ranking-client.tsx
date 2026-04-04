"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy, Medal, Crown, TrendingUp, CheckCircle2, DollarSign,
  Star, Award, Flame, Target, Zap, Building2,
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

const TABS: { id: Tab; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  {
    id: "propostas",
    label: "Mais Propostas",
    icon: <Target className="w-4 h-4" />,
    color: "#3B82F6",
    desc: "Parceiros que mais submeteram propostas no período",
  },
  {
    id: "aprovacoes",
    label: "Mais Aprovações",
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "#10B981",
    desc: "Parceiros com maior número de operações aprovadas",
  },
  {
    id: "volume",
    label: "Maior Volume",
    icon: <DollarSign className="w-4 h-4" />,
    color: "#C9A84C",
    desc: "Parceiros com maior volume financeiro de operações",
  },
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

// ─── Podium ───────────────────────────────────────────────────────────────────
type AnyRank = RankingScore | RankingPropostas | RankingAprovacoes | RankingVolume;

function getValue(tab: Tab, item: AnyRank): string {
  if (tab === "score")      return `${(item as RankingScore).score} pts`;
  if (tab === "propostas")  return `${(item as RankingPropostas).proposals} propostas`;
  if (tab === "aprovacoes") return `${(item as RankingAprovacoes).approved} aprovações`;
  return formatVolume((item as RankingVolume).volume);
}

function Podium({ tab, data }: { tab: Tab; data: AnyRank[] }) {
  const top3 = data.slice(0, 3);
  const order = [top3[1], top3[0], top3[2]];
  const heights = ["h-24", "h-36", "h-16"];
  const positions = [2, 1, 3];

  return (
    <div className="flex items-end justify-center gap-3 pt-4 pb-2">
      {order.map((item, idx) => {
        if (!item) return <div key={idx} className="w-28" />;
        const medal = MEDAL_COLORS[positions[idx] - 1];
        const isFirst = positions[idx] === 1;
        return (
          <div key={item.id} className="flex flex-col items-center gap-2 w-28">
            {isFirst && (
              <div className="flex flex-col items-center gap-1">
                <Crown className="w-6 h-6" style={{ color: "#FFD700", filter: "drop-shadow(0 0 6px #FFD70088)" }} />
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
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-white leading-tight">{item.name.split(" ")[0]}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{item.name.split(" ").slice(1).join(" ")}</p>
            </div>
            <p className="text-xs font-bold text-center" style={{ color: medal.ring }}>{getValue(tab, item)}</p>
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
function RankRow({ item, position, tab, maxVal }: { item: AnyRank; position: number; tab: Tab; maxVal: number }) {
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
  const tabColors: Record<Tab, string> = {
    score:      "#C9A84C",
    propostas:  "#3B82F6",
    aprovacoes: "#10B981",
    volume:     "#C9A84C",
  };
  const barColor = tabColors[tab];
  const isTop3 = position <= 3;

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${
        isTop3 ? "bg-[#0F1E35] border border-[#C9A84C]/20" : "hover:bg-[#0F1E35]/50"
      }`}
    >
      {/* Position */}
      <div className="w-7 flex-shrink-0 text-center">
        {position === 1 ? <Crown className="w-5 h-5 mx-auto" style={{ color: "#FFD700" }} />
        : position === 2 ? <Medal className="w-5 h-5 mx-auto" style={{ color: "#C0C0C0" }} />
        : position === 3 ? <Medal className="w-5 h-5 mx-auto" style={{ color: "#CD7F32" }} />
        : <span className="text-sm font-bold text-muted-foreground">{position}º</span>}
      </div>
      <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
        style={{
          background: position <= 3
            ? `linear-gradient(135deg, ${MEDAL_COLORS[position - 1].ring}88, ${MEDAL_COLORS[position - 1].ring}44)`
            : "rgba(196,146,46,0.1)",
          color: position <= 3 ? MEDAL_COLORS[position - 1].text : "#C9A84C",
          border: `1px solid ${position <= 3 ? MEDAL_COLORS[position - 1].ring + "44" : "rgba(196,146,46,0.2)"}`,
        }}
      >
        {item.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-white truncate">{item.name}</span>
          {position === 1 && <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
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
}

export function RankingClient({ userRole, userName, rankingData, period = "mes", goals = [] }: RankingClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("score");

  function setPeriod(p: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("period", p);
    router.push(url.pathname + url.search);
  }

  const currentData = rankingData[activeTab] as AnyRank[];
  const activeTabInfo = TABS.find((t) => t.id === activeTab)!;

  function getMaxVal() {
    if (activeTab === "score")      return Math.max(0, ...rankingData.score.map(x => x.score));
    if (activeTab === "propostas")  return Math.max(0, ...rankingData.propostas.map(x => x.proposals));
    if (activeTab === "aprovacoes") return Math.max(0, ...rankingData.aprovacoes.map(x => x.approved));
    return Math.max(0, ...rankingData.volume.map(x => x.volume));
  }

  const totalScore     = rankingData.score.reduce((s, x) => s + x.score, 0);
  const totalPropostas = rankingData.propostas.reduce((s, x) => s + x.proposals, 0);
  const totalAprovacoes = rankingData.aprovacoes.reduce((s, x) => s + x.approved, 0);
  const totalVolume    = rankingData.volume.reduce((s, x) => s + x.volume, 0);

  // Minha meta (para partners)
  const isAdmin = ["ADMIN", "GESTAO", "FINANCEIRO", "MESA_OPERACIONAL"].includes(userRole);
  const myRankEntry = rankingData.score[0]; // simplificação para demo

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

        {/* Period selector */}
        <div className="flex gap-1 p-1 rounded-xl bg-[#091221] border border-[#122036]">
          {Object.entries(PERIOD_LABELS).map(([id, label]) => (
            <button key={id} onClick={() => setPeriod(id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={period === id
                ? { background: "linear-gradient(120deg,#C9A84C,#E8C97A)", color: "#09081A" }
                : { color: "#7A8FA8" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Score legend (only on score tab) */}
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

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border"
            style={activeTab === tab.id
              ? { background: `${tab.color}18`, color: tab.color, borderColor: `${tab.color}40` }
              : { color: "#7A8FA8", borderColor: "#122036", background: "transparent" }
            }
          >
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
          {/* Podium */}
          <div className="px-4 py-4">
            <Podium tab={activeTab} data={currentData} />
          </div>

          {/* Mini stats for top 1 */}
          {currentData[0] && (
            <div className="mx-4 mb-4 p-3 rounded-xl bg-[#0F1E35] border border-[#C9A84C]/20">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-3.5 h-3.5 text-[#FFD700]" />
                <span className="text-xs font-bold text-[#FFD700]">Líder do período</span>
              </div>
              <p className="text-sm font-bold text-white">{currentData[0].name}</p>
              {activeTab === "propostas" && (
                <div className="flex gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground">{(currentData[0] as RankingPropostas).proposals} propostas</span>
                  <span className={`text-xs font-semibold ${(currentData[0] as RankingPropostas).growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(currentData[0] as RankingPropostas).growth >= 0 ? "+" : ""}{(currentData[0] as RankingPropostas).growth}% vs mês ant.
                  </span>
                </div>
              )}
              {activeTab === "aprovacoes" && (
                <div className="flex gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground">{(currentData[0] as RankingAprovacoes).approved} aprovadas</span>
                  <span className="text-xs text-emerald-400">{(currentData[0] as RankingAprovacoes).rate}% de aprovação</span>
                </div>
              )}
              {activeTab === "volume" && (
                <div className="flex gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground">{formatVolume((currentData[0] as RankingVolume).volume)}</span>
                  <span className="text-xs text-[#E8C97A]">{(currentData[0] as RankingVolume).deals} operações</span>
                </div>
              )}
            </div>
          )}

          {/* Full ranking list */}
          <div className="xl:col-span-3 bg-[#091221] rounded-2xl border border-[#122036] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#122036] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-[#C9A84C]" />
                <span className="text-sm font-bold text-white">Classificação Geral</span>
              </div>
              <Badge className="text-[10px] bg-[#C9A84C]/10 text-[#E8C97A] border-[#C9A84C]/30">
                Top {currentData.length} Partners
              </Badge>
            </div>
            <div className="p-3 space-y-1">
              {currentData.map((item, idx) => (
                <RankRow key={item.id} item={item} position={idx + 1} tab={activeTab} maxVal={getMaxVal()} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Premiação notice ── */}
      <div className="p-4 rounded-xl border border-[#C9A84C]/25 bg-[#C9A84C]/5 flex items-start gap-3">
        <Trophy className="w-4 h-4 text-[#E8C97A] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-[#E8C97A] mb-1">
            Programa de Premiação V3 Partners
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            O ranking é atualizado em tempo real. Os top 3 de cada categoria são elegíveis para premiação mensal.
            {isAdmin && " Como administrador, você pode definir metas individuais via API POST /api/partner-goals."}
          </p>
        </div>
      </div>
    </div>
  );
}
