"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3, Users, Gavel, DollarSign, Play,
  Loader2, AlertTriangle, CheckCircle2, Clock,
  ArrowRight, RefreshCw, Shield, Bot, Upload, Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AssetAssistant } from "./asset-assistant";

interface Listing {
  id: string;
  anonymous_id: string;
  asset_type: string;
  valor_face: number;
  desagio_pretendido: number | null;
  listing_status: string;
  risk_score: number | null;
  created_at: string;
  cm_bids: { count: number }[];
  cm_listing_documents: { count: number }[];
}

interface Match {
  id: string;
  score: number;
  match_reasons: any;
  investor_demands: { nome_contato: string; email: string; empresa: string | null } | null;
  cm_asset_listings: { anonymous_id: string; asset_type: string; valor_face: number } | null;
}

interface Bid {
  id: string;
  listing_id: string;
  bid_value: number;
  desagio_oferecido: number | null;
  status: string;
  payment_type: string;
  notes: string | null;
  created_at: string;
  cm_asset_listings: { anonymous_id: string; valor_face: number } | null;
}

const STATUS_COLUMNS = [
  { key: "reuniao_validada,formulario_preenchido", label: "Intake", color: "border-blue-500", icon: Clock },
  { key: "nda_assinado,em_analise", label: "NDA / Análise", color: "border-orange-500", icon: Shield },
  { key: "aprovado_head", label: "Aguarda Head", color: "border-[#C9A84C]", icon: Gavel },
  { key: "ativo_vitrine,proposta_recebida", label: "Na Vitrine", color: "border-emerald-500", icon: BarChart3 },
  { key: "em_escrow_due_diligence", label: "Escrow / DD", color: "border-purple-500", icon: DollarSign },
];

function formatBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

export function MesaCapitaisClient() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningMatch, setRunningMatch] = useState(false);
  const [tab, setTab] = useState<"kanban" | "matches" | "bids">("kanban");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assistantListing, setAssistantListing] = useState<{ id: string; anonymous_id: string } | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, matchRes, bidRes] = await Promise.all([
        fetch("/api/cm/listings"),
        fetch("/api/cm/matches"),
        fetch("/api/cm/bids?status=pendente"),
      ]);
      const [listJson, matchJson, bidJson] = await Promise.all([
        listRes.json(), matchRes.json(), bidRes.json(),
      ]);
      setListings(listJson.listings ?? []);
      setMatches(matchJson.matches ?? []);
      setBids(bidJson.bids ?? []);
    } catch (err) {
      console.error("[Mesa CM]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const runMatchmaking = async () => {
    setRunningMatch(true);
    try {
      const res = await fetch("/api/cm/matches/run", { method: "POST" });
      const json = await res.json();
      alert(json.message ?? `${json.matches_created} match(es) criado(s)`);
      fetchAll();
    } catch { alert("Erro ao executar matchmaking"); }
    finally { setRunningMatch(false); }
  };

  const handleUploadDoc = async (listingId: string, file: File) => {
    setUploadingDoc(listingId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const isAudio = /\.(mp3|ogg|wav|m4a|webm)$/i.test(file.name);
      formData.append("document_type", isAudio ? "AUDIO" : "OUTRO");
      const res = await fetch(`/api/cm/listings/${listingId}/documents`, { method: "POST", body: formData });
      const json = await res.json();
      if (res.ok) {
        alert(`${isAudio ? "Áudio" : "Documento"} enviado. ${isAudio ? "Transcrição em andamento via Whisper." : ""}`);
      } else {
        alert(json.error ?? "Erro no upload");
      }
    } catch { alert("Erro de conexão"); }
    finally { setUploadingDoc(null); }
  };

  const handleBidAction = async (bidId: string, action: string, commissionPercent = 7) => {
    setActionLoading(bidId);
    try {
      const res = await fetch(`/api/cm/bids/${bidId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, commission_percent: commissionPercent }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Erro"); return; }
      fetchAll();
    } catch { alert("Erro de conexão"); }
    finally { setActionLoading(null); }
  };

  const totalVolume = listings.reduce((s, l) => s + Number(l.valor_face), 0);
  const naVitrine = listings.filter((l) => ["ativo_vitrine", "proposta_recebida"].includes(l.listing_status)).length;
  const propostas = bids.length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-[#C9A84C]" size={32} />
    </div>
  );

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F1E8]">Mesa de Capitais</h1>
          <p className="text-sm text-[#9BAFC5]">Painel do Head de Ativos</p>
        </div>
        <button
          onClick={runMatchmaking} disabled={runningMatch}
          className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#D4B96A] transition disabled:opacity-50"
        >
          {runningMatch ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Executar Matchmaking
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total Ativos", value: listings.length, color: "text-[#F5F1E8]" },
          { label: "Na Vitrine", value: naVitrine, color: "text-[#C9A84C]" },
          { label: "Propostas", value: propostas, color: "text-orange-400" },
          { label: "Volume Pipeline", value: formatBRL(totalVolume), color: "text-emerald-400" },
          { label: "Matches", value: matches.length, color: "text-[#C9A84C]" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#12112A] rounded-lg p-4 text-center">
            <div className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</div>
            <div className="text-[9px] text-[#9BAFC5] uppercase mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#9BAFC5]/10">
        {(["kanban", "matches", "bids"] as const).map((t) => (
          <button
            key={t} onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition",
              tab === t ? "border-[#C9A84C] text-[#C9A84C]" : "border-transparent text-[#9BAFC5] hover:text-[#F5F1E8]"
            )}
          >
            {t === "kanban" ? "Pipeline" : t === "matches" ? `Matches (${matches.length})` : `Propostas (${bids.length})`}
          </button>
        ))}
      </div>

      {/* Kanban */}
      {tab === "kanban" && (
        <div className="grid grid-cols-5 gap-3">
          {STATUS_COLUMNS.map((col) => {
            const statuses = col.key.split(",");
            const items = listings.filter((l) => statuses.includes(l.listing_status));
            const Icon = col.icon;
            return (
              <div key={col.key}>
                <div className={cn("text-center text-[10px] font-bold uppercase text-[#9BAFC5] p-2 bg-[#12112A] rounded-t-lg border-b-2", col.color)}>
                  {col.label} ({items.length})
                </div>
                <div className="bg-[#09081A]/50 rounded-b-lg p-2 min-h-[200px] space-y-2">
                  {items.map((l) => (
                    <div key={l.id} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-md p-3">
                      <div className="text-[9px] text-[#C9A84C] font-bold">{l.anonymous_id}</div>
                      <div className="text-xs text-[#F5F1E8] font-semibold">{formatBRL(Number(l.valor_face))}</div>
                      {l.risk_score && (
                        <div className={cn("text-[9px] font-bold mt-1",
                          l.risk_score >= 70 ? "text-emerald-400" : l.risk_score >= 50 ? "text-[#C9A84C]" : "text-red-400"
                        )}>Score {l.risk_score}</div>
                      )}
                      {(l.cm_bids?.[0] as any)?.count > 0 && (
                        <div className="text-[9px] text-orange-400 mt-1">{(l.cm_bids[0] as any).count} proposta(s)</div>
                      )}
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={() => setAssistantListing({ id: l.id, anonymous_id: l.anonymous_id })}
                          title="Assistente do Ativo"
                          className="flex-1 flex items-center justify-center gap-1 px-1 py-1 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded text-[#C9A84C] text-[8px] font-bold hover:bg-[#C9A84C]/20 transition"
                        >
                          <Bot size={10} /> IA
                        </button>
                        <label
                          title="Upload doc ou áudio"
                          className="flex-1 flex items-center justify-center gap-1 px-1 py-1 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[8px] font-bold hover:bg-[#162744]/80 transition cursor-pointer"
                        >
                          {uploadingDoc === l.id ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                          Doc
                          <input type="file" className="hidden" accept=".pdf,.mp3,.ogg,.wav,.m4a,.webm,.jpg,.png"
                            onChange={(e) => { if (e.target.files?.[0]) handleUploadDoc(l.id, e.target.files[0]); }}
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Matches */}
      {tab === "matches" && (
        <div className="space-y-3">
          {matches.length === 0 ? (
            <div className="text-center py-12 text-[#9BAFC5]">Nenhum match encontrado. Execute o matchmaking.</div>
          ) : matches.map((m) => (
            <div key={m.id} className="bg-[#12112A] border border-[#C9A84C]/15 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className={cn("text-2xl font-bold",
                    m.score >= 70 ? "text-emerald-400" : m.score >= 50 ? "text-[#C9A84C]" : "text-red-400"
                  )}>{m.score}</div>
                  <div className="text-[9px] text-[#9BAFC5]">Score</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-[#C9A84C]">{m.cm_asset_listings?.anonymous_id ?? "—"}</div>
                  <div className="text-xs text-[#F5F1E8]">{formatBRL(Number(m.cm_asset_listings?.valor_face ?? 0))}</div>
                </div>
                <ArrowRight size={16} className="text-[#9BAFC5]" />
                <div>
                  <div className="text-xs font-bold text-[#F5F1E8]">{m.investor_demands?.nome_contato ?? "—"}</div>
                  <div className="text-[10px] text-[#9BAFC5]">{m.investor_demands?.empresa ?? m.investor_demands?.email ?? ""}</div>
                </div>
              </div>
              <div className="flex gap-1">
                {(m.match_reasons as any[])?.map((r: any, i: number) => (
                  <span key={i} className="text-[9px] bg-[#162744] text-[#9BAFC5] px-2 py-0.5 rounded">{r.criterio} +{r.peso}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bids */}
      {tab === "bids" && (
        <div className="space-y-3">
          {bids.length === 0 ? (
            <div className="text-center py-12 text-[#9BAFC5]">Nenhuma proposta pendente.</div>
          ) : bids.map((b) => (
            <div key={b.id} className="bg-[#12112A] border border-[#C9A84C]/15 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-[#C9A84C] font-bold">{(b.cm_asset_listings as any)?.anonymous_id ?? "—"}</div>
                  <div className="text-sm font-bold text-[#F5F1E8]">
                    Oferta: {formatBRL(Number(b.bid_value))}
                    {b.desagio_oferecido && <span className="text-[#9BAFC5] font-normal ml-2">({b.desagio_oferecido}% deságio)</span>}
                  </div>
                  <div className="text-[10px] text-[#9BAFC5] mt-1">
                    Pagamento: {b.payment_type === "a_vista" ? "À Vista" : b.payment_type === "parcelado" ? "Parcelado" : "Escrow"}
                    {b.notes && ` — ${b.notes}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBidAction(b.id, "aceitar")}
                    disabled={actionLoading === b.id}
                    className="flex items-center gap-1 px-3 py-2 bg-emerald-600 text-white rounded-md text-xs font-bold hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {actionLoading === b.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                    Aceitar
                  </button>
                  <button
                    onClick={() => handleBidAction(b.id, "recusar")}
                    disabled={actionLoading === b.id}
                    className="px-3 py-2 border border-red-500/30 text-red-400 rounded-md text-xs font-bold hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Recusar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Assistente do Ativo */}
      {assistantListing && (
        <AssetAssistant
          listingId={assistantListing.id}
          anonymousId={assistantListing.anonymous_id}
          onClose={() => setAssistantListing(null)}
        />
      )}
    </div>
  );
}
