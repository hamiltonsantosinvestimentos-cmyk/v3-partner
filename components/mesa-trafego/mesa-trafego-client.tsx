"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Campanha = {
  id: string; // meta_campaign_id
  name: string;
  objective: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
};

type Insight = { impressions?: string; clicks?: string; spend?: string; ctr?: string; cpc?: string; reach?: string };

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_AWARENESS: "Reconhecimento de marca",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_LEADS: "Geração de Leads",
  OUTCOME_SALES: "Vendas",
  OUTCOME_APP_PROMOTION: "Promoção de App",
};

const STATUS_CFG: Record<string, { label: string; text: string; bg: string; border: string }> = {
  ACTIVE: { label: "Ativa", text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
  PAUSED: { label: "Pausada", text: "text-[#C9A84C]", bg: "bg-[#C9A84C]/10", border: "border-[#C9A84C]/30" },
  DELETED: { label: "Excluída", text: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/30" },
  ARCHIVED: { label: "Arquivada", text: "text-[#7A8FA8]", bg: "bg-[#7A8FA8]/10", border: "border-[#7A8FA8]/30" },
};

function centavosToBRL(centavos?: number | string | null): string {
  if (centavos === undefined || centavos === null) return "—";
  const n = typeof centavos === "string" ? Number(centavos) : centavos;
  return (n / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function brlInputToCentavos(v: string): number {
  const n = Number(v.replace(",", "."));
  return Math.round((isNaN(n) ? 0 : n) * 100);
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function MesaTrafegoClient({ currentUserName }: { currentUserName: string }) {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [showNova, setShowNova] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoObjetivo, setNovoObjetivo] = useState("OUTCOME_TRAFFIC");
  const [criando, setCriando] = useState(false);
  const [criarErro, setCriarErro] = useState<string | null>(null);

  const [insights, setInsights] = useState<Insight | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const selected = campanhas.find((c) => c.id === selectedId) ?? null;

  const loadCampanhas = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/trafego/campanhas").then((r) => r.json());
      if (res.error) { setLoadError(res.error); setCampanhas([]); return; }
      setCampanhas(res.campanhas ?? []);
    } catch {
      setLoadError("Erro de conexão com a Meta Ads API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCampanhas(); }, [loadCampanhas]);

  useEffect(() => {
    if (!selectedId) { setInsights(null); return; }
    setInsightsLoading(true);
    fetch(`/api/trafego/campanhas/${selectedId}/insights`)
      .then((r) => r.json())
      .then((d) => setInsights(d.insights?.[0] ?? null))
      .catch(() => setInsights(null))
      .finally(() => setInsightsLoading(false));
  }, [selectedId]);

  async function handleCriar() {
    if (!novoNome.trim()) return;
    setCriando(true);
    setCriarErro(null);
    try {
      const res = await fetch("/api/trafego/campanhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: novoNome.trim(), objective: novoObjetivo }),
      }).then((r) => r.json());
      if (res.error) { setCriarErro(res.error); return; }
      setShowNova(false);
      setNovoNome("");
      await loadCampanhas();
      if (res.campanha?.meta_campaign_id) setSelectedId(res.campanha.meta_campaign_id);
    } catch {
      setCriarErro("Erro de conexão.");
    } finally {
      setCriando(false);
    }
  }

  async function toggleStatus(campanha: Campanha) {
    const novoStatus = campanha.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setCampanhas((prev) => prev.map((c) => (c.id === campanha.id ? { ...c, status: novoStatus } : c)));
    await fetch(`/api/trafego/campanhas/${campanha.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novoStatus }),
    }).catch(() => {});
  }

  async function salvarOrcamento(campanha: Campanha, valorReais: string) {
    const centavos = brlInputToCentavos(valorReais);
    if (centavos <= 0) return;
    await fetch(`/api/trafego/campanhas/${campanha.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_budget_centavos: centavos }),
    }).catch(() => {});
    await loadCampanhas();
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#09081A] border-b border-[#243A66] shrink-0">
        <div>
          <p className="text-[#C9A84C] text-[10px] font-bold tracking-[2px] uppercase">Mesa de Tráfego</p>
          <h1 className="text-[#F0ECE4] text-xl font-bold leading-tight">Meta Ads — Campanhas</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#7A8FA8] text-xs">{currentUserName}</span>
          <button
            onClick={() => setShowNova(true)}
            className="bg-[#C9A84C] text-[#09081A] rounded-lg px-4 py-2 text-xs font-bold"
          >
            + Nova Campanha
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mx-6 mt-4 bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-3 text-red-400 text-xs">
          ⚠️ {loadError}
          {loadError.includes("META_ADS") && (
            <p className="mt-1 text-[#7A8FA8]">Configure META_ADS_ACCESS_TOKEN e META_ADS_ACCOUNT_ID no .env.local.</p>
          )}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Lista de campanhas ── */}
        <div className="w-96 shrink-0 border-r border-[#243A66] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-[#7A8FA8] text-xs">Carregando...</div>
            ) : campanhas.length === 0 && !loadError ? (
              <div className="p-6 text-center text-[#7A8FA8] text-xs">Nenhuma campanha ainda. Crie a primeira.</div>
            ) : (
              campanhas.map((c) => {
                const st = STATUS_CFG[c.status] ?? STATUS_CFG.ARCHIVED;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`px-4 py-3.5 cursor-pointer border-b border-[#162744] ${selectedId === c.id ? "bg-[#162744] border-l-[3px] border-l-[#C9A84C]" : "border-l-[3px] border-l-transparent hover:bg-[#162744]/50"}`}
                  >
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <span className="text-[#F0ECE4] font-semibold text-[13px] leading-tight">{c.name}</span>
                      <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${st.bg} ${st.text} ${st.border}`}>
                        {st.label}
                      </span>
                    </div>
                    <div className="text-[#7A8FA8] text-[11px]">{OBJECTIVE_LABELS[c.objective] ?? c.objective}</div>
                    <div className="text-[#7A8FA8] text-[11px] mt-0.5">Orçamento: {centavosToBRL(c.daily_budget)}/dia</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Detalhe ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <div className="text-[#7A8FA8] text-sm text-center mt-16">Selecione uma campanha à esquerda.</div>
          ) : (
            <div className="max-w-2xl flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[#F0ECE4] text-lg font-bold">{selected.name}</h2>
                  <p className="text-[#7A8FA8] text-xs mt-0.5">{OBJECTIVE_LABELS[selected.objective] ?? selected.objective}</p>
                </div>
                <button
                  onClick={() => toggleStatus(selected)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold border ${selected.status === "ACTIVE" ? "bg-amber-400/10 border-amber-400 text-amber-400" : "bg-emerald-400/10 border-emerald-400 text-emerald-400"}`}
                >
                  {selected.status === "ACTIVE" ? "⏸ Pausar" : "▶ Ativar"}
                </button>
              </div>

              {/* Métricas */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#111F35] border border-[#243A66] rounded-xl px-4 py-3">
                  <p className="text-[#7A8FA8] text-[10px] uppercase font-bold tracking-wide">Impressões</p>
                  <p className="text-[#F0ECE4] text-lg font-bold mt-1">{insightsLoading ? "…" : (insights?.impressions ?? "0")}</p>
                </div>
                <div className="bg-[#111F35] border border-[#243A66] rounded-xl px-4 py-3">
                  <p className="text-[#7A8FA8] text-[10px] uppercase font-bold tracking-wide">Cliques</p>
                  <p className="text-[#F0ECE4] text-lg font-bold mt-1">{insightsLoading ? "…" : (insights?.clicks ?? "0")}</p>
                </div>
                <div className="bg-[#111F35] border border-[#243A66] rounded-xl px-4 py-3">
                  <p className="text-[#7A8FA8] text-[10px] uppercase font-bold tracking-wide">Gasto</p>
                  <p className="text-[#F0ECE4] text-lg font-bold mt-1">{insightsLoading ? "…" : `R$ ${insights?.spend ?? "0"}`}</p>
                </div>
                <div className="bg-[#111F35] border border-[#243A66] rounded-xl px-4 py-3">
                  <p className="text-[#7A8FA8] text-[10px] uppercase font-bold tracking-wide">CTR</p>
                  <p className="text-[#F0ECE4] text-lg font-bold mt-1">{insightsLoading ? "…" : `${insights?.ctr ?? "0"}%`}</p>
                </div>
                <div className="bg-[#111F35] border border-[#243A66] rounded-xl px-4 py-3">
                  <p className="text-[#7A8FA8] text-[10px] uppercase font-bold tracking-wide">CPC</p>
                  <p className="text-[#F0ECE4] text-lg font-bold mt-1">{insightsLoading ? "…" : `R$ ${insights?.cpc ?? "0"}`}</p>
                </div>
                <div className="bg-[#111F35] border border-[#243A66] rounded-xl px-4 py-3">
                  <p className="text-[#7A8FA8] text-[10px] uppercase font-bold tracking-wide">Alcance</p>
                  <p className="text-[#F0ECE4] text-lg font-bold mt-1">{insightsLoading ? "…" : (insights?.reach ?? "0")}</p>
                </div>
              </div>

              {/* Orçamento */}
              <div>
                <label className="block text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-1.5">
                  Orçamento diário
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={selected.daily_budget ? (Number(selected.daily_budget) / 100).toFixed(2) : ""}
                    onBlur={(e) => salvarOrcamento(selected, e.target.value)}
                    placeholder="0,00"
                    className="w-40 bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-[#F0ECE4] text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                  />
                  <span className="text-[#7A8FA8] text-xs self-center">BRL/dia — salva ao sair do campo</span>
                </div>
              </div>

              <p className="text-[#7A8FA8] text-[11px]">
                Campanha criada em modo <strong className="text-[#F0ECE4]">rascunho/pausada</strong> por padrão.
                Conjuntos de anúncios e criativos ainda precisam ser configurados direto na Graph API
                (endpoints já disponíveis em <code className="text-[#C9A84C]">/api/trafego/ad-sets</code> e{" "}
                <code className="text-[#C9A84C]">/api/trafego/ads</code>).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal nova campanha */}
      {showNova && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-24 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-[#243A66]">
              <h2 className="text-[#F0ECE4] font-bold text-sm">Nova Campanha</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-1.5">Nome</label>
                <input
                  autoFocus
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex: Recrutamento Partners — Ago/26"
                  className="w-full bg-[#162744] border border-[#243A66] rounded-lg px-3 py-2 text-[#F0ECE4] text-sm focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                />
              </div>
              <div>
                <label className="block text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-1.5">Objetivo</label>
                <select
                  value={novoObjetivo}
                  onChange={(e) => setNovoObjetivo(e.target.value)}
                  className="w-full bg-[#162744] border border-[#243A66] rounded-lg px-3 py-2 text-[#F0ECE4] text-sm focus:outline-none"
                >
                  {Object.entries(OBJECTIVE_LABELS).map(([v, label]) => (
                    <option key={v} value={v} className="bg-[#162744]">{label}</option>
                  ))}
                </select>
              </div>
              {criarErro && <p className="text-red-400 text-xs">{criarErro}</p>}
            </div>
            <div className="px-5 py-4 border-t border-[#243A66] flex justify-end gap-2">
              <button onClick={() => setShowNova(false)} className="bg-[#243A66] rounded-lg px-3.5 py-2 text-[#7A8FA8] text-xs">
                Cancelar
              </button>
              <button
                onClick={handleCriar}
                disabled={criando || !novoNome.trim()}
                className="bg-[#C9A84C] text-[#09081A] rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-40"
              >
                {criando ? "Criando..." : "Criar (pausada)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
