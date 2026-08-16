"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

type FlowConfig = {
  agente_nome: string;
  empresa_contexto: string;
  regras_comunicacao: string;
};

type FlowStage = {
  id: string;
  ordem: number;
  titulo: string;
  objetivo: string;
  instrucoes: string;
  ativo: boolean;
};

const EMPTY_CONFIG: FlowConfig = { agente_nome: "Matheus", empresa_contexto: "", regras_comunicacao: "" };

// ─── Componente ─────────────────────────────────────────────────────────────

export function SdrFlowBuilderClient() {
  const [config, setConfig] = useState<FlowConfig>(EMPTY_CONFIG);
  const [stages, setStages] = useState<FlowStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrated, setMigrated] = useState(true);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingStage, setAddingStage] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sdr/automacao").then(r => r.json());
      setMigrated(res.migrated !== false);
      setConfig(res.config ?? EMPTY_CONFIG);
      setStages(res.stages ?? []);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load() só seta estado após o await do fetch
  useEffect(() => { load(); }, [load]);

  function flashSaved() {
    setSavedAt(Date.now());
    setTimeout(() => setSavedAt(prev => (prev ? null : prev)), 2000);
  }

  async function salvarConfig(patch: Partial<FlowConfig>) {
    setConfig(prev => ({ ...prev, ...patch }));
    await fetch("/api/sdr/automacao", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
    flashSaved();
  }

  async function salvarStage(id: string, patch: Partial<FlowStage>) {
    setStages(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
    await fetch("/api/sdr/automacao/stages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    }).catch(() => {});
    flashSaved();
  }

  async function criarStage() {
    if (!novoTitulo.trim()) return;
    const res = await fetch("/api/sdr/automacao/stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: novoTitulo.trim(), objetivo: "", instrucoes: "" }),
    }).then(r => r.json());
    setNovoTitulo("");
    setAddingStage(false);
    if (res.stage) {
      setStages(prev => [...prev, res.stage]);
      setExpandedId(res.stage.id);
    }
  }

  async function removerStage(id: string) {
    setStages(prev => prev.filter(s => s.id !== id));
    await fetch(`/api/sdr/automacao/stages?id=${id}`, { method: "DELETE" }).catch(() => {});
  }

  async function moverStage(id: string, direcao: -1 | 1) {
    const idx = stages.findIndex(s => s.id === id);
    const alvo = idx + direcao;
    if (idx === -1 || alvo < 0 || alvo >= stages.length) return;
    const reordenado = [...stages];
    [reordenado[idx], reordenado[alvo]] = [reordenado[alvo], reordenado[idx]];
    setStages(reordenado);
    await fetch("/api/sdr/automacao/stages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reorder: reordenado.map(s => s.id) }),
    }).catch(() => {});
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-[#7A8FA8] text-sm">Carregando fluxo...</div>;
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Painel do agente (persona + regras globais) ── */}
      <div className="w-[320px] shrink-0 border-r border-[#243A66] overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-[#C9A84C] text-[10px] font-bold tracking-[2px] uppercase mb-1">Persona do agente</p>
          <p className="text-[#7A8FA8] text-[11px] leading-relaxed">
            Essas configurações viram o roteiro que a IA segue em toda conversa no WhatsApp.
          </p>
        </div>

        {!migrated && (
          <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl px-3 py-2.5 text-amber-300 text-[11px] leading-relaxed">
            Migration do banco ainda não aplicada — o bot continua usando o roteiro padrão. Peça para rodar <code className="bg-black/30 px-1 rounded">supabase/migrations/20260816_sdr_flow_config.sql</code> no Supabase.
          </div>
        )}

        <div>
          <label className="block text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-1.5">
            Nome do agente
          </label>
          <input
            defaultValue={config.agente_nome}
            onBlur={e => salvarConfig({ agente_nome: e.target.value })}
            className="w-full bg-[#111F35] border border-[#243A66] rounded-lg px-2.5 py-2 text-[#F0ECE4] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
          />
        </div>

        <div>
          <label className="block text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-1.5">
            Contexto da empresa (tom + sobre a V3)
          </label>
          <textarea
            defaultValue={config.empresa_contexto}
            onBlur={e => salvarConfig({ empresa_contexto: e.target.value })}
            rows={10}
            className="w-full bg-[#111F35] border border-[#243A66] rounded-lg p-2.5 text-[#F0ECE4] text-[12px] leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
          />
        </div>

        <div>
          <label className="block text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-1.5">
            Regras de comunicação (uma por linha)
          </label>
          <textarea
            defaultValue={config.regras_comunicacao}
            onBlur={e => salvarConfig({ regras_comunicacao: e.target.value })}
            rows={10}
            className="w-full bg-[#111F35] border border-[#243A66] rounded-lg p-2.5 text-[#F0ECE4] text-[12px] leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
          />
        </div>
      </div>

      {/* ── Canvas do fluxo (etapas conectadas) ── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-6 max-w-xl">
          <div>
            <p className="text-[#C9A84C] text-[10px] font-bold tracking-[2px] uppercase mb-1">Fluxo da conversa</p>
            <h2 className="text-[#F0ECE4] text-lg font-bold">Etapas do Agente SDR</h2>
          </div>
          {savedAt && <span className="text-emerald-400 text-[11px] font-semibold">✓ Salvo</span>}
        </div>

        <div className="relative max-w-xl">
          {/* Nó inicial (gatilho) */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-full bg-emerald-400/10 border-2 border-emerald-400 flex items-center justify-center shrink-0 text-emerald-400">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
            </div>
            <div>
              <p className="text-[#F0ECE4] text-[13px] font-bold">Gatilho: mensagem recebida no WhatsApp</p>
              <p className="text-[#7A8FA8] text-[11px]">Dispara sempre que um lead escreve e não há atendimento humano ativo</p>
            </div>
          </div>

          {stages.map((stage, i) => (
            <div key={stage.id} className="relative pl-[17px]">
              <div className="absolute left-[17px] top-0 w-px bg-[#243A66]" style={{ height: 20 }} />

              <div className="flex items-start gap-3 mb-2 relative">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-[13px] border-2 ${stage.ativo ? "bg-[#C9A84C]/10 border-[#C9A84C] text-[#C9A84C]" : "bg-[#162744] border-[#243A66] text-[#7A8FA8]"}`}>
                  {i + 1}
                </div>

                <div className={`flex-1 rounded-xl border overflow-hidden ${expandedId === stage.id ? "border-[#C9A84C]/50" : "border-[#243A66]"} bg-[#111F35]`}>
                  <button
                    onClick={() => setExpandedId(expandedId === stage.id ? null : stage.id)}
                    className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left"
                  >
                    <div className="min-w-0">
                      <p className={`text-[13px] font-bold truncate ${stage.ativo ? "text-[#F0ECE4]" : "text-[#7A8FA8] line-through"}`}>{stage.titulo}</p>
                      {stage.objetivo && <p className="text-[#7A8FA8] text-[11px] truncate">{stage.objetivo}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={e => { e.stopPropagation(); moverStage(stage.id, -1); }}
                        className={`w-6 h-6 rounded flex items-center justify-center text-[#7A8FA8] hover:text-[#F0ECE4] hover:bg-[#243A66] ${i === 0 ? "opacity-30 pointer-events-none" : ""}`}
                        title="Mover para cima"
                      >
                        ↑
                      </span>
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={e => { e.stopPropagation(); moverStage(stage.id, 1); }}
                        className={`w-6 h-6 rounded flex items-center justify-center text-[#7A8FA8] hover:text-[#F0ECE4] hover:bg-[#243A66] ${i === stages.length - 1 ? "opacity-30 pointer-events-none" : ""}`}
                        title="Mover para baixo"
                      >
                        ↓
                      </span>
                      <span className="text-[#7A8FA8] text-xs ml-1">{expandedId === stage.id ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {expandedId === stage.id && (
                    <div className="border-t border-[#243A66] p-3.5 space-y-3">
                      <div>
                        <label className="block text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-1">Título</label>
                        <input
                          defaultValue={stage.titulo}
                          onBlur={e => salvarStage(stage.id, { titulo: e.target.value })}
                          className="w-full bg-[#0D1B2E] border border-[#243A66] rounded-lg px-2.5 py-1.5 text-[#F0ECE4] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-1">Objetivo (resumo exibido no card)</label>
                        <input
                          defaultValue={stage.objetivo}
                          onBlur={e => salvarStage(stage.id, { objetivo: e.target.value })}
                          className="w-full bg-[#0D1B2E] border border-[#243A66] rounded-lg px-2.5 py-1.5 text-[#F0ECE4] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-1">Instrução para a IA nesta etapa</label>
                        <textarea
                          defaultValue={stage.instrucoes}
                          onBlur={e => salvarStage(stage.id, { instrucoes: e.target.value })}
                          rows={3}
                          className="w-full bg-[#0D1B2E] border border-[#243A66] rounded-lg p-2.5 text-[#F0ECE4] text-[13px] leading-relaxed resize-y focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                        />
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <button
                          onClick={() => salvarStage(stage.id, { ativo: !stage.ativo })}
                          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${stage.ativo ? "bg-[#C9A84C]/10 border-[#C9A84C] text-[#C9A84C]" : "bg-[#0D1B2E] border-[#243A66] text-[#7A8FA8]"}`}
                        >
                          {stage.ativo ? "Ativa no fluxo" : "Desativada"}
                        </button>
                        <button
                          onClick={() => removerStage(stage.id)}
                          className="text-[11px] font-semibold text-red-400 hover:text-red-300 px-2.5 py-1"
                        >
                          Remover etapa
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Adicionar nova etapa */}
          <div className="relative pl-[17px]">
            <div className="absolute left-[17px] top-0 w-px bg-[#243A66]" style={{ height: 20 }} />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#162744] border-2 border-dashed border-[#243A66] flex items-center justify-center shrink-0 text-[#7A8FA8] text-lg leading-none">
                +
              </div>
              {addingStage ? (
                <div className="flex-1 flex gap-2">
                  <input
                    autoFocus
                    value={novoTitulo}
                    onChange={e => setNovoTitulo(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") criarStage(); if (e.key === "Escape") setAddingStage(false); }}
                    placeholder="Título da nova etapa"
                    className="flex-1 bg-[#111F35] border border-[#243A66] rounded-lg px-2.5 py-2 text-[#F0ECE4] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                  />
                  <button onClick={criarStage} disabled={!novoTitulo.trim()} className="bg-[#C9A84C] text-[#09081A] rounded-lg px-3.5 text-xs font-bold disabled:opacity-40">
                    Adicionar
                  </button>
                  <button onClick={() => setAddingStage(false)} className="text-[#7A8FA8] text-xs px-2">Cancelar</button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingStage(true)}
                  className="text-[#C9A84C] text-[13px] font-semibold border border-dashed border-[#C9A84C]/40 rounded-xl px-4 py-2.5 hover:bg-[#C9A84C]/5"
                >
                  Adicionar etapa
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
