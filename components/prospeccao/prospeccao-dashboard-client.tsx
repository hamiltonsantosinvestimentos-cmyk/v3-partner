"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft, TrendingUp, Users, Target, BarChart3,
  ChevronRight, Trophy, Calendar,
} from "lucide-react";

// ── Cores V3 ──────────────────────────────────────────────────────────────────
const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C97A";
const NAVY_CARD = "#162744";
const NAVY_BASE = "#111F35";
const NAVY_MED = "#243A66";
const MUTED = "#7A8FA8";
const CREAM = "#F0ECE4";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface DashData {
  funil: { etapa: string; count: number }[];
  taxaConversao: number;
  metaMensal: { atual: number; meta: number };
  topClosers: { nome: string; convertidos: number }[];
  origens: { origem: string; count: number }[];
  evolucao7dias: { date: string; novos: number }[];
  meusFunil?: { etapa: string; count: number }[];
}

interface Props {
  data: DashData;
  role: string;
  userName: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  SDR: "SDR",
  CLOSER: "Closer",
  GESTAO: "Gestão",
};

const ETAPA_LABELS: Record<string, string> = {
  prospect: "Prospect",
  contatado: "Contatado",
  interessado: "Interessado",
  trial: "Trial",
  convertido: "Convertido",
};

const ORIGEM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  instagram: "Instagram",
  indicacao: "Indicação",
  indicacao_partner: "Indicação Partner",
  youtube: "YouTube",
  google: "Google",
  evento: "Evento",
  outro: "Outro",
};

function origemColor(o: string): string {
  const map: Record<string, string> = {
    linkedin: "#0A66C2",
    instagram: "#E1306C",
    indicacao: GOLD,
    indicacao_partner: GOLD_LIGHT,
    youtube: "#FF0000",
    google: "#4285F4",
    evento: "#A78BFA",
    outro: MUTED,
  };
  return map[o] ?? MUTED;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function motivacional(pct: number): string {
  if (pct < 30) return "Vamos lá! 💪";
  if (pct <= 70) return "Bom ritmo! 🔥";
  return "Excelente! 🏆";
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl border border-white/5 p-4 flex items-start gap-3"
      style={{ background: NAVY_CARD }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${color}20` }}
      >
        <Icon className="w-4.5 h-4.5" style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold" style={{ color: CREAM }}>{value}</p>
        <p className="text-[11px] font-semibold" style={{ color: MUTED }}>{label}</p>
        {sub && <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>{sub}</p>}
      </div>
    </div>
  );
}

function FunilVisual({ funil }: { funil: { etapa: string; count: number }[] }) {
  const max = Math.max(...funil.map(f => f.count), 1);
  const colors = [MUTED, "#60A5FA", "#F59E0B", "#A78BFA", GOLD];

  return (
    <div
      className="rounded-2xl border border-white/5 p-5"
      style={{ background: NAVY_CARD }}
    >
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD }}>
        Funil de Prospecção
      </p>
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {funil.map((f, i) => (
          <React.Fragment key={f.etapa}>
            <div className="flex flex-col items-center shrink-0 min-w-[80px]">
              {/* Barra de progresso */}
              <div
                className="w-full rounded-xl mb-2 flex items-end justify-center"
                style={{ height: 64, background: `${colors[i]}15` }}
              >
                <div
                  className="w-full rounded-xl transition-all duration-500"
                  style={{
                    height: `${Math.max(8, (f.count / max) * 56)}px`,
                    background: `linear-gradient(to top, ${colors[i]}, ${colors[i]}80)`,
                  }}
                />
              </div>
              <p className="text-2xl font-bold" style={{ color: colors[i] }}>{f.count}</p>
              <p className="text-[10px] font-semibold text-center mt-0.5" style={{ color: MUTED }}>
                {ETAPA_LABELS[f.etapa] ?? f.etapa}
              </p>
            </div>
            {i < funil.length - 1 && (
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: MUTED, opacity: 0.4 }} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function Evolucao7Dias({ data }: { data: { date: string; novos: number }[] }) {
  const max = Math.max(...data.map(d => d.novos), 1);

  return (
    <div
      className="rounded-2xl border border-white/5 p-5"
      style={{ background: NAVY_CARD }}
    >
      <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GOLD }}>
        Novos Leads — Últimos 7 dias
      </p>
      <div className="flex items-end gap-2 h-28">
        {data.map(d => {
          const pct = max > 0 ? (d.novos / max) : 0;
          const minH = d.novos > 0 ? 8 : 4;
          return (
            <div key={d.date} className="flex flex-col items-center flex-1 gap-1">
              <span
                className="text-[10px] font-bold"
                style={{ color: d.novos > 0 ? GOLD_LIGHT : MUTED }}
              >
                {d.novos > 0 ? d.novos : ""}
              </span>
              <div
                className="w-full rounded-t-lg transition-all duration-500"
                style={{
                  height: `${Math.max(minH, pct * 72)}px`,
                  background: d.novos > 0
                    ? `linear-gradient(to top, ${GOLD}, ${GOLD_LIGHT}80)`
                    : `${NAVY_MED}`,
                }}
              />
              <span className="text-[9px]" style={{ color: MUTED }}>{fmtDate(d.date)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopClosers({ closers }: { closers: { nome: string; convertidos: number }[] }) {
  const max = Math.max(...closers.map(c => c.convertidos), 1);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div
      className="rounded-2xl border border-white/5 p-5 flex flex-col gap-3"
      style={{ background: NAVY_CARD }}
    >
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4" style={{ color: GOLD }} />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
          Top Closers
        </p>
      </div>
      {closers.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: MUTED }}>
          Sem convertidos registrados ainda
        </p>
      )}
      {closers.map((c, i) => {
        const initials = c.nome
          .split(" ")
          .slice(0, 2)
          .map(w => w[0])
          .join("")
          .toUpperCase();
        const pct = Math.round((c.convertidos / max) * 100);
        return (
          <div key={c.nome} className="flex items-center gap-3">
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold"
              style={{ background: `${GOLD}20`, color: GOLD }}
            >
              {initials}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold truncate" style={{ color: CREAM }}>
                  {medals[i] ?? ""} {c.nome.split(" ")[0]}
                </span>
                <span className="text-[11px] font-bold shrink-0 ml-2" style={{ color: GOLD }}>
                  {c.convertidos}
                </span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: `${NAVY_MED}` }}>
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(to right, ${GOLD}, ${GOLD_LIGHT})`,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrigensPanel({ origens }: { origens: { origem: string; count: number }[] }) {
  const total = origens.reduce((s, o) => s + o.count, 0) || 1;

  return (
    <div
      className="rounded-2xl border border-white/5 p-5 flex flex-col gap-3"
      style={{ background: NAVY_CARD }}
    >
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4" style={{ color: GOLD }} />
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
          Origens dos Leads
        </p>
      </div>
      {origens.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: MUTED }}>
          Sem dados de origem ainda
        </p>
      )}
      {origens.map(o => {
        const color = origemColor(o.origem);
        const pct = Math.round((o.count / total) * 100);
        return (
          <div key={o.origem} className="flex items-center gap-2">
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
              style={{ background: `${color}20`, color }}
            >
              {ORIGEM_LABELS[o.origem] ?? o.origem}
            </span>
            <div className="flex-1 rounded-full h-1.5" style={{ background: NAVY_MED }}>
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <span className="text-[11px] font-bold shrink-0" style={{ color: CREAM }}>
              {o.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MetaMensal({ atual, meta }: { atual: number; meta: number }) {
  const pct = Math.min(Math.round((atual / meta) * 100), 100);
  const msg = motivacional(pct);

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ background: `${GOLD}08`, borderColor: `${GOLD}25` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" style={{ color: GOLD }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
            Meta Mensal
          </p>
        </div>
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: `${GOLD}20`, color: GOLD_LIGHT }}
        >
          {msg}
        </span>
      </div>

      <div className="flex items-end gap-2 mb-2">
        <span className="text-3xl font-bold" style={{ color: CREAM }}>{atual}</span>
        <span className="text-sm mb-1" style={{ color: MUTED }}>/ {meta} convertidos este mês</span>
        <span className="ml-auto text-lg font-bold" style={{ color: pct >= 70 ? GOLD : MUTED }}>
          {pct}%
        </span>
      </div>

      <div className="w-full rounded-full h-2.5" style={{ background: NAVY_MED }}>
        <div
          className="h-2.5 rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 70
              ? `linear-gradient(to right, ${GOLD}, ${GOLD_LIGHT})`
              : pct >= 30
              ? `linear-gradient(to right, #F59E0B, ${GOLD}80)`
              : `linear-gradient(to right, ${MUTED}, ${MUTED}80)`,
          }}
        />
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ProspeccaoDashboardClient({ data, role, userName }: Props) {
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const totalProspects = data.funil.reduce((s, f) => s + f.count, 0);
  const convertidosTotal = data.funil.find(f => f.etapa === "convertido")?.count ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/prospeccao"
            className="p-2 rounded-xl border border-white/10 hover:border-white/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" style={{ color: MUTED }} />
          </Link>
          <div>
            <h1 className="text-xl font-bold" style={{ color: CREAM }}>
              Dashboard de Prospecção
            </h1>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
              {userName} · {ROLE_LABELS[role] ?? role}
            </p>
          </div>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/8 text-[11px]"
          style={{ background: NAVY_CARD, color: MUTED }}
        >
          <Calendar className="w-3.5 h-3.5" style={{ color: GOLD }} />
          {hoje}
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total de Prospects"
          value={totalProspects}
          icon={Users}
          color="#60A5FA"
        />
        <KpiCard
          label="Taxa de Conversão"
          value={`${data.taxaConversao}%`}
          sub="convertido / total"
          icon={TrendingUp}
          color={GOLD}
        />
        <KpiCard
          label="Convertidos este Mês"
          value={data.metaMensal.atual}
          sub={`meta: ${data.metaMensal.meta}`}
          icon={Target}
          color="#34D399"
        />
        <KpiCard
          label="Meta do Mês"
          value={`${data.metaMensal.atual}/${data.metaMensal.meta}`}
          sub={`${Math.min(Math.round((data.metaMensal.atual / data.metaMensal.meta) * 100), 100)}% concluído`}
          icon={BarChart3}
          color="#A78BFA"
        />
      </div>

      {/* ── Funil Visual ─────────────────────────────────────────────────────── */}
      <FunilVisual funil={data.funil} />

      {/* ── Funil pessoal (SDR/CLOSER) ───────────────────────────────────────── */}
      {data.meusFunil && (
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
            Meu Funil Pessoal
          </p>
          <FunilVisual funil={data.meusFunil} />
        </div>
      )}

      {/* ── Evolução 7 dias ──────────────────────────────────────────────────── */}
      <Evolucao7Dias data={data.evolucao7dias} />

      {/* ── Top Closers + Origens ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TopClosers closers={data.topClosers} />
        <OrigensPanel origens={data.origens} />
      </div>

      {/* ── Meta Mensal ──────────────────────────────────────────────────────── */}
      <MetaMensal atual={data.metaMensal.atual} meta={data.metaMensal.meta} />

      {/* ── Rodapé ───────────────────────────────────────────────────────────── */}
      <div className="pb-4 text-center">
        <p className="text-[10px]" style={{ color: `${MUTED}60` }}>
          Total de prospects registrados: {totalProspects} · Convertidos: {convertidosTotal}
        </p>
      </div>
    </div>
  );
}
