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

type AdSet = {
  id: string;
  name: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  optimization_goal?: string;
  destination_type?: string;
  created_time?: string;
};

type AdCreative = {
  id?: string;
  name?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  object_type?: string;
  call_to_action_type?: string;
  body?: string;
  title?: string;
  instagram_permalink_url?: string;
};

type Anuncio = {
  id: string;
  name: string;
  status: string;
  created_time?: string;
  creative?: AdCreative;
};

type Insight = { impressions?: string; clicks?: string; spend?: string; ctr?: string; cpc?: string; reach?: string };

type Resumo = { insights: Insight | null; total_campanhas: number; ativas: number; pausadas: number };

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_AWARENESS: "Reconhecimento de marca",
  OUTCOME_TRAFFIC: "Tráfego",
  OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_LEADS: "Geração de Leads",
  OUTCOME_SALES: "Vendas",
  OUTCOME_APP_PROMOTION: "Promoção de App",
};

const DATE_PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "last_7d", label: "Últimos 7 dias" },
  { value: "last_30d", label: "Últimos 30 dias" },
  { value: "lifetime", label: "Desde o início" },
];

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

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_CFG[status] ?? STATUS_CFG.ARCHIVED;
  return (
    <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${st.bg} ${st.text} ${st.border}`}>
      {st.label}
    </span>
  );
}

function destinoLabel(a: Anuncio): string {
  if (a.creative?.call_to_action_type === "WHATSAPP_MESSAGE") return "→ WhatsApp";
  if (a.creative?.instagram_permalink_url) return "→ Post do Instagram";
  return "→ Link";
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function MesaTrafegoClient({ currentUserName }: { currentUserName: string }) {
  const [datePreset, setDatePreset] = useState("last_7d");

  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [resumoLoading, setResumoLoading] = useState(true);

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

  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [adSetsLoading, setAdSetsLoading] = useState(false);
  const [adSetsError, setAdSetsError] = useState<string | null>(null);
  const [expandedAdSetId, setExpandedAdSetId] = useState<string | null>(null);
  const [adsByAdSet, setAdsByAdSet] = useState<Record<string, Anuncio[]>>({});
  const [adsLoadingId, setAdsLoadingId] = useState<string | null>(null);
  const [adInsights, setAdInsights] = useState<Record<string, Insight>>({});

  const selected = campanhas.find((c) => c.id === selectedId) ?? null;

  const loadResumo = useCallback(async (preset: string) => {
    setResumoLoading(true);
    try {
      const res = await fetch(`/api/trafego/resumo?date_preset=${preset}`).then((r) => r.json());
      setResumo(res.error ? null : res);
    } catch {
      setResumo(null);
    } finally {
      setResumoLoading(false);
    }
  }, []);

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
  useEffect(() => { loadResumo(datePreset); }, [datePreset, loadResumo]);

  useEffect(() => {
    if (!selectedId) { setInsights(null); setAdSets([]); setExpandedAdSetId(null); return; }
    setInsightsLoading(true);
    fetch(`/api/trafego/campanhas/${selectedId}/insights?date_preset=${datePreset}`)
      .then((r) => r.json())
      .then((d) => setInsights(d.insights?.[0] ?? null))
      .catch(() => setInsights(null))
      .finally(() => setInsightsLoading(false));

    setAdSetsLoading(true);
    setAdSetsError(null);
    setExpandedAdSetId(null);
    fetch(`/api/trafego/ad-sets?campaign_id=${selectedId}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) { setAdSetsError(d.error); setAdSets([]); } else { setAdSets(d.ad_sets ?? []); } })
      .catch(() => setAdSetsError("Erro ao carregar conjuntos de anúncios."))
      .finally(() => setAdSetsLoading(false));
  }, [selectedId, datePreset]);

  async function toggleAdSet(adSetId: string) {
    if (expandedAdSetId === adSetId) { setExpandedAdSetId(null); return; }
    setExpandedAdSetId(adSetId);
    if (adsByAdSet[adSetId]) return; // já carregado

    setAdsLoadingId(adSetId);
    try {
      const res = await fetch(`/api/trafego/ads?ad_set_id=${adSetId}`).then((r) => r.json());
      const ads: Anuncio[] = res.ads ?? [];
      setAdsByAdSet((prev) => ({ ...prev, [adSetId]: ads }));

      const results = await Promise.all(
        ads.map((a) => fetch(`/api/trafego/insights?object_id=${a.id}&date_preset=${datePreset}`).then((r) => r.json()).catch(() => null))
      );
      setAdInsights((prev) => {
        const next = { ...prev };
        ads.forEach((a, i) => { if (results[i]?.insights?.[0]) next[a.id] = results[i].insights[0]; });
        return next;
      });
    } finally {
      setAdsLoadingId(null);
    }
  }

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
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="bg-[#111F35] border border-[#243A66] rounded-lg px-2.5 py-1.5 text-[#F0ECE4] text-xs focus:outline-none"
          >
            {DATE_PRESETS.map((d) => (
              <option key={d.value} value={d.value} className="bg-[#111F35]">{d.label}</option>
            ))}
          </select>
          <span className="text-[#7A8FA8] text-xs">{currentUserName}</span>
          <button
            onClick={() => setShowNova(true)}
            className="bg-[#C9A84C] text-[#09081A] rounded-lg px-4 py-2 text-xs font-bold"
          >
            + Nova Campanha
          </button>
        </div>
      </div>

      {/* ── Resumo geral (visão da conta inteira) ── */}
      <div className="px-6 py-4 bg-[#09081A] border-b border-[#243A66] shrink-0">
        <div className="grid grid-cols-3 md:grid-cols-7 gap-3">
          {[
            { label: "Campanhas", value: resumoLoading ? "…" : String(resumo?.total_campanhas ?? 0) },
            { label: "Ativas", value: resumoLoading ? "…" : String(resumo?.ativas ?? 0), accent: true },
            { label: "Pausadas", value: resumoLoading ? "…" : String(resumo?.pausadas ?? 0) },
            { label: "Impressões", value: resumoLoading ? "…" : (resumo?.insights?.impressions ?? "0") },
            { label: "Cliques", value: resumoLoading ? "…" : (resumo?.insights?.clicks ?? "0") },
            { label: "Gasto", value: resumoLoading ? "…" : `R$ ${resumo?.insights?.spend ?? "0"}` },
            { label: "CTR", value: resumoLoading ? "…" : `${resumo?.insights?.ctr ?? "0"}%` },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-[#111F35] border border-[#243A66] rounded-xl px-3.5 py-2.5">
              <p className="text-[#7A8FA8] text-[9px] uppercase font-bold tracking-wide">{kpi.label}</p>
              <p className={`text-base font-bold mt-0.5 ${kpi.accent ? "text-emerald-400" : "text-[#F0ECE4]"}`}>{kpi.value}</p>
            </div>
          ))}
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
              campanhas.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`px-4 py-3.5 cursor-pointer border-b border-[#162744] ${selectedId === c.id ? "bg-[#162744] border-l-[3px] border-l-[#C9A84C]" : "border-l-[3px] border-l-transparent hover:bg-[#162744]/50"}`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1.5">
                    <span className="text-[#F0ECE4] font-semibold text-[13px] leading-tight">{c.name}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-[#7A8FA8] text-[11px]">{OBJECTIVE_LABELS[c.objective] ?? c.objective}</div>
                  <div className="text-[#7A8FA8] text-[11px] mt-0.5">Orçamento: {centavosToBRL(c.daily_budget)}/dia</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Detalhe ── */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <div className="text-[#7A8FA8] text-sm text-center mt-16">Selecione uma campanha à esquerda.</div>
          ) : (
            <div className="max-w-3xl flex flex-col gap-5">
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

              {/* Métricas da campanha */}
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

              {/* ── Conjuntos de anúncios ── */}
              <div>
                <p className="text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-2">
                  Conjuntos de anúncios ({adSets.length})
                </p>
                {adSetsLoading ? (
                  <p className="text-[#7A8FA8] text-xs">Carregando...</p>
                ) : adSetsError ? (
                  <p className="text-red-400 text-xs">⚠️ {adSetsError}</p>
                ) : adSets.length === 0 ? (
                  <p className="text-[#7A8FA8] text-xs">Nenhum conjunto de anúncios ainda nessa campanha.</p>
                ) : (
                  <div className="space-y-2">
                    {adSets.map((as) => {
                      const ads = adsByAdSet[as.id];
                      const expanded = expandedAdSetId === as.id;
                      return (
                        <div key={as.id} className="bg-[#111F35] border border-[#243A66] rounded-xl overflow-hidden">
                          <button
                            onClick={() => toggleAdSet(as.id)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#162744]/50"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[#F0ECE4] text-[13px] font-semibold truncate">{as.name}</span>
                                <StatusBadge status={as.status} />
                                {as.destination_type === "WHATSAPP" && (
                                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-1.5 py-0.5 rounded uppercase">WhatsApp</span>
                                )}
                              </div>
                              <p className="text-[#7A8FA8] text-[11px] mt-0.5">
                                {centavosToBRL(as.daily_budget)}/dia · {as.optimization_goal ?? "—"}
                              </p>
                            </div>
                            <span className="text-[#7A8FA8] text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
                          </button>

                          {expanded && (
                            <div className="border-t border-[#243A66] px-4 py-3 space-y-2 bg-[#0D1929]">
                              {adsLoadingId === as.id ? (
                                <p className="text-[#7A8FA8] text-xs">Carregando anúncios...</p>
                              ) : !ads || ads.length === 0 ? (
                                <p className="text-[#7A8FA8] text-xs">Nenhum anúncio nesse conjunto ainda.</p>
                              ) : (
                                ads.map((ad) => {
                                  const ins = adInsights[ad.id];
                                  const thumb = ad.creative?.thumbnail_url ?? ad.creative?.image_url;
                                  return (
                                    <div key={ad.id} className="flex gap-3 bg-[#111F35] border border-[#243A66] rounded-lg p-3">
                                      {thumb ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={thumb} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-[#243A66]" />
                                      ) : (
                                        <div className="w-16 h-16 rounded-lg bg-[#162744] shrink-0 flex items-center justify-center text-[#7A8FA8] text-[10px]">sem prévia</div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-[#F0ECE4] text-[12px] font-semibold truncate">{ad.name}</span>
                                          <StatusBadge status={ad.status} />
                                          <span className="text-[9px] font-bold text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-1.5 py-0.5 rounded">
                                            {destinoLabel(ad)}
                                          </span>
                                        </div>
                                        {ad.creative?.body && (
                                          <p className="text-[#7A8FA8] text-[11px] mt-1 line-clamp-2">{ad.creative.body}</p>
                                        )}
                                        <div className="flex gap-3 mt-1.5 text-[10px] text-[#7A8FA8]">
                                          <span>Impr.: <strong className="text-[#F0ECE4]">{ins?.impressions ?? "—"}</strong></span>
                                          <span>Cliques: <strong className="text-[#F0ECE4]">{ins?.clicks ?? "—"}</strong></span>
                                          <span>Gasto: <strong className="text-[#F0ECE4]">R$ {ins?.spend ?? "0"}</strong></span>
                                          <span>CTR: <strong className="text-[#F0ECE4]">{ins?.ctr ?? "—"}%</strong></span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="text-[#7A8FA8] text-[11px]">
                Conjuntos e anúncios criados fora da plataforma (Ads Manager, scripts) também
                aparecem aqui — a lista vem sempre direto da Meta.
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
