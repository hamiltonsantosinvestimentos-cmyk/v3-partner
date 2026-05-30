"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronRight, Loader2, Plus, X, Zap, Archive } from "lucide-react";

type InvestorDemand = {
  id: string;
  nome_contato: string;
  email: string;
  telefone?: string;
  empresa?: string;
  setores: string[];
  ufs: string[];
  ticket_min: number;
  ticket_max: number;
  tipos_operacao: string[];
  criterios?: string;
  origem: string;
  status: string;
  notas?: string;
  created_at: string;
  demand_matches?: { count: number }[];
};

type DemandMatch = {
  id: string;
  deal_id: string;
  score: number;
  status: string;
  match_reasons: { setor_match: boolean; uf_match: boolean; ticket_match: boolean };
  ma_deals?: { title: string; v3_code: string; setor: string };
};

const SETORES_V3 = [
  "real_estate", "agro", "mineracao", "fintech",
  "varejo", "logistica", "saude", "tecnologia", "industria", "energia", "outro",
];

const SETORES_LABEL: Record<string, string> = {
  real_estate: "Real Estate", agro: "Agronegócio", mineracao: "Mineração",
  fintech: "Fintech", varejo: "Varejo", logistica: "Logística",
  saude: "Saúde", tecnologia: "Tecnologia", industria: "Indústria",
  energia: "Energia", outro: "Outro",
};

function formatM(v: number) {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  return `R$ ${(v / 1e3).toFixed(0)}K`;
}

function scoreColor(score: number) {
  if (score >= 80) return "#C9A84C";
  if (score >= 50) return "#9BAFC5";
  return "#5A7490";
}

export function BuysideDemandPanel() {
  const [demands, setDemands] = useState<InvestorDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Record<string, DemandMatch[]>>({});
  const [matchLoading, setMatchLoading] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome_contato: "",
    email: "",
    telefone: "",
    empresa: "",
    cnpj: "",
    setores: [] as string[],
    ticket_min: "",
    ticket_max: "",
    criterios: "",
    origem: "portal",
  });

  const fetchDemands = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ma/investor-demands?status=ativo");
      const data = await res.json();
      setDemands(data.demands ?? []);
    } catch {
      setError("Erro ao carregar demandas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDemands(); }, [fetchDemands]);

  async function runMatching(demandId: string) {
    setMatchLoading(demandId);
    try {
      const res = await fetch(`/api/ma/investor-demands/${demandId}/match`, { method: "POST" });
      const data = await res.json();
      setMatches(prev => ({ ...prev, [demandId]: data.matches ?? [] }));
    } catch {
      setError("Erro ao executar matching.");
    } finally {
      setMatchLoading(null);
    }
  }

  async function loadMatches(demandId: string) {
    if (matches[demandId]) return;
    setMatchLoading(demandId);
    try {
      const res = await fetch(`/api/ma/investor-demands/${demandId}/match`, { method: "POST" });
      const data = await res.json();
      setMatches(prev => ({ ...prev, [demandId]: data.matches ?? [] }));
    } finally {
      setMatchLoading(null);
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadMatches(id);
    }
  }

  async function archiveDemand(demandId: string) {
    setArchiving(demandId);
    try {
      await fetch(`/api/ma/investor-demands/${demandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "arquivado" }),
      });
      setDemands(prev => prev.filter(d => d.id !== demandId));
    } finally {
      setArchiving(null);
    }
  }

  async function submitDemand(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome_contato || !form.email || !form.setores.length || !form.ticket_min || !form.ticket_max) {
      setError("Preencha: nome, email, setores, ticket mín e máx.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ma/investor-demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ticket_min: Number(form.ticket_min),
          ticket_max: Number(form.ticket_max),
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erro ao salvar.");
        return;
      }
      setShowForm(false);
      setForm({ nome_contato: "", email: "", telefone: "", empresa: "", cnpj: "", setores: [], ticket_min: "", ticket_max: "", criterios: "", origem: "portal" });
      fetchDemands();
    } finally {
      setSaving(false);
    }
  }

  function toggleSetor(s: string) {
    setForm(prev => ({
      ...prev,
      setores: prev.setores.includes(s)
        ? prev.setores.filter(x => x !== s)
        : [...prev.setores, s],
    }));
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#F5F1E8]">Demandas Buy-Side</p>
          <p className="text-xs text-[#9BAFC5]">Compradores com mandato ativo — matched contra o pipeline V3</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(null); }}
          className="flex items-center gap-1.5 rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold px-3 py-2 hover:bg-[#C9A84C]/25 transition-colors"
        >
          <Plus size={13} />
          Nova Demanda
        </button>
      </div>

      {/* Formulário de Nova Demanda */}
      {showForm && (
        <form onSubmit={submitDemand} className="rounded-xl border border-[#243A66] bg-[#13223A] p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-[#F5F1E8]">Nova Demanda Buy-Side</p>
            <button type="button" onClick={() => setShowForm(false)} className="text-[#9BAFC5] hover:text-[#F5F1E8]">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#E8C97A] mb-1 block">Nome *</label>
              <input
                value={form.nome_contato}
                onChange={e => setForm(p => ({ ...p, nome_contato: e.target.value }))}
                className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#F5F1E8] text-xs px-3 py-2 outline-none focus:border-[#C9A84C]/60"
                placeholder="Nome do contato"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#E8C97A] mb-1 block">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#F5F1E8] text-xs px-3 py-2 outline-none focus:border-[#C9A84C]/60"
                placeholder="email@empresa.com"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#E8C97A] mb-1 block">Empresa</label>
              <input
                value={form.empresa}
                onChange={e => setForm(p => ({ ...p, empresa: e.target.value }))}
                className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#F5F1E8] text-xs px-3 py-2 outline-none focus:border-[#C9A84C]/60"
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#E8C97A] mb-1 block">Telefone</label>
              <input
                value={form.telefone}
                onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))}
                className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#F5F1E8] text-xs px-3 py-2 outline-none focus:border-[#C9A84C]/60"
                placeholder="+55 11 9xxxx-xxxx"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#E8C97A] mb-1 block">Ticket Mín (R$) *</label>
              <input
                type="number"
                value={form.ticket_min}
                onChange={e => setForm(p => ({ ...p, ticket_min: e.target.value }))}
                className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#F5F1E8] text-xs px-3 py-2 outline-none focus:border-[#C9A84C]/60"
                placeholder="5000000"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#E8C97A] mb-1 block">Ticket Máx (R$) *</label>
              <input
                type="number"
                value={form.ticket_max}
                onChange={e => setForm(p => ({ ...p, ticket_max: e.target.value }))}
                className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#F5F1E8] text-xs px-3 py-2 outline-none focus:border-[#C9A84C]/60"
                placeholder="30000000"
              />
            </div>
          </div>

          {/* Setores */}
          <div>
            <label className="text-[10px] font-bold tracking-widest uppercase text-[#E8C97A] mb-2 block">Setores de Interesse *</label>
            <div className="flex flex-wrap gap-1.5">
              {SETORES_V3.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSetor(s)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold transition-colors ${
                    form.setores.includes(s)
                      ? "border-[#C9A84C] bg-[#C9A84C]/15 text-[#C9A84C]"
                      : "border-[#243A66] bg-transparent text-[#9BAFC5] hover:border-[#9BAFC5]"
                  }`}
                >
                  {SETORES_LABEL[s] ?? s}
                </button>
              ))}
            </div>
          </div>

          {/* Critérios */}
          <div>
            <label className="text-[10px] font-bold tracking-widest uppercase text-[#E8C97A] mb-1 block">Critérios adicionais</label>
            <textarea
              value={form.criterios}
              onChange={e => setForm(p => ({ ...p, criterios: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#F5F1E8] text-xs px-3 py-2 outline-none focus:border-[#C9A84C]/60 resize-none"
              placeholder="Descreva critérios de investimento, preferências de estrutura, etc."
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-xs text-[#9BAFC5] hover:text-[#F5F1E8] px-3 py-1.5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold px-4 py-1.5 hover:bg-[#E8C97A] transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              Salvar Demanda
            </button>
          </div>
        </form>
      )}

      {/* Lista de Demandas */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="text-[#9BAFC5] animate-spin" />
        </div>
      ) : demands.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-[#243A66]">
          <Zap size={24} className="text-[#5A7490] mx-auto mb-3 opacity-40" />
          <p className="text-[#5A7490] text-sm">Nenhuma demanda buy-side ativa.</p>
          <p className="text-[#5A7490] text-xs mt-1">Use o botão acima para cadastrar ou aguarde o intake via n8n W6.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {demands.map(d => {
            const isExpanded = expandedId === d.id;
            const demandMatches = matches[d.id];
            const isMatchLoading = matchLoading === d.id;

            return (
              <div key={d.id} className="rounded-xl border border-[#162744] bg-[#162744]/60 overflow-hidden">
                {/* Card header */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[#162744] transition-colors"
                  onClick={() => toggleExpand(d.id)}
                >
                  <div className="flex-shrink-0 text-[#9BAFC5]">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-[#F5F1E8] truncate">{d.nome_contato}</p>
                      {d.empresa && <span className="text-xs text-[#9BAFC5] truncate">— {d.empresa}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {d.setores.slice(0, 3).map(s => (
                        <span key={s} className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-[#C9A84C]/10 text-[#E8C97A]">
                          {SETORES_LABEL[s] ?? s}
                        </span>
                      ))}
                      {d.setores.length > 3 && (
                        <span className="text-[10px] text-[#9BAFC5]">+{d.setores.length - 3}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-bold text-[#C9A84C]">{formatM(d.ticket_min)} – {formatM(d.ticket_max)}</p>
                      <p className="text-[10px] text-[#9BAFC5]">{new Date(d.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#E8C97A] font-semibold">
                      ativo
                    </span>
                  </div>
                </div>

                {/* Expanded: Matches */}
                {isExpanded && (
                  <div className="border-t border-[#243A66] p-4 bg-[#09081A]/60">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold text-[#F5F1E8]">Deals compatíveis</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => runMatching(d.id)}
                          disabled={isMatchLoading}
                          className="flex items-center gap-1.5 rounded-lg border border-[#C9A84C]/40 text-[#C9A84C] text-[11px] font-semibold px-3 py-1.5 hover:bg-[#C9A84C]/10 transition-colors disabled:opacity-50"
                        >
                          {isMatchLoading ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
                          Executar Matching
                        </button>
                        <button
                          onClick={() => archiveDemand(d.id)}
                          disabled={archiving === d.id}
                          className="flex items-center gap-1 rounded-lg border border-[#243A66] text-[#9BAFC5] text-[11px] px-2.5 py-1.5 hover:text-[#F5F1E8] transition-colors disabled:opacity-50"
                          title="Arquivar demanda"
                        >
                          {archiving === d.id ? <Loader2 size={11} className="animate-spin" /> : <Archive size={11} />}
                        </button>
                      </div>
                    </div>

                    {isMatchLoading && !demandMatches && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 size={16} className="text-[#9BAFC5] animate-spin" />
                      </div>
                    )}

                    {demandMatches && demandMatches.length === 0 && (
                      <p className="text-xs text-[#5A7490] text-center py-4">
                        Nenhum deal compatível encontrado (score mínimo: 50).
                      </p>
                    )}

                    {demandMatches && demandMatches.length > 0 && (
                      <div className="space-y-2">
                        {demandMatches.map(m => {
                          const reasons = m.match_reasons ?? {};
                          return (
                            <div key={m.id ?? m.deal_id} className="rounded-lg border border-[#162744] bg-[#162744]/60 p-3">
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold text-[#F5F1E8]">
                                    {(m as unknown as { title?: string }).title ?? m.ma_deals?.title ?? "Deal"}
                                  </p>
                                  <span className="text-[10px] text-[#9BAFC5]">
                                    {(m as unknown as { v3_code?: string }).v3_code ?? m.ma_deals?.v3_code ?? ""}
                                  </span>
                                </div>
                                <span
                                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                                  style={{ color: scoreColor(m.score), background: `${scoreColor(m.score)}18` }}
                                >
                                  {m.score}%
                                </span>
                              </div>
                              <div className="flex gap-2">
                                {reasons.setor_match && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C9A84C]/10 text-[#E8C97A]">setor</span>
                                )}
                                {reasons.uf_match && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C9A84C]/10 text-[#E8C97A]">UF</span>
                                )}
                                {reasons.ticket_match && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#C9A84C]/10 text-[#E8C97A]">ticket</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {d.criterios && (
                      <div className="mt-3 pt-3 border-t border-[#243A66]/50">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-[#E8C97A] mb-1">Critérios</p>
                        <p className="text-xs text-[#9BAFC5]">{d.criterios}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
