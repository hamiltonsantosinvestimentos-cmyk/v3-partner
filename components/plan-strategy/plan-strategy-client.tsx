"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Compass, ChevronLeft, ChevronRight, Loader2, Save, Target, Info, LayoutGrid, ListChecks } from "lucide-react";
import { SECTORS, SECTOR_LABELS, type Sector } from "@/lib/sector-goals";
import {
  CADENCES, CADENCE_LABELS, CADENCE_QUESTION, CADENCE_FORMAT,
  STATUS_OPTIONS, STATUS_LABELS, type Cadence, type CheckinStatus,
  periodLabel, shiftDate,
} from "@/lib/plan-strategy";
import { PlanStrategyDashboard } from "@/components/plan-strategy/plan-strategy-dashboard";

interface Checkin {
  sector: string;
  cadence: string;
  period_label: string;
  status: CheckinStatus;
  summary: string;
  blockers: string;
  next_actions: string;
}

function statusPillClass(status: CheckinStatus, active: boolean) {
  if (!active) return "border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#3A5070]";
  if (status === "CONCLUIDO") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
  if (status === "EM_ANDAMENTO") return "border-amber-500/40 bg-amber-500/10 text-amber-400";
  return "border-[#7A8FA8]/40 bg-[#7A8FA8]/10 text-[#7A8FA8]";
}

function CheckinTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[9px] font-bold uppercase tracking-wide text-[#C9A84C]">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full mt-1 px-2.5 py-2 text-xs rounded-lg bg-[#0A1628] border border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 resize-none"
      />
    </div>
  );
}

function SectorCheckinCard({ sector, checkin, onSave }: {
  sector: Sector;
  checkin: Checkin;
  onSave: (updates: Partial<Checkin>) => Promise<void>;
}) {
  const [status, setStatus] = useState<CheckinStatus>(checkin.status);
  const [summary, setSummary] = useState(checkin.summary);
  const [blockers, setBlockers] = useState(checkin.blockers);
  const [nextActions, setNextActions] = useState(checkin.next_actions);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setStatus(checkin.status); setSummary(checkin.summary);
    setBlockers(checkin.blockers); setNextActions(checkin.next_actions);
    setDirty(false);
  }, [checkin]);

  function markDirty() { setDirty(true); }

  async function handleSave(nextStatus?: CheckinStatus) {
    setSaving(true);
    try {
      await onSave({
        status: nextStatus ?? status,
        summary, blockers, next_actions: nextActions,
      });
      setDirty(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-[#F0ECE4]">{SECTOR_LABELS[sector]}</p>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A84C]" />}
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); handleSave(s); }}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${statusPillClass(s, status === s)}`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <CheckinTextarea label="O que moveu / principais pontos" value={summary} onChange={v => { setSummary(v); markDirty(); }} />
      <CheckinTextarea label="Bloqueios" value={blockers} onChange={v => { setBlockers(v); markDirty(); }} />
      <CheckinTextarea label="Próximos compromissos" value={nextActions} onChange={v => { setNextActions(v); markDirty(); }} />

      <button
        onClick={() => handleSave()}
        disabled={!dirty || saving}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <Save className="w-3 h-3" /> Salvar
      </button>
    </div>
  );
}

export function PlanStrategyClient() {
  const [view, setView] = useState<"dashboard" | "cadencia">("dashboard");
  const [cadence, setCadence] = useState<Cadence>("SEMANAL");
  const [refDate, setRefDate] = useState(() => new Date());
  const [checkins, setCheckins] = useState<Record<string, Checkin> | null>(null);
  const [loading, setLoading] = useState(true);

  const period = useMemo(() => periodLabel(refDate, cadence), [refDate, cadence]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/plan-strategy/checkins?cadence=${cadence}&period=${period}`).then(r => r.json());
      setCheckins(res.data ?? null);
    } catch { /* silencioso */ }
    setLoading(false);
  }, [cadence, period]);

  useEffect(() => { load(); }, [load]);

  async function saveCheckin(sector: Sector, updates: Partial<Checkin>) {
    await fetch("/api/plan-strategy/checkins", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sector, cadence, period_label: period, ...updates }),
    });
    await load();
  }

  const doneCount = checkins ? Object.values(checkins).filter(c => c.status === "CONCLUIDO").length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center">
          <Compass className="w-5 h-5 text-[#C9A84C]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Plan Strategy</h1>
          <p className="text-xs text-muted-foreground">Cadência de planejamento estratégico (adaptação G4) — semanal → anual, por vertical</p>
        </div>
      </div>

      {/* Referência: North Star + OKR (estático, ver docs/estrategia) */}
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[#7A8FA8] leading-relaxed">
          <span className="text-[#F0ECE4] font-semibold">North Star Metric: </span>
          Monthly Active Earning Partners (MAEP) — parceiros que usaram a plataforma e receberam comissão/fecharam deal no mês.{" "}
          <span className="text-[#F0ECE4] font-semibold ml-2">Sequência Q3 2026: </span>
          Marketplace → Monetização → Ativação → IA/M&amp;A.{" "}
          Framework completo em <code className="text-[#C9A84C]">docs/estrategia/g4-cadencia-planejamento-estrategico.md</code> e{" "}
          <code className="text-[#C9A84C]">docs/estrategia/planejamento-estrategico-completo-2026.md</code>.
        </div>
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-1 bg-[#0D1929] border border-[#243A66] rounded-xl p-1 w-fit">
        <button onClick={() => setView("dashboard")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            view === "dashboard" ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"
          }`}>
          <LayoutGrid className="w-3.5 h-3.5" /> Dashboard
        </button>
        <button onClick={() => setView("cadencia")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
            view === "cadencia" ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"
          }`}>
          <ListChecks className="w-3.5 h-3.5" /> Cadência (check-ins)
        </button>
      </div>

      {view === "dashboard" ? (
        <PlanStrategyDashboard />
      ) : (
        <>
      {/* Cadence tabs */}
      <div className="flex items-center gap-1 bg-[#0D1929] border border-[#243A66] rounded-xl p-1 w-fit overflow-x-auto">
        {CADENCES.map(c => (
          <button key={c} onClick={() => setCadence(c)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              cadence === c ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"
            }`}>
            {CADENCE_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Period navigator + pergunta central */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-[#0D1929] border border-[#243A66] rounded-xl px-4 py-3">
        <div>
          <p className="text-xs text-[#F0ECE4] font-semibold">{CADENCE_FORMAT[cadence]}</p>
          <p className="text-[11px] text-[#7A8FA8] mt-0.5">{CADENCE_QUESTION[cadence]}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRefDate(d => shiftDate(d, cadence, -1))}
            className="p-1.5 rounded-lg border border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#3A5070] transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-[#C9A84C] font-mono min-w-[90px] text-center">{period}</span>
          <button onClick={() => setRefDate(d => shiftDate(d, cadence, 1))}
            className="p-1.5 rounded-lg border border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#3A5070] transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setRefDate(new Date())}
            className="ml-1 px-2.5 py-1.5 rounded-lg border border-[#243A66] text-[10px] font-semibold text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#3A5070] transition-colors">
            Hoje
          </button>
        </div>
      </div>

      {/* Progresso do período */}
      {checkins && (
        <div className="flex items-center gap-2 text-[11px] text-[#7A8FA8]">
          <Target className="w-3.5 h-3.5 text-[#C9A84C]" />
          {doneCount} de {SECTORS.length} verticais concluídas neste período
        </div>
      )}

      {/* Grid de verticais */}
      {loading || !checkins ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SECTORS.map(s => (
            <SectorCheckinCard
              key={`${cadence}-${period}-${s}`}
              sector={s}
              checkin={checkins[s] as unknown as Checkin}
              onSave={(updates) => saveCheckin(s, updates)}
            />
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
