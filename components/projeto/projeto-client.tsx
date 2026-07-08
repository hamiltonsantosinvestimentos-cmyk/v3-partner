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

interface Item5W2H {
  id: string;
  sector: string;
  o_que: string; por_que: string; onde: string; quando: string; quem: string; como: string; quanto_custa: string;
  prazo: string | null;
  concluido: boolean;
  concluido_em: string | null;
  created_at: string;
}

const NOVO_ITEM_VAZIO = { o_que: "", por_que: "", onde: "", quando: "", quem: "", como: "", quanto_custa: "", prazo: "" };

function statusItem5w2h(item: Item5W2H): { label: string; cls: string; dot: string } {
  if (item.concluido) return { label: "Concluído", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", dot: "bg-emerald-500" };
  if (item.prazo && new Date(item.prazo + "T23:59:59") < new Date()) {
    return { label: "Em atraso", cls: "border-red-500/30 bg-red-500/10 text-red-400", dot: "bg-red-500" };
  }
  return { label: "Em andamento", cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", dot: "bg-amber-500" };
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

  const [items5w2h, setItems5w2h] = useState<Item5W2H[]>([]);
  const [novoItem, setNovoItem] = useState(NOVO_ITEM_VAZIO);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [formSwot, setFormSwot] = useState<FormSwot | null>(null);
  const [metas, setMetas] = useState<MetasData | null>(null);

  const [loading, setLoading] = useState(true);
  const [savingNovoItem, setSavingNovoItem] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
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
      setItems5w2h(r5w2h.data ?? []);
      setFormSwot(rSwot.data);
      setMetas(rMetas);
    } catch { /* silencioso */ }
    setLoading(false);
  }, [sector, year]);

  useEffect(() => { load(); }, [load]);

  async function criarItem5w2h() {
    if (!novoItem.o_que.trim()) return;
    setSavingNovoItem(true);
    try {
      await fetch("/api/projeto/5w2h", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...novoItem, sector }),
      });
      setNovoItem(NOVO_ITEM_VAZIO);
      await load();
    } finally { setSavingNovoItem(false); }
  }

  async function atualizarItem5w2h(id: string, updates: Partial<Item5W2H>) {
    setSavingItemId(id);
    try {
      await fetch("/api/projeto/5w2h", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      await load();
    } finally { setSavingItemId(null); }
  }

  async function excluirItem5w2h(id: string) {
    setSavingItemId(id);
    try {
      await fetch(`/api/projeto/5w2h?id=${id}`, { method: "DELETE" });
      await load();
    } finally { setSavingItemId(null); }
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

      {loading && items5w2h.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" /></div>
      ) : (
        <>
          {/* 5W2H — lista de itens de ação com prazo e status */}
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-5 space-y-4">
            <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">5W2H — {SECTOR_LABELS[sector]}</p>

            {/* Novo item */}
            <div className="p-4 rounded-xl border border-dashed border-[#243A66] space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <Field label="O quê *" value={novoItem.o_que} onChange={v => setNovoItem({ ...novoItem, o_que: v })} />
                <Field label="Por quê" value={novoItem.por_que} onChange={v => setNovoItem({ ...novoItem, por_que: v })} />
                <Field label="Onde" value={novoItem.onde} onChange={v => setNovoItem({ ...novoItem, onde: v })} />
                <Field label="Quando" value={novoItem.quando} onChange={v => setNovoItem({ ...novoItem, quando: v })} />
                <Field label="Quem" value={novoItem.quem} onChange={v => setNovoItem({ ...novoItem, quem: v })} />
                <Field label="Como" value={novoItem.como} onChange={v => setNovoItem({ ...novoItem, como: v })} />
                <Field label="Quanto custa" value={novoItem.quanto_custa} onChange={v => setNovoItem({ ...novoItem, quanto_custa: v })} />
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C]">Prazo</label>
                  <input type="date" value={novoItem.prazo}
                    onChange={e => setNovoItem({ ...novoItem, prazo: e.target.value })}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-[#0A1628] border border-[#243A66] text-[#F0ECE4] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
                </div>
              </div>
              <button onClick={criarItem5w2h} disabled={savingNovoItem || !novoItem.o_que.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold transition-colors disabled:opacity-50">
                {savingNovoItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Adicionar item
              </button>
            </div>

            {/* Lista de acompanhamento */}
            <div className="space-y-2">
              {items5w2h.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum item cadastrado ainda.</p>
              )}
              {items5w2h.map(item => {
                const st = statusItem5w2h(item);
                const isOpen = expandedItem === item.id;
                return (
                  <div key={item.id} className={`rounded-xl border ${st.cls} overflow-hidden`}>
                    <button onClick={() => setExpandedItem(isOpen ? null : item.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                      <span className="text-xs font-semibold text-[#F0ECE4] flex-1 truncate">{item.o_que}</span>
                      {item.prazo && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          Prazo {new Date(item.prazo + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${st.cls}`}>{st.label}</span>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                          {(["por_que", "onde", "quando", "quem", "como", "quanto_custa"] as const).map(campo => (
                            <div key={campo}>
                              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                {{ por_que: "Por quê", onde: "Onde", quando: "Quando", quem: "Quem", como: "Como", quanto_custa: "Quanto custa" }[campo]}
                              </label>
                              <textarea
                                defaultValue={item[campo] ?? ""}
                                rows={2}
                                onBlur={(e) => { if (e.target.value !== item[campo]) atualizarItem5w2h(item.id, { [campo]: e.target.value }); }}
                                className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-[#0A1628]/60 border border-white/10 text-[#F0ECE4] focus:outline-none focus:ring-1 focus:ring-white/30 resize-none"
                              />
                            </div>
                          ))}
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Prazo</label>
                            <input type="date" defaultValue={item.prazo ?? ""}
                              onBlur={(e) => { if (e.target.value !== item.prazo) atualizarItem5w2h(item.id, { prazo: e.target.value || null }); }}
                              className="w-full mt-1 px-3 py-2 text-xs rounded-lg bg-[#0A1628]/60 border border-white/10 text-[#F0ECE4] focus:outline-none focus:ring-1 focus:ring-white/30" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => atualizarItem5w2h(item.id, { concluido: !item.concluido })}
                            disabled={savingItemId === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold transition-colors disabled:opacity-50">
                            {savingItemId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                            {item.concluido ? "Reabrir" : "Marcar como concluído"}
                          </button>
                          <button
                            onClick={() => excluirItem5w2h(item.id)}
                            disabled={savingItemId === item.id}
                            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors disabled:opacity-50">
                            Excluir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

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
