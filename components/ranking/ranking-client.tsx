"use client";

import { useState } from "react";
import { Trophy, Medal, Crown, TrendingUp, CheckCircle2, DollarSign, Star, Award, Flame, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Demo data ────────────────────────────────────────────────────────────────
const RANKING_DATA = {
  propostas: [
    { id: "1", name: "Rafael Monteiro",     avatar: "RM", role: "Partner",         proposals: 47, growth: +18, region: "SP" },
    { id: "2", name: "Camila Ferreira",     avatar: "CF", role: "Partner",         proposals: 41, growth: +12, region: "RJ" },
    { id: "3", name: "Bruno Alves",         avatar: "BA", role: "Partner",         proposals: 38, growth: +9,  region: "MG" },
    { id: "4", name: "Juliana Costa",       avatar: "JC", role: "Partner",         proposals: 34, growth: +22, region: "SP" },
    { id: "5", name: "Pedro Henrique",      avatar: "PH", role: "Partner",         proposals: 31, growth: -3,  region: "RS" },
    { id: "6", name: "Ana Beatriz Lima",    avatar: "AL", role: "Partner",         proposals: 28, growth: +7,  region: "BA" },
    { id: "7", name: "Lucas Rodrigues",     avatar: "LR", role: "Partner",         proposals: 26, growth: +15, region: "PR" },
    { id: "8", name: "Fernanda Oliveira",   avatar: "FO", role: "Partner",         proposals: 23, growth: +4,  region: "SC" },
    { id: "9", name: "Thiago Mendes",       avatar: "TM", role: "Partner",         proposals: 21, growth: -8,  region: "GO" },
    { id: "10", name: "Mariana Santos",     avatar: "MS", role: "Partner",         proposals: 18, growth: +33, region: "PE" },
  ],
  aprovacoes: [
    { id: "1", name: "Camila Ferreira",     avatar: "CF", role: "Partner",         approved: 34, rate: 83, volume: 8200000 },
    { id: "2", name: "Rafael Monteiro",     avatar: "RM", role: "Partner",         approved: 31, rate: 66, volume: 12400000 },
    { id: "3", name: "Juliana Costa",       avatar: "JC", role: "Partner",         approved: 28, rate: 82, volume: 6900000 },
    { id: "4", name: "Bruno Alves",         avatar: "BA", role: "Partner",         approved: 24, rate: 63, volume: 9800000 },
    { id: "5", name: "Lucas Rodrigues",     avatar: "LR", role: "Partner",         approved: 20, rate: 77, volume: 5100000 },
    { id: "6", name: "Ana Beatriz Lima",    avatar: "AL", role: "Partner",         approved: 18, rate: 64, volume: 4400000 },
    { id: "7", name: "Fernanda Oliveira",   avatar: "FO", role: "Partner",         approved: 16, rate: 70, volume: 3800000 },
    { id: "8", name: "Pedro Henrique",      avatar: "PH", role: "Partner",         approved: 15, rate: 48, volume: 7200000 },
    { id: "9", name: "Mariana Santos",      avatar: "MS", role: "Partner",         approved: 11, rate: 61, volume: 2600000 },
    { id: "10", name: "Thiago Mendes",      avatar: "TM", role: "Partner",         approved: 9,  rate: 43, volume: 1900000 },
  ],
  volume: [
    { id: "1", name: "Rafael Monteiro",     avatar: "RM", role: "Partner",         volume: 12400000, deals: 31, avg: 400000 },
    { id: "2", name: "Bruno Alves",         avatar: "BA", role: "Partner",         volume: 9800000,  deals: 24, avg: 408333 },
    { id: "3", name: "Camila Ferreira",     avatar: "CF", role: "Partner",         volume: 8200000,  deals: 34, avg: 241176 },
    { id: "4", name: "Pedro Henrique",      avatar: "PH", role: "Partner",         volume: 7200000,  deals: 15, avg: 480000 },
    { id: "5", name: "Juliana Costa",       avatar: "JC", role: "Partner",         volume: 6900000,  deals: 28, avg: 246428 },
    { id: "6", name: "Lucas Rodrigues",     avatar: "LR", role: "Partner",         volume: 5100000,  deals: 20, avg: 255000 },
    { id: "7", name: "Ana Beatriz Lima",    avatar: "AL", role: "Partner",         volume: 4400000,  deals: 18, avg: 244444 },
    { id: "8", name: "Fernanda Oliveira",   avatar: "FO", role: "Partner",         volume: 3800000,  deals: 16, avg: 237500 },
    { id: "9", name: "Mariana Santos",      avatar: "MS", role: "Partner",         volume: 2600000,  deals: 11, avg: 236363 },
    { id: "10", name: "Thiago Mendes",      avatar: "TM", role: "Partner",         volume: 1900000,  deals: 9,  avg: 211111 },
  ],
};

type Tab = "propostas" | "aprovacoes" | "volume";

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
    color: "#C4922E",
    desc: "Parceiros com maior volume financeiro de operações",
  },
];

const MEDAL_COLORS = [
  { bg: "from-[#FFD700] to-[#FFA500]", text: "#7A5A00", ring: "#FFD700", label: "Ouro" },
  { bg: "from-[#C0C0C0] to-[#A8A8A8]", text: "#4A4A4A", ring: "#C0C0C0", label: "Prata" },
  { bg: "from-[#CD7F32] to-[#A0522D]", text: "#FFFFFF", ring: "#CD7F32", label: "Bronze" },
];

function formatVolume(v: number) {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v}`;
}

// ─── Podium (top 3) ──────────────────────────────────────────────────────────
function Podium({ tab, data }: { tab: Tab; data: typeof RANKING_DATA.propostas }) {
  const top3 = data.slice(0, 3);
  // Reorder: 2nd, 1st, 3rd (classic podium)
  const order = [top3[1], top3[0], top3[2]];
  const heights = ["h-24", "h-36", "h-16"];
  const positions = [2, 1, 3];

  function getValue(item: (typeof RANKING_DATA.propostas)[0] | (typeof RANKING_DATA.aprovacoes)[0] | (typeof RANKING_DATA.volume)[0]) {
    if (tab === "propostas") return `${(item as typeof RANKING_DATA.propostas[0]).proposals} propostas`;
    if (tab === "aprovacoes") return `${(item as typeof RANKING_DATA.aprovacoes[0]).approved} aprovações`;
    return formatVolume((item as typeof RANKING_DATA.volume[0]).volume);
  }

  return (
    <div className="flex items-end justify-center gap-3 pt-4 pb-2">
      {order.map((item, idx) => {
        if (!item) return <div key={idx} className="w-28" />;
        const medal = MEDAL_COLORS[positions[idx] - 1];
        const isFirst = positions[idx] === 1;
        return (
          <div key={item.id} className="flex flex-col items-center gap-2 w-28">
            {/* Crown for #1 */}
            {isFirst && (
              <div className="flex flex-col items-center gap-1 animate-fade-in">
                <Crown className="w-6 h-6" style={{ color: "#FFD700", filter: "drop-shadow(0 0 6px #FFD70088)" }} />
                <span className="text-[10px] font-bold text-[#FFD700] uppercase tracking-widest">Campeão</span>
              </div>
            )}

            {/* Avatar */}
            <div className="relative">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-sm font-black shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${medal.ring}CC, ${medal.ring}88)`,
                  color: medal.text,
                  boxShadow: `0 0 0 3px ${medal.ring}66, 0 8px 24px rgba(0,0,0,0.4)`,
                }}
              >
                {item.avatar}
              </div>
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                style={{ background: medal.ring, color: medal.text, boxShadow: "0 2px 6px rgba(0,0,0,0.3)" }}
              >
                {positions[idx]}
              </div>
            </div>

            {/* Name */}
            <div className="text-center">
              <p className="text-xs font-bold text-white leading-tight text-center">{item.name.split(" ")[0]}</p>
              <p className="text-[10px] text-muted-foreground text-center leading-tight">{item.name.split(" ").slice(1).join(" ")}</p>
            </div>

            {/* Value */}
            <p className="text-xs font-bold text-center" style={{ color: medal.ring }}>{getValue(item)}</p>

            {/* Podium base */}
            <div
              className={`w-full ${heights[idx]} rounded-t-xl flex items-start justify-center pt-2`}
              style={{
                background: `linear-gradient(180deg, ${medal.ring}30 0%, ${medal.ring}10 100%)`,
                border: `1px solid ${medal.ring}40`,
                borderBottom: "none",
              }}
            >
              <span className="text-xl font-black" style={{ color: `${medal.ring}88` }}>{positions[idx]}º</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── List row ─────────────────────────────────────────────────────────────────
function RankRow({
  item, position, tab, maxVal,
}: {
  item: typeof RANKING_DATA.propostas[0] | typeof RANKING_DATA.aprovacoes[0] | typeof RANKING_DATA.volume[0];
  position: number;
  tab: Tab;
  maxVal: number;
}) {
  function getMainValue() {
    if (tab === "propostas") return { label: `${(item as typeof RANKING_DATA.propostas[0]).proposals}`, sub: "propostas" };
    if (tab === "aprovacoes") return { label: `${(item as typeof RANKING_DATA.aprovacoes[0]).approved}`, sub: "aprovadas" };
    return { label: formatVolume((item as typeof RANKING_DATA.volume[0]).volume), sub: "volume" };
  }
  function getBarVal() {
    if (tab === "propostas") return (item as typeof RANKING_DATA.propostas[0]).proposals;
    if (tab === "aprovacoes") return (item as typeof RANKING_DATA.aprovacoes[0]).approved;
    return (item as typeof RANKING_DATA.volume[0]).volume;
  }
  function getExtra() {
    if (tab === "propostas") {
      const g = (item as typeof RANKING_DATA.propostas[0]).growth;
      return (
        <span className={`text-xs font-semibold ${g >= 0 ? "text-emerald-400" : "text-red-400"}`}>
          {g >= 0 ? "+" : ""}{g}%
        </span>
      );
    }
    if (tab === "aprovacoes") {
      const r = (item as typeof RANKING_DATA.aprovacoes[0]).rate;
      return <span className="text-xs text-muted-foreground">{r}% aprovação</span>;
    }
    const avg = (item as typeof RANKING_DATA.volume[0]).avg;
    return <span className="text-xs text-muted-foreground">média {formatVolume(avg)}</span>;
  }

  const barPct = (getBarVal() / maxVal) * 100;
  const tabColors: Record<Tab, string> = {
    propostas: "#3B82F6",
    aprovacoes: "#10B981",
    volume: "#C4922E",
  };
  const barColor = tabColors[tab];
  const mv = getMainValue();
  const isTop3 = position <= 3;

  return (
    <div
      className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group ${
        isTop3 ? "bg-[#0F1E35] border border-[#C4922E]/20" : "hover:bg-[#0F1E35]/50"
      }`}
    >
      {/* Position */}
      <div className="w-7 flex-shrink-0 text-center">
        {position === 1 ? (
          <Crown className="w-5 h-5 mx-auto" style={{ color: "#FFD700" }} />
        ) : position === 2 ? (
          <Medal className="w-5 h-5 mx-auto" style={{ color: "#C0C0C0" }} />
        ) : position === 3 ? (
          <Medal className="w-5 h-5 mx-auto" style={{ color: "#CD7F32" }} />
        ) : (
          <span className="text-sm font-bold text-muted-foreground">{position}º</span>
        )}
      </div>

      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
        style={{
          background: position <= 3
            ? `linear-gradient(135deg, ${MEDAL_COLORS[position - 1].ring}88, ${MEDAL_COLORS[position - 1].ring}44)`
            : "rgba(196,146,46,0.1)",
          color: position <= 3 ? MEDAL_COLORS[position - 1].text : "#C4922E",
          border: `1px solid ${position <= 3 ? MEDAL_COLORS[position - 1].ring + "44" : "rgba(196,146,46,0.2)"}`,
        }}
      >
        {item.avatar}
      </div>

      {/* Name + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold text-white truncate">{item.name}</span>
          {position === 1 && <Flame className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[#122036] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${barPct}%`, background: barColor }}
            />
          </div>
          {getExtra()}
        </div>
      </div>

      {/* Value */}
      <div className="text-right flex-shrink-0">
        <p className="text-base font-black text-white">{mv.label}</p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{mv.sub}</p>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
interface RankingClientProps {
  userRole: string;
  userName: string;
}

export function RankingClient({ userRole, userName }: RankingClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("propostas");
  const [period, setPeriod] = useState("mes");

  const currentData = RANKING_DATA[activeTab] as typeof RANKING_DATA.propostas;
  const activeTabInfo = TABS.find((t) => t.id === activeTab)!;

  function getMaxVal() {
    if (activeTab === "propostas") return Math.max(...RANKING_DATA.propostas.map((x) => x.proposals));
    if (activeTab === "aprovacoes") return Math.max(...RANKING_DATA.aprovacoes.map((x) => x.approved));
    return Math.max(...RANKING_DATA.volume.map((x) => x.volume));
  }

  // Stats summary
  const totalPropostas = RANKING_DATA.propostas.reduce((s, x) => s + x.proposals, 0);
  const totalAprovacoes = RANKING_DATA.aprovacoes.reduce((s, x) => s + x.approved, 0);
  const totalVolume = RANKING_DATA.volume.reduce((s, x) => s + x.volume, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, #C4922E, #E5B96A)", boxShadow: "0 8px 24px rgba(196,146,46,0.3)" }}>
            <Trophy className="w-6 h-6 text-[#050C18]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Outfit, Inter, sans-serif" }}>
              Ranking de Performance
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Premiação V3 Partners — {userRole === "ADMIN" ? "Visão Administrador" : `Bem-vindo, ${userName.split(" ")[0]}`}
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex gap-1 p-1 rounded-xl bg-[#091221] border border-[#122036]">
          {[
            { id: "semana", label: "7 dias" },
            { id: "mes",    label: "Este mês" },
            { id: "trim",   label: "Trimestre" },
            { id: "ano",    label: "Este ano" },
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={period === p.id
                ? { background: "linear-gradient(120deg,#C4922E,#E5B96A)", color: "#050C18" }
                : { color: "#5A7490" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total de Propostas", value: totalPropostas, icon: <Target className="w-4 h-4" />, color: "#3B82F6" },
          { label: "Total de Aprovações", value: totalAprovacoes, icon: <CheckCircle2 className="w-4 h-4" />, color: "#10B981" },
          { label: "Volume Total", value: formatVolume(totalVolume), icon: <DollarSign className="w-4 h-4" />, color: "#C4922E" },
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

      {/* ── Tabs ── */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border"
            style={activeTab === tab.id
              ? { background: `${tab.color}18`, color: tab.color, borderColor: `${tab.color}40` }
              : { color: "#5A7490", borderColor: "#122036", background: "transparent" }
            }
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Main content ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* Podium + description */}
        <div className="xl:col-span-2 bg-[#091221] rounded-2xl border border-[#122036] overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#122036]">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4" style={{ color: activeTabInfo.color }} />
              <span className="text-sm font-bold text-white">{activeTabInfo.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{activeTabInfo.desc}</p>
          </div>

          {/* Podium */}
          <div className="px-4 py-4">
            <Podium tab={activeTab} data={currentData as typeof RANKING_DATA.propostas} />
          </div>

          {/* Mini stats for top 1 */}
          {currentData[0] && (
            <div className="mx-4 mb-4 p-3 rounded-xl bg-[#0F1E35] border border-[#C4922E]/20">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-3.5 h-3.5 text-[#FFD700]" />
                <span className="text-xs font-bold text-[#FFD700]">Líder do período</span>
              </div>
              <p className="text-sm font-bold text-white">{currentData[0].name}</p>
              {activeTab === "propostas" && (
                <div className="flex gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground">{(currentData[0] as typeof RANKING_DATA.propostas[0]).proposals} propostas</span>
                  <span className={`text-xs font-semibold ${(currentData[0] as typeof RANKING_DATA.propostas[0]).growth >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(currentData[0] as typeof RANKING_DATA.propostas[0]).growth >= 0 ? "+" : ""}{(currentData[0] as typeof RANKING_DATA.propostas[0]).growth}% vs mês ant.
                  </span>
                </div>
              )}
              {activeTab === "aprovacoes" && (
                <div className="flex gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground">{(currentData[0] as typeof RANKING_DATA.aprovacoes[0]).approved} aprovadas</span>
                  <span className="text-xs text-emerald-400">{(currentData[0] as typeof RANKING_DATA.aprovacoes[0]).rate}% de aprovação</span>
                </div>
              )}
              {activeTab === "volume" && (
                <div className="flex gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground">{formatVolume((currentData[0] as typeof RANKING_DATA.volume[0]).volume)}</span>
                  <span className="text-xs text-[#E5B96A]">{(currentData[0] as typeof RANKING_DATA.volume[0]).deals} operações</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Full ranking list */}
        <div className="xl:col-span-3 bg-[#091221] rounded-2xl border border-[#122036] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#122036] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[#C4922E]" />
              <span className="text-sm font-bold text-white">Classificação Geral</span>
            </div>
            <Badge className="text-[10px] bg-[#C4922E]/10 text-[#E5B96A] border-[#C4922E]/30">
              Top {currentData.length} Partners
            </Badge>
          </div>

          <div className="p-3 space-y-1">
            {currentData.map((item, idx) => (
              <RankRow
                key={item.id}
                item={item}
                position={idx + 1}
                tab={activeTab}
                maxVal={getMaxVal()}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Premiação notice ── */}
      <div className="p-4 rounded-xl border border-[#C4922E]/25 bg-[#C4922E]/5 flex items-start gap-3">
        <Trophy className="w-4 h-4 text-[#E5B96A] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-[#E5B96A] mb-1">
            Programa de Premiação V3 Partners
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            O ranking é atualizado mensalmente. Os top 3 de cada categoria são elegíveis para premiação.
            {userRole === "ADMIN" && " Como administrador, você pode exportar o ranking completo e definir os critérios de premiação no painel de configurações."}
          </p>
        </div>
      </div>
    </div>
  );
}
