"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, Save, Loader2, TrendingUp, TrendingDown, Target,
  Lightbulb, ShieldAlert, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const SECTORS = ["MA", "CREDITO", "CONSORCIO", "PRECATORIOS", "MARKETPLACE"] as const;
type Sector = typeof SECTORS[number];

const SECTOR_LABELS: Record<Sector, string> = {
  MA: "M&A",
  CREDITO: "Crédito",
  CONSORCIO: "Consórcio",
  PRECATORIOS: "Precatórios",
  MARKETPLACE: "Marketplace",
};

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface Form5W2H {
  sector: string;
  o_que: string; por_que: string; onde: string; quando: string; quem: string; como: string; quanto_custa: string;
}

interface FormSwot {
  sector: string;
  forcas: string; fraquezas: string; oportunidades: string; ameacas: string;
}

interface MetaMensal {
  month: number;
  meta_valor: number;
  meta_quantidade: number | null;
  realizado: number;
  pct: number;
}

interface MetasData {
  sector: string;
  year: number;
  monthly: MetaMensal[];
  annual: { meta_valor: number; meta_quantidade: number | null; realizado: number; pct: number };
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function pctColor(pct: number) {
  if (pct >= 100) return "text-emerald-400";
  if (pct >= 70) return "text-amber-400";
  return "text-red-400";
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C]">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-[#0A1628] border border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 resize-none"
      />
    </div>
  );
}

function SwotQuadrant({ label, icon, value, onChange, cls }: {
  label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; cls: string;
}) {
  return (
    <div className={`p-4 rounded-xl border ${cls}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        placeholder="Um item por linha..."
        className="w-full px-3 py-2 text-xs rounded-lg bg-[#0A1628]/60 border border-white/10 text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-white/30 resize-none"
      />
    </div>
  );
}

export function ProjetoClient() {
  const [sector, setSector] = useState<Sector>("MA");
  const [year, setYear] = useState(new Date().getFullYear());

  const [form5w2h, setForm5w2h] = useState<Form5W2H | null>(null);
  const [formSwot, setFormSwot] = useState<FormSwot | null>(null);
  const [metas, setMetas] = useState<MetasData | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving5w2h, setSaving5w2h] = useState(false);
  const [savingSwot, setSavingSwot] = useState(false);
  const [savingMeta, setSavingMeta] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r5w2h, rSwot, rMetas] = await Promise.all([
        fetch(`/api/projeto/5w2h?sector=${sector}`).then(r => r.json()),
        fetch(`/api/projeto/swot?sector=${sector}`).then(r => r.json()),
        fetch(`/api/projeto/metas?sector=${sector}&year=${year}`).then(r => r.json()),
      ]);
      setForm5w2h(r5w2h.data);
      setFormSwot(rSwot.data);
      setMetas(rMetas);
    } catch { /* silencioso */ }
    setLoading(false);
  }, [sector, year]);

  useEffect(() => { load(); }, [load]);

  async function salvar5w2h() {
    if (!form5w2h) return;
    setSaving5w2h(true);
    try {
      await fetch("/api/projeto/5w2h", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form5w2h, sector }),
      });
    } finally { setSaving5w2h(false); }
  }

  async function salvarSwot() {
    if (!formSwot) return;
    setSavingSwot(true);
    try {
      await fetch("/api/projeto/swot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formSwot, sector }),
      });
    } finally { setSavingSwot(false); }
  }

  async function salvarMeta(month: number | null, metaValor: number, metaQuantidade: number | null) {
    setSavingMeta(month === null ? "annual" : String(month));
    try {
      await fetch("/api/projeto/metas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector, year, month, meta_valor: metaValor, meta_quantidade: metaQuantidade }),
      });
      await load();
    } finally { setSavingMeta(null); }
  }

  const chartData = metas?.monthly.map(m => ({
    mes: MESES[m.month - 1],
    Meta: m.meta_valor,
    Realizado: m.realizado,
  })) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/30 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-[#C9A84C]" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Projeto</h1>
          <p className="text-xs text-muted-foreground">5W2H, Matriz SWOT e Metas por setor, conectadas a dados reais da operação</p>
        </div>
      </div>

      {/* Sector tabs */}
      <div className="flex items-center gap-1 bg-[#0D1929] border border-[#243A66] rounded-xl p-1 w-fit overflow-x-auto">
        {SECTORS.map(s => (
          <button key={s} onClick={() => setSector(s)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              sector === s ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"
            }`}>
            {SECTOR_LABELS[s]}
          </button>
        ))}
      </div>

      {loading && !form5w2h ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" /></div>
      ) : (
        <>
          {/* 5W2H */}
          {form5w2h && (
            <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">5W2H — {SECTOR_LABELS[sector]}</p>
                <button onClick={salvar5w2h} disabled={saving5w2h}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/20 text-xs font-semibold transition-colors disabled:opacity-50">
                  {saving5w2h ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <Field label="O quê" value={form5w2h.o_que} onChange={v => setForm5w2h({ ...form5w2h, o_que: v })} />
                <Field label="Por quê" value={form5w2h.por_que} onChange={v => setForm5w2h({ ...form5w2h, por_que: v })} />
                <Field label="Onde" value={form5w2h.onde} onChange={v => setForm5w2h({ ...form5w2h, onde: v })} />
                <Field label="Quando" value={form5w2h.quando} onChange={v => setForm5w2h({ ...form5w2h, quando: v })} />
                <Field label="Quem" value={form5w2h.quem} onChange={v => setForm5w2h({ ...form5w2h, quem: v })} />
                <Field label="Como" value={form5w2h.como} onChange={v => setForm5w2h({ ...form5w2h, como: v })} />
                <Field label="Quanto custa" value={form5w2h.quanto_custa} onChange={v => setForm5w2h({ ...form5w2h, quanto_custa: v })} />
              </div>
            </div>
          )}

          {/* SWOT */}
          {formSwot && (
            <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Matriz SWOT — {SECTOR_LABELS[sector]}</p>
                <button onClick={salvarSwot} disabled={savingSwot}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/20 text-xs font-semibold transition-colors disabled:opacity-50">
                  {savingSwot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <SwotQuadrant label="Forças" icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
                  cls="border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                  value={formSwot.forcas} onChange={v => setFormSwot({ ...formSwot, forcas: v })} />
                <SwotQuadrant label="Fraquezas" icon={<TrendingDown className="w-4 h-4 text-red-400" />}
                  cls="border-red-500/30 bg-red-500/5 text-red-400"
                  value={formSwot.fraquezas} onChange={v => setFormSwot({ ...formSwot, fraquezas: v })} />
                <SwotQuadrant label="Oportunidades" icon={<Lightbulb className="w-4 h-4 text-blue-400" />}
                  cls="border-blue-500/30 bg-blue-500/5 text-blue-400"
                  value={formSwot.oportunidades} onChange={v => setFormSwot({ ...formSwot, oportunidades: v })} />
                <SwotQuadrant label="Ameaças" icon={<ShieldAlert className="w-4 h-4 text-amber-400" />}
                  cls="border-amber-500/30 bg-amber-500/5 text-amber-400"
                  value={formSwot.ameacas} onChange={v => setFormSwot({ ...formSwot, ameacas: v })} />
              </div>
            </div>
          )}

          {/* Metas */}
          {metas && (
            <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest flex items-center gap-2">
                  <Target className="w-4 h-4" /> Metas — {SECTOR_LABELS[sector]}
                </p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setYear(y => y - 1)} className="p-1.5 rounded-lg border border-[#243A66] text-[#7A8FA8] hover:text-white transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-bold text-white w-12 text-center">{year}</span>
                  <button onClick={() => setYear(y => y + 1)} className="p-1.5 rounded-lg border border-[#243A66] text-[#7A8FA8] hover:text-white transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Meta anual */}
              <div className="p-4 rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-[#C9A84C] uppercase">Meta Anual {year}</p>
                  <span className={`text-sm font-bold ${pctColor(metas.annual.pct)}`}>{metas.annual.pct}%</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground">Meta (R$)</label>
                    <input
                      type="number"
                      defaultValue={metas.annual.meta_valor || ""}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        if (v !== metas.annual.meta_valor) salvarMeta(null, v, metas.annual.meta_quantidade);
                      }}
                      className="w-full px-3 py-1.5 text-sm rounded-lg bg-[#0A1628] border border-[#243A66] text-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                    />
                  </div>
                  <div className="flex-1 text-right">
                    <p className="text-[10px] text-muted-foreground">Realizado</p>
                    <p className="text-lg font-bold text-white">{moeda(metas.annual.realizado)}</p>
                  </div>
                  {savingMeta === "annual" && <Loader2 className="w-4 h-4 animate-spin text-[#C9A84C]" />}
                </div>
                <div className="w-full h-2 rounded-full bg-[#0A1628] mt-3 overflow-hidden">
                  <div className={`h-full rounded-full ${metas.annual.pct >= 100 ? "bg-emerald-500" : "bg-[#C9A84C]"}`}
                    style={{ width: `${Math.min(metas.annual.pct, 100)}%` }} />
                </div>
              </div>

              {/* Gráfico meta x realizado */}
              <div className="p-4 rounded-xl border border-[#243A66] bg-[#0D1929]">
                <p className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide mb-4">Meta x Realizado por Mês</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#243A66" />
                    <XAxis dataKey="mes" tick={{ fill: "#7A8FA8", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#7A8FA8", fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: "#0D1929", border: "1px solid #243A66", borderRadius: 8, fontSize: 11 }}
                      formatter={(v) => moeda(Number(v) || 0)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Meta" fill="#243A66" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Realizado" fill="#C9A84C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Metas mensais */}
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide">Metas Mensais</p>
                {metas.monthly.map(m => (
                  <div key={m.month} className="flex items-center gap-3 p-2.5 rounded-lg border border-[#243A66] bg-[#0D1929]">
                    <span className="text-xs font-semibold text-white w-8">{MESES[m.month - 1]}</span>
                    <input
                      type="number"
                      defaultValue={m.meta_valor || ""}
                      placeholder="Meta R$"
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value) || 0;
                        if (v !== m.meta_valor) salvarMeta(m.month, v, m.meta_quantidade);
                      }}
                      className="w-32 px-2.5 py-1.5 text-xs rounded-lg bg-[#0A1628] border border-[#243A66] text-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                    />
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">Realizado:</span>
                    <span className="text-xs font-semibold text-white flex-1">{moeda(m.realizado)}</span>
                    <span className={`text-xs font-bold w-12 text-right ${pctColor(m.pct)}`}>{m.pct}%</span>
                    {savingMeta === String(m.month) && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A84C]" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
