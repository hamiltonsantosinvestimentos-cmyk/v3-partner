"use client";

import { useState } from "react";
import {
  Target, CheckCircle2, DollarSign, Building2,
  TrendingUp, TrendingDown, Edit3, Save, X,
} from "lucide-react";

interface PartnerPerformance {
  id: string;
  name: string;
  proposals: number;
  approvals: number;
  volume: number;
  deals: number;
  commissions: number;
}

interface PartnerGoal {
  partner_id: string;
  goal_proposals: number;
  goal_approvals: number;
  goal_volume: number;
  goal_deals: number;
}

interface MetasClientProps {
  userRole: string;
  userId: string;
  userName: string;
  year: number;
  month: number;
  performance: PartnerPerformance[];
  goals: Record<string, PartnerGoal>;
  isAdmin: boolean;
}

const MONTH_NAMES = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatCurrency(v: number) {
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

function ProgressBar({
  label,
  icon,
  real,
  meta,
  formatFn,
  color = "#C9A84C",
}: {
  label: string;
  icon: React.ReactNode;
  real: number;
  meta: number;
  formatFn?: (v: number) => string;
  color?: string;
}) {
  const pct = meta > 0 ? Math.min(Math.round((real / meta) * 100), 100) : 0;
  const exceeded = meta > 0 && real >= meta;
  const barColor = exceeded ? "#10B981" : color;
  const fmt = formatFn ?? ((v: number) => String(v));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span style={{ color }}>{icon}</span>
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground">{fmt(real)}</span>
          <span className="text-muted-foreground">/ {fmt(meta)}</span>
          <span
            className="font-bold text-[11px] px-1.5 py-0.5 rounded"
            style={{ color: barColor, background: `${barColor}18` }}
          >
            {meta > 0 ? `${pct}%` : "—"}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-[#122036] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
    </div>
  );
}

function GoalEditor({
  partnerId,
  goal,
  onSave,
  onCancel,
}: {
  partnerId: string;
  goal: Partial<PartnerGoal>;
  onSave: (g: PartnerGoal) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    goal_proposals: goal.goal_proposals ?? 0,
    goal_approvals: goal.goal_approvals ?? 0,
    goal_volume: (goal.goal_volume ?? 0) / 1e6,
    goal_deals: goal.goal_deals ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const now = new Date();
      const res = await fetch("/api/partner-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: partnerId,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          goal_proposals: form.goal_proposals,
          goal_approvals: form.goal_approvals,
          goal_volume: form.goal_volume * 1e6,
          goal_deals: form.goal_deals,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      onSave(data.goal);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 p-3 rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/5 space-y-3">
      <p className="text-xs font-semibold text-[#E8C97A]">Definir Metas do Mês</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Meta Propostas", key: "goal_proposals", suffix: "" },
          { label: "Meta Aprovações", key: "goal_approvals", suffix: "" },
          { label: "Meta Volume (R$ M)", key: "goal_volume", suffix: "M", step: "0.1" },
          { label: "Meta Deals M&A", key: "goal_deals", suffix: "" },
        ].map(({ label, key, suffix, step }) => (
          <div key={key}>
            <label className="text-[10px] text-muted-foreground block mb-1">{label}</label>
            <div className="flex items-center gap-1 bg-[#09081A] border border-[#243A66] rounded px-2 py-1">
              <input
                type="number"
                min={0}
                step={step ?? 1}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                className="flex-1 bg-transparent text-xs text-foreground focus:outline-none w-full"
              />
              {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-[#243A66] text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3 h-3" /> Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded bg-[#C9A84C] text-white hover:bg-[#E8C97A] disabled:opacity-50 transition-colors"
        >
          <Save className="w-3 h-3" /> {saving ? "Salvando..." : "Salvar Metas"}
        </button>
      </div>
    </div>
  );
}

export function MetasClient({
  userRole,
  userId,
  year,
  month,
  performance,
  goals: initialGoals,
  isAdmin,
}: MetasClientProps) {
  const [goals, setGoals] = useState(initialGoals);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleGoalSaved = (partnerId: string, goal: PartnerGoal) => {
    setGoals((prev) => ({ ...prev, [partnerId]: goal }));
    setEditingId(null);
  };

  const overallStats = performance.reduce(
    (acc, p) => ({
      proposals: acc.proposals + p.proposals,
      approvals: acc.approvals + p.approvals,
      volume: acc.volume + p.volume,
      deals: acc.deals + p.deals,
    }),
    { proposals: 0, approvals: 0, volume: 0, deals: 0 }
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Metas & Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {MONTH_NAMES[month]} {year} · Acompanhe o progresso vs. metas definidas
        </p>
      </div>

      {/* Resumo geral */}
      {isAdmin && performance.length > 1 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Propostas", value: overallStats.proposals, icon: <Target className="w-4 h-4" /> },
            { label: "Total Aprovações", value: overallStats.approvals, icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: "Volume Total", value: formatCurrency(overallStats.volume), icon: <DollarSign className="w-4 h-4" /> },
            { label: "Deals M&A", value: overallStats.deals, icon: <Building2 className="w-4 h-4" /> },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 text-[#C9A84C]">{stat.icon}</div>
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cards por parceiro */}
      <div className="space-y-4">
        {performance.map((partner) => {
          const goal = goals[partner.id];
          const isEditing = editingId === partner.id;
          const canEdit = isAdmin || partner.id === userId;

          const approvalRate = partner.proposals > 0
            ? Math.round((partner.approvals / partner.proposals) * 100)
            : 0;

          return (
            <div
              key={partner.id}
              className="bg-[#111F35] border border-[#243A66] rounded-xl p-5 space-y-4"
            >
              {/* Nome e ações */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-foreground">{partner.name}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Taxa de aprovação: {approvalRate}% · Comissões pagas: {formatCurrency(partner.commissions)}
                  </p>
                </div>
                {isAdmin && !isEditing && (
                  <button
                    onClick={() => setEditingId(partner.id)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    {goal ? "Editar Metas" : "Definir Metas"}
                  </button>
                )}
              </div>

              {/* Barras de progresso */}
              {goal ? (
                <div className="space-y-3">
                  <ProgressBar
                    label="Propostas Submetidas"
                    icon={<Target className="w-3.5 h-3.5" />}
                    real={partner.proposals}
                    meta={goal.goal_proposals}
                  />
                  <ProgressBar
                    label="Operações Aprovadas"
                    icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    real={partner.approvals}
                    meta={goal.goal_approvals}
                  />
                  <ProgressBar
                    label="Volume Aprovado"
                    icon={<DollarSign className="w-3.5 h-3.5" />}
                    real={partner.volume}
                    meta={goal.goal_volume}
                    formatFn={formatCurrency}
                  />
                  <ProgressBar
                    label="Deals M&A Fechados"
                    icon={<Building2 className="w-3.5 h-3.5" />}
                    real={partner.deals}
                    meta={goal.goal_deals}
                  />
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-[#243A66] rounded-lg">
                  {isAdmin
                    ? "Nenhuma meta definida — clique em Definir Metas para configurar"
                    : "Metas não definidas pelo gestor para este mês"}
                </div>
              )}

              {/* Performance sem meta */}
              {!goal && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: "Propostas", value: partner.proposals, icon: <Target className="w-3.5 h-3.5" />, trend: null },
                    { label: "Aprovações", value: partner.approvals, icon: <CheckCircle2 className="w-3.5 h-3.5" />, trend: null },
                    { label: "Volume", value: formatCurrency(partner.volume), icon: <DollarSign className="w-3.5 h-3.5" />, trend: null },
                    { label: "Deals", value: partner.deals, icon: <Building2 className="w-3.5 h-3.5" />, trend: null },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-[#09081A] rounded-lg p-3 text-center">
                      <div className="flex justify-center mb-1 text-[#C9A84C]">{stat.icon}</div>
                      <p className="text-lg font-bold text-foreground">{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Editor de metas */}
              {isEditing && (
                <GoalEditor
                  partnerId={partner.id}
                  goal={goal ?? {}}
                  onSave={(g) => handleGoalSaved(partner.id, g)}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-[#10B981]" />
          <span>Meta atingida (≥ 100%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-[#C9A84C]" />
          <span>Em progresso</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-1.5 rounded-full bg-[#122036]" />
          <span>Não iniciado</span>
        </div>
      </div>
    </div>
  );
}
