"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Save, RefreshCw, ChevronDown, ChevronUp, Settings2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface RegraDB {
  id: string;
  nome: string;
  nivel: string;
  categoria: string;
  descricao: string;
  cor: string;
  emoji: string;
  tipo_pessoa: string;
  requer_imovel: boolean;
  bloqueia_restricao: boolean;
  valor_minimo: number;
  valor_maximo: number | null;
  ltv_maximo: number;
  min_renda_mensal: number;
  min_faturamento_mensal: number;
  score_base: number;
  keywords_finalidade: string[];
  observacoes_internas: string;
}

interface EditorRegrasLinhasProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const NIVEL_LABELS: Record<string, string> = {
  NIVEL_1: "Nível 1 — Varejo",
  NIVEL_2: "Nível 2 — Estruturado",
  NIVEL_3: "Nível 3 — High Ticket",
};

const NIVEL_COLORS: Record<string, string> = {
  NIVEL_1: "#06B6D4",
  NIVEL_2: "#F59E0B",
  NIVEL_3: "#A855F7",
};

function NumField({ label, value, onChange, prefix, suffix, min, max, step }: {
  label: string; value: number | null; onChange: (v: number | null) => void;
  prefix?: string; suffix?: string; min?: number; max?: number; step?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-1 bg-[#111F35] border border-[#243A66] rounded-lg px-2 py-1.5">
        {prefix && <span className="text-[11px] text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          className="flex-1 bg-transparent text-[12px] text-white outline-none min-w-0"
          value={value ?? ""}
          min={min}
          max={max}
          step={step ?? 1}
          onChange={e => {
            const v = e.target.value === "" ? null : parseFloat(e.target.value);
            onChange(v);
          }}
        />
        {suffix && <span className="text-[11px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function RegraEditor({ regra, onSave, saving }: {
  regra: RegraDB;
  onSave: (id: string, fields: Partial<RegraDB>) => Promise<void>;
  saving: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Partial<RegraDB>>({});
  const [saved, setSaved] = useState(false);

  const merged = { ...regra, ...draft };
  const hasChanges = Object.keys(draft).length > 0;

  function set<K extends keyof RegraDB>(key: K, val: RegraDB[K]) {
    setDraft(d => ({ ...d, [key]: val }));
    setSaved(false);
  }

  async function handleSave() {
    if (!hasChanges) return;
    await onSave(regra.id, draft);
    setDraft({});
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="border border-[#243A66] rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-3 hover:bg-[#162744]/60 transition-colors text-left"
      >
        <span className="text-lg flex-shrink-0">{regra.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-white truncate">{regra.nome}</p>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: `${NIVEL_COLORS[regra.nivel]}20`, color: NIVEL_COLORS[regra.nivel] }}>
              {NIVEL_LABELS[regra.nivel] ?? regra.nivel}
            </span>
            {hasChanges && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex-shrink-0">
                Editado
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">{regra.categoria}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] font-black" style={{ color: regra.cor }}>{regra.score_base}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[#243A66]">
          {/* Descrição */}
          <div className="flex flex-col gap-1 pt-3">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Descrição</label>
            <textarea
              className="bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-[12px] text-white outline-none resize-none"
              rows={2}
              value={merged.descricao ?? ""}
              onChange={e => set("descricao", e.target.value)}
            />
          </div>

          {/* Score base + Tipo pessoa */}
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Score Base (0–100)" value={merged.score_base ?? 0} min={0} max={100}
              onChange={v => set("score_base", v ?? 0)} />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo Pessoa</label>
              <select
                className="bg-[#111F35] border border-[#243A66] rounded-lg px-2 py-1.5 text-[12px] text-white outline-none"
                value={merged.tipo_pessoa ?? "AMBOS"}
                onChange={e => set("tipo_pessoa", e.target.value)}
              >
                <option value="PF">PF</option>
                <option value="PJ">PJ</option>
                <option value="AMBOS">Ambos</option>
              </select>
            </div>
          </div>

          {/* Valor mínimo / máximo */}
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Valor Mínimo" value={merged.valor_minimo ?? 0} prefix="R$" step={1000} min={0}
              onChange={v => set("valor_minimo", v ?? 0)} />
            <NumField label="Valor Máximo (0 = sem limite)" value={merged.valor_maximo ?? 0} prefix="R$" step={100000} min={0}
              onChange={v => set("valor_maximo", v === 0 ? null : v)} />
          </div>

          {/* LTV + Faturamento mín */}
          <div className="grid grid-cols-2 gap-3">
            <NumField label="LTV Máximo" value={merged.ltv_maximo ?? 1} step={0.05} min={0} max={1} suffix="(ex: 0.6)"
              onChange={v => set("ltv_maximo", v ?? 1)} />
            <NumField label="Fat. Mínimo/mês" value={merged.min_faturamento_mensal ?? 0} prefix="R$" step={10000} min={0}
              onChange={v => set("min_faturamento_mensal", v ?? 0)} />
          </div>

          {/* Keywords finalidade */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Keywords Finalidade <span className="normal-case font-normal">(separadas por vírgula)</span>
            </label>
            <input
              type="text"
              className="bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-[12px] text-white outline-none"
              value={(merged.keywords_finalidade ?? []).join(", ")}
              onChange={e => set("keywords_finalidade", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
            />
            <p className="text-[10px] text-muted-foreground/60">
              Palavras-chave usadas para detectar finalidade compatível. Ex: imovel, casa, residencial
            </p>
          </div>

          {/* Observações internas */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Observações Internas</label>
            <textarea
              className="bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-[12px] text-white outline-none resize-none"
              rows={2}
              placeholder="Notas visíveis apenas para a mesa de crédito…"
              value={merged.observacoes_internas ?? ""}
              onChange={e => set("observacoes_internas", e.target.value)}
            />
          </div>

          {/* Toggles */}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => set("requer_imovel", !merged.requer_imovel)}
                className={`w-8 h-4 rounded-full transition-colors ${merged.requer_imovel ? "bg-[#C9A84C]" : "bg-[#243A66]"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${merged.requer_imovel ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <span className="text-[11px] text-muted-foreground">Requer Imóvel</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => set("bloqueia_restricao", !merged.bloqueia_restricao)}
                className={`w-8 h-4 rounded-full transition-colors ${merged.bloqueia_restricao ? "bg-red-500" : "bg-[#243A66]"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${merged.bloqueia_restricao ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <span className="text-[11px] text-muted-foreground">Bloqueia Restrição</span>
            </label>
          </div>

          {/* Summary */}
          {hasChanges && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-[10px] text-amber-400">
                {Object.keys(draft).length} campo(s) alterado(s). Clique em Salvar para persistir.
              </p>
            </div>
          )}

          {/* Save button */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || saving === regra.id}
              className="gap-1.5 text-xs"
            >
              {saving === regra.id ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</>
              ) : saved ? (
                <><CheckCircle2 className="w-3 h-3 text-emerald-400" /> Salvo!</>
              ) : (
                <><Save className="w-3 h-3" /> Salvar Alterações</>
              )}
            </Button>
            {hasChanges && (
              <button onClick={() => setDraft({})} className="text-[11px] text-muted-foreground hover:text-white transition-colors">
                Descartar
              </button>
            )}
          </div>

          {/* Observações internas display */}
          {!hasChanges && regra.observacoes_internas && (
            <div className="p-2.5 rounded-lg bg-[#111F35] border border-[#243A66]">
              <p className="text-[10px] text-muted-foreground/80 italic">{regra.observacoes_internas}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EditorRegrasLinhas({ open, onClose, onSaved }: EditorRegrasLinhasProps) {
  const [regras, setRegras] = useState<RegraDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const fetchRegras = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/regras-linhas");
      const { regras: data } = await res.json();
      setRegras(data ?? []);
    } catch {
      setError("Erro ao carregar regras.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchRegras();
  }, [open, fetchRegras]);

  const handleSave = useCallback(async (id: string, fields: Partial<RegraDB>) => {
    setSaving(id);
    setError(null);
    try {
      const fullRegra = regras.find(r => r.id === id) ?? {};
      const res = await fetch("/api/regras-linhas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fullRegra, id, ...fields }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar");
      setRegras(prev => prev.map(r => r.id === id ? { ...r, ...fields } : r));
      onSaved?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar regra.");
    } finally {
      setSaving(null);
    }
  }, [onSaved, regras]);

  async function handleSeed() {
    setSeeding(true);
    setSeedMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/regras-linhas", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao popular");
      setSeedMsg(`${json.seeded} linhas restauradas com os valores padrão.`);
      await fetchRegras();
      onSaved?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao popular regras.");
    } finally {
      setSeeding(false);
    }
  }

  if (!open) return null;

  const byNivel: Record<string, RegraDB[]> = {};
  for (const r of regras) {
    byNivel[r.nivel] = [...(byNivel[r.nivel] ?? []), r];
  }

  return (
    <div className="fixed inset-0 z-[200] flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-xl h-full bg-[#09081A] border-l border-[#243A66] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#243A66] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-[#C9A84C]" />
            <div>
              <p className="text-sm font-bold text-white">Editor de Regras de Crédito</p>
              <p className="text-[10px] text-muted-foreground">Configure os parâmetros de cada linha do portfólio V3 Partners</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#162744] text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions bar */}
        <div className="px-5 py-3 border-b border-[#243A66] flex items-center gap-3 flex-shrink-0">
          <button
            onClick={fetchRegras}
            disabled={loading}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <span className="text-[#243A66]">|</span>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-amber-400 transition-colors disabled:opacity-50"
          >
            {seeding ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Restaurar Padrões
          </button>
          {regras.length > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground/60">{regras.length} linhas carregadas</span>
          )}
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-2 flex-shrink-0">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-400">{error}</p>
          </div>
        )}
        {seedMsg && (
          <div className="mx-5 mt-3 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-400">{seedMsg}</p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" />
            </div>
          ) : regras.length === 0 ? (
            <div className="text-center py-12">
              <Settings2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Nenhuma regra encontrada na tabela.</p>
              <Button size="sm" onClick={handleSeed} disabled={seeding}>
                {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Popular com Valores Padrão
              </Button>
            </div>
          ) : (
            Object.entries(byNivel)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([nivel, linhas]) => (
                <div key={nivel} className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1 bg-[#243A66]" />
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                      style={{ color: NIVEL_COLORS[nivel], background: `${NIVEL_COLORS[nivel]}15` }}>
                      {NIVEL_LABELS[nivel] ?? nivel}
                    </span>
                    <div className="h-px flex-1 bg-[#243A66]" />
                  </div>
                  {linhas.map(r => (
                    <RegraEditor key={r.id} regra={r} onSave={handleSave} saving={saving} />
                  ))}
                </div>
              ))
          )}

          {/* Help */}
          {regras.length > 0 && (
            <div className="p-3 rounded-xl border border-[#243A66] bg-[#111F35]/60">
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                <strong className="text-muted-foreground">Score Base:</strong> Pontuação inicial da linha antes de fatores contextuais.<br/>
                <strong className="text-muted-foreground">Keywords:</strong> Palavras detectadas na finalidade para aumentar a pontuação.<br/>
                <strong className="text-muted-foreground">Restaurar Padrões:</strong> Recarrega todos os 11 valores originais do portfólio V3 Partners (não apaga customizações anteriores, faz upsert).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Re-export type for consumers
export type { RegraDB };
