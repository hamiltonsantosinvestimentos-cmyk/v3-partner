"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Plus, X, Check, ChevronDown, ChevronUp, Mail, Phone, Loader2, Building2, Target, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvestorMatch = {
  investor_id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  tipo: string;
  setores: string[];
  ufs: string[];
  ticket_min: number | null;
  ticket_max: number | null;
  tipos_operacao: string[];
  criterios: string | null;
  status: string;
  match_score: number;
  match_reasons: string[];
};

type InvestorForm = {
  nome: string; email: string; telefone: string; tipo: string;
  setores: string[]; ufs: string[]; ticket_min: string; ticket_max: string;
  tipos_operacao: string[]; criterios: string; notas: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const TIPOS = ["family_office", "fundo_investimento", "estrategico", "individual", "outro"];
const TIPO_LABELS: Record<string, string> = {
  family_office: "Family Office", fundo_investimento: "Fundo de Investimento",
  estrategico: "Investidor Estratégico", individual: "Individual", outro: "Outro",
};
const SETORES_OPTS = [
  "Real Estate", "Saúde", "Agronegócio", "Logística", "Tecnologia",
  "Indústria", "Energia", "Varejo", "Fintech", "Mineração", "Educação", "Outro",
];
const UFS_OPTS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];
const TIPOS_OP = [
  "Venda Total (100%)", "Venda Parcial", "Captação de Capital",
  "Parceria Estratégica", "Real Estate", "M&A Cross-Border", "Recuperação Judicial",
];

function scoreColor(s: number) {
  if (s >= 80) return "#10B981";
  if (s >= 50) return "#F59E0B";
  return "#7A8FA8";
}

function formatM(v: number | null) {
  if (!v) return "—";
  if (v >= 1e9) return `R$ ${(v/1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v/1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v/1e3).toFixed(0)}K`;
  return `R$ ${v}`;
}

function MultiSelect({ options, value, onChange, label }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; label: string;
}) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter(x => x !== opt) : [...value, opt]);
  return (
    <div>
      <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">{label}</label>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`text-[10px] px-2 py-1 rounded-full border font-medium transition-colors ${
              value.includes(opt)
                ? "bg-[#C9A84C]/15 border-[#C9A84C]/50 text-[#C9A84C]"
                : "border-[#243A66] text-[#7A8FA8] hover:border-[#C9A84C]/30"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props { dealId: string; dealCode: string; }

export function InvestorMatchPanel({ dealId, dealCode }: Props) {
  const [matches, setMatches]       = useState<InvestorMatch[]>([]);
  const [loading, setLoading]       = useState(false);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveOk, setSaveOk]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [expanded, setExpanded]     = useState<string | null>(null);

  const emptyForm: InvestorForm = {
    nome: "", email: "", telefone: "", tipo: "family_office",
    setores: [], ufs: [], ticket_min: "", ticket_max: "",
    tipos_operacao: [], criterios: "", notas: "",
  };
  const [form, setForm] = useState<InvestorForm>(emptyForm);
  const f = (key: keyof InvestorForm, val: unknown) => setForm(p => ({ ...p, [key]: val }));

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ma/match-investors?deal_id=${dealId}`);
      const data = await res.json() as { matches?: InvestorMatch[] };
      setMatches(data.matches ?? []);
    } catch { setMatches([]); }
    finally { setLoading(false); }
  }, [dealId]);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const handleSave = async () => {
    if (!form.nome.trim()) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/ma/investor-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ticket_min: form.ticket_min ? Number(form.ticket_min) : undefined,
          ticket_max: form.ticket_max ? Number(form.ticket_max) : undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setSaveOk(true);
      setShowForm(false);
      setForm(emptyForm);
      await loadMatches();
      setTimeout(() => setSaveOk(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <Card className="border-[#243A66]">
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C] flex items-center gap-2">
              <Target className="w-3.5 h-3.5" />
              Investidores Compatíveis — {dealCode}
            </CardTitle>
            <div className="flex items-center gap-2">
              {saveOk && <span className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" />Salvo</span>}
              <Button size="sm" variant="outline"
                className="border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 h-7 text-xs"
                onClick={() => { setShowForm(!showForm); setError(null); }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Cadastrar Investidor
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-[#7A8FA8] hover:text-[#E8EDF5]"
                onClick={loadMatches} disabled={loading}
              >
                {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Atualizar"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <p className="text-xs text-muted-foreground">
            {loading ? "Buscando matches..." :
              matches.length === 0
                ? "Nenhum investidor compatível cadastrado. Adicione perfis de investidores para ver o cruzamento."
                : `${matches.length} investidor${matches.length > 1 ? "es" : ""} com critérios compatíveis com este deal.`
            }
          </p>
        </CardContent>
      </Card>

      {/* Formulário de cadastro */}
      {showForm && (
        <Card className="border-[#C9A84C]/20 bg-gradient-to-br from-[#162744] to-[#111F35]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C] flex items-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Novo Perfil de Investidor
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-3">
            {/* Nome + Tipo */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">
                  Nome <span className="text-red-400">*</span>
                </label>
                <input value={form.nome} onChange={e => f("nome", e.target.value)}
                  placeholder="Nome ou razão social"
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-xs px-3 py-2 focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Tipo</label>
                <select value={form.tipo} onChange={e => f("tipo", e.target.value)}
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-xs px-3 py-2 focus:outline-none focus:border-[#C9A84C]">
                  {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                </select>
              </div>
            </div>

            {/* Email + Telefone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Email</label>
                <input value={form.email} onChange={e => f("email", e.target.value)} type="email" placeholder="email@dominio.com"
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-xs px-3 py-2 focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Telefone</label>
                <input value={form.telefone} onChange={e => f("telefone", e.target.value)} placeholder="(11) 99999-9999"
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-xs px-3 py-2 focus:outline-none focus:border-[#C9A84C]" />
              </div>
            </div>

            {/* Setores de interesse */}
            <MultiSelect options={SETORES_OPTS} value={form.setores} label="Setores de Interesse"
              onChange={v => f("setores", v)} />

            {/* Estados de interesse */}
            <MultiSelect options={UFS_OPTS} value={form.ufs} label="Estados / UFs de Interesse"
              onChange={v => f("ufs", v)} />

            {/* Ticket */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Ticket Mínimo (R$)</label>
                <input value={form.ticket_min} onChange={e => f("ticket_min", e.target.value)} type="number" placeholder="Ex: 5000000"
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-xs px-3 py-2 focus:outline-none focus:border-[#C9A84C]" />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Ticket Máximo (R$)</label>
                <input value={form.ticket_max} onChange={e => f("ticket_max", e.target.value)} type="number" placeholder="Ex: 500000000"
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-xs px-3 py-2 focus:outline-none focus:border-[#C9A84C]" />
              </div>
            </div>

            {/* Tipos de operação */}
            <MultiSelect options={TIPOS_OP} value={form.tipos_operacao} label="Tipos de Operação de Interesse"
              onChange={v => f("tipos_operacao", v)} />

            {/* Critérios livres */}
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Critérios de Investimento</label>
              <textarea rows={2} value={form.criterios} onChange={e => f("criterios", e.target.value)}
                placeholder="Descreva os critérios específicos deste investidor..."
                className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-xs px-3 py-2 focus:outline-none focus:border-[#C9A84C] resize-none" />
            </div>

            {error && <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="text-[#7A8FA8]">
                <X className="w-3 h-3 mr-1" />Cancelar
              </Button>
              <Button size="sm" disabled={saving || !form.nome.trim()} onClick={handleSave}
                className="bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] font-bold flex-1">
                {saving ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Salvando...</> : <><Check className="w-3 h-3 mr-1" />Salvar Investidor</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de matches */}
      {matches.length > 0 && (
        <div className="space-y-2">
          {matches.map(m => (
            <Card key={m.investor_id}
              className={`border transition-all cursor-pointer ${
                expanded === m.investor_id ? "border-[#C9A84C]/30" : "border-[#243A66] hover:border-[#243A66]/80"
              }`}
              onClick={() => setExpanded(expanded === m.investor_id ? null : m.investor_id)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  {/* Score badge */}
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${scoreColor(m.match_score)}20`, border: `1px solid ${scoreColor(m.match_score)}40` }}
                  >
                    <span className="text-sm font-bold" style={{ color: scoreColor(m.match_score) }}>{m.match_score}</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-[#F0ECE4] truncate">{m.nome}</p>
                      <Badge className="text-[9px] px-1.5 py-0 bg-[#162744] text-[#7A8FA8] border-[#243A66]">
                        {TIPO_LABELS[m.tipo] ?? m.tipo}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {m.match_reasons.map((r, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ✓ {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Ticket range */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-[9px] text-[#7A8FA8] uppercase tracking-wide">Ticket</p>
                    <p className="text-xs font-semibold text-[#E8EDF5]">
                      {m.ticket_min || m.ticket_max
                        ? `${formatM(m.ticket_min)} – ${formatM(m.ticket_max)}`
                        : "—"}
                    </p>
                  </div>

                  {expanded === m.investor_id
                    ? <ChevronUp className="w-3.5 h-3.5 text-[#7A8FA8] flex-shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 text-[#7A8FA8] flex-shrink-0" />
                  }
                </div>

                {/* Expandido */}
                {expanded === m.investor_id && (
                  <div className="mt-3 pt-3 border-t border-[#243A66] space-y-2">
                    <div className="grid grid-cols-2 gap-3">
                      {m.email && (
                        <a href={`mailto:${m.email}`} className="flex items-center gap-1.5 text-xs text-[#C9A84C] hover:underline">
                          <Mail className="w-3 h-3" />{m.email}
                        </a>
                      )}
                      {m.telefone && (
                        <span className="flex items-center gap-1.5 text-xs text-[#7A8FA8]">
                          <Phone className="w-3 h-3" />{m.telefone}
                        </span>
                      )}
                    </div>
                    {m.setores.length > 0 && (
                      <div>
                        <p className="text-[9px] text-[#7A8FA8] uppercase tracking-wide mb-1">Setores</p>
                        <div className="flex flex-wrap gap-1">
                          {m.setores.map(s => (
                            <span key={s} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#162744] text-[#7A8FA8] border border-[#243A66]">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.ufs.length > 0 && (
                      <div>
                        <p className="text-[9px] text-[#7A8FA8] uppercase tracking-wide mb-1">Regiões</p>
                        <div className="flex flex-wrap gap-1">
                          {m.ufs.map(u => (
                            <span key={u} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#162744] text-[#C9A84C] border border-[#C9A84C]/30">{u}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.criterios && (
                      <p className="text-xs text-[#7A8FA8] leading-relaxed border-l-2 border-[#243A66] pl-2">{m.criterios}</p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Building2 className="w-3 h-3 text-[#7A8FA8]" />
                      <span className="text-[10px] text-[#7A8FA8]">Score de compatibilidade: </span>
                      <span className="text-[10px] font-bold" style={{ color: scoreColor(m.match_score) }}>
                        {m.match_score}/100
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
