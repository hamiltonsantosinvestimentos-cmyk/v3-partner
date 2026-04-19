"use client";

import { useState, useRef, useEffect } from "react";
import {
  Building2, Plus, FileText,
  TrendingUp, DollarSign, Target, Award,
  Paperclip, Trash2, Upload, X, MessageSquare,
  ExternalLink, Copy, CheckCheck, Send, FileImage, Download,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NovoDealForm } from "@/components/ma/novo-deal-form";
import { DealFormEditorClient } from "@/components/ma/deal-form-editor-client";

// ─── Etapas unificadas M&A ────────────────────────────────────────────────────
export const MA_PIPELINE = [
  { id: "prospeccao",    label: "Prospecção",                   color: "#8B5CF6", bg: "rgba(139,92,246,0.12)" },
  { id: "qualificacao",  label: "Qualificação",                 color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  { id: "viabilidade",   label: "Análise de Viabilidade",       color: "#06B6D4", bg: "rgba(6,182,212,0.12)"  },
  { id: "estruturacao",  label: "Estruturação da Oferta",       color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  { id: "negociacao",    label: "Negociação",                   color: "#EF4444", bg: "rgba(239,68,68,0.12)"  },
  { id: "due_diligence", label: "Due Diligence",                color: "#C4922E", bg: "rgba(196,146,46,0.12)" },
  { id: "aprovacao",     label: "Aprovação Final e Fechamento", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
];

// Mapeia deal_stage ENUM do BD para os IDs do pipeline
const STAGE_MAP: Record<string, string> = {
  PROSPECTING:   "prospeccao",
  QUALIFICATION: "qualificacao",
  IOI:           "viabilidade",
  DUE_DILIGENCE: "due_diligence",
  PROPOSAL:      "estruturacao",
  NEGOTIATION:   "negociacao",
  CLOSING:       "aprovacao",
  CLOSED_WON:    "aprovacao",
  CLOSED_LOST:   "aprovacao",
};

function normalizeStage(stage: string): string {
  return STAGE_MAP[stage] ?? stage ?? "prospeccao";
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
export type DealComment = {
  id: string;
  text: string;
  author: string;
  created_at: string;
};

export interface MaDeal {
  id: string;
  code: string;
  target_company: string;
  sector?: string | null;
  deal_value?: number | null;
  ebitda_multiple?: number | null;
  stage: string;
  probability_percent?: number | null;
  created_at?: string;
  title?: string;
  responsible?: string | null;
  notes?: string | null;
  location?: string | null;
  comments?: DealComment[];
  asset_data?: Record<string, unknown> | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

function probColor(p: number) {
  if (p >= 70) return "#10B981";
  if (p >= 40) return "#F59E0B";
  return "#EF4444";
}

// ─── Kanban Card ─────────────────────────────────────────────────────────────
function KanbanDealCard({
  deal, stage, onClick
}: {
  deal: MaDeal & { stage: string };
  stage: typeof MA_PIPELINE[0] | undefined;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="rounded-lg border border-[#122036] bg-[#091221] p-3 cursor-pointer hover:border-[#C4922E]/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-[#E8EDF5] leading-tight line-clamp-2">{deal.target_company}</p>
        <span className="text-[10px] text-[#5A7490] flex-shrink-0">{deal.code}</span>
      </div>
      {deal.sector && (
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full border mb-2"
          style={{ color: stage?.color ?? "#C4922E", borderColor: `${stage?.color ?? "#C4922E"}40`, background: stage?.bg ?? "rgba(196,146,46,0.1)" }}>
          {deal.sector}
        </span>
      )}
      {deal.deal_value ? (
        <p className="text-sm font-bold text-[#C4922E] mb-2">{formatCurrency(deal.deal_value)}</p>
      ) : null}
      {deal.probability_percent != null && (
        <div>
          <div className="flex justify-between mb-0.5">
            <span className="text-[10px] text-[#5A7490]">Prob.</span>
            <span className="text-[10px] font-medium" style={{ color: probColor(deal.probability_percent) }}>
              {deal.probability_percent}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-[#122036] overflow-hidden">
            <div className="h-full rounded-full" style={{
              width: `${deal.probability_percent}%`,
              background: probColor(deal.probability_percent),
            }} />
          </div>
        </div>
      )}
      {(deal.comments?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1 mt-2">
          <MessageSquare size={10} className="text-[#C4922E]" />
          <span className="text-[10px] text-[#7A8FA8]">{deal.comments!.length} atualização{deal.comments!.length !== 1 ? "s" : ""}</span>
        </div>
      )}
      {Boolean((deal.asset_data as Record<string, unknown>)?.tipo_participante) && (
        <div className="mt-1.5">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
            (deal.asset_data as Record<string, unknown>).tipo_participante === "Investidor"
              ? "text-emerald-400 bg-emerald-500/10"
              : "text-[#C9A84C] bg-[#C9A84C]/10"
          }`}>
            {String((deal.asset_data as Record<string, unknown>).tipo_participante ?? "")}
          </span>
        </div>
      )}
      {/* FORJA + KIT status badges */}
      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
        {(() => {
          const ad = deal.asset_data as Record<string, unknown> | null;
          const fs = ad?.forja_status as string | undefined;
          if (!fs) return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#122036] text-[#7A8FA8]">FORJA Pendente</span>;
          if (fs === "APROVADO") return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">⚡ Aprovado</span>;
          if (fs === "APROVADO_COM_RESSALVAS") return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">⚡ Ressalvas</span>;
          if (fs === "BLOQUEADO") return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">⚡ Bloqueado</span>;
          return null;
        })()}
        {Boolean((deal.asset_data as Record<string, unknown>)?.kit_liberado) && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#C9A84C]/15 text-[#C9A84C]">KIT ✓</span>
        )}
      </div>
    </div>
  );
}

const SECTORS = ["Fintech", "Real Estate", "Agronegócio", "Varejo", "Logística", "Saúde", "Tecnologia", "Indústria", "Energia", "Outro"];

// ─── Main Component ───────────────────────────────────────────────────────────
interface MaClientProps {
  deals: MaDeal[];
  userId?: string;
  userName?: string;
}

export function MaClient({ deals, userId = "", userName = "" }: MaClientProps) {
  const [localDeals, setLocalDeals] = useState(deals);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);
  const [newDeal, setNewDeal] = useState({ company: "", sector: "Fintech", value: "", stage: "prospeccao", responsible: "", notes: "", tipo_participante: "Vendedor" });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingNda, setPendingNda] = useState<File | null>(null);
  const [pendingMandato, setPendingMandato] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<MaDeal | null>(null);
  const [newComment, setNewComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ndaFileRef = useRef<HTMLInputElement>(null);
  const mandatoFileRef = useRef<HTMLInputElement>(null);
  const detailFileRef = useRef<HTMLInputElement>(null);

  // Documentos do deal selecionado
  type DocEntry = { doc_id: string; file_name: string; url: string | null; uploaded_at: string };
  const [dealDocs, setDealDocs] = useState<DocEntry[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [copiedDoc, setCopiedDoc] = useState<string | null>(null);

  // Atualiza dados frescos do banco ao montar
  useEffect(() => {
    fetch("/api/ma-deals")
      .then(r => r.json())
      .then(({ deals: fresh }) => {
        if (!Array.isArray(fresh)) return;
        setLocalDeals(fresh.map((d: Record<string, unknown>) => ({
          id: d.id as string,
          code: d.code as string,
          target_company: (d.target_company ?? d.title ?? "Sem nome") as string,
          sector: d.sector as string | null,
          deal_value: d.deal_value as number | null,
          ebitda_multiple: d.ebitda_multiple as number | null,
          stage: d.stage as string,
          probability_percent: d.probability_percent as number | null,
          created_at: d.created_at as string,
          notes: d.notes as string | null,
          location: d.location as string | null,
          comments: Array.isArray(d.comments) ? d.comments as DealComment[] : [],
          asset_data: (d.asset_data ?? {}) as Record<string, unknown>,
          responsible: (() => {
            const p = d.partner;
            if (Array.isArray(p as unknown[])) return ((p as {full_name?: string}[])[0])?.full_name ?? null;
            return (p as { full_name?: string } | null)?.full_name ?? null;
          })(),
        })));
      })
      .catch(() => {});
  }, []);

  // Carrega documentos ao abrir detalhe
  useEffect(() => {
    if (!selectedDeal) { setDealDocs([]); return; }
    setDocsLoading(true);
    fetch(`/api/ma/documents?deal_id=${selectedDeal.id}`)
      .then(r => r.json())
      .then(({ documents }) => setDealDocs(Array.isArray(documents) ? documents : []))
      .catch(() => setDealDocs([]))
      .finally(() => setDocsLoading(false));
  }, [selectedDeal?.id]);

  // Refresh asset_data ao abrir detalhe (garante kit_liberado atualizado)
  useEffect(() => {
    if (!selectedDeal) return;
    fetch(`/api/ma-deals?id=${selectedDeal.id}`)
      .then(r => r.json())
      .then(({ deal }) => {
        if (!deal) return;
        const fresh = (deal.asset_data ?? {}) as Record<string, unknown>;
        setSelectedDeal(prev => prev ? { ...prev, asset_data: fresh } : prev);
        setLocalDeals(prev => prev.map(d => d.id === deal.id ? { ...d, asset_data: fresh } : d));
      })
      .catch(() => {});
  }, [selectedDeal?.id]);

  const normalizedDeals = localDeals.map(d => ({ ...d, stage: normalizeStage(d.stage) }));
  const totalValue = localDeals.reduce((s, d) => s + (d.deal_value ?? 0), 0);
  const activeDeals = normalizedDeals.filter(d => d.stage !== "aprovacao").length;
  const closedDeals = normalizedDeals.filter(d => d.stage === "aprovacao").length;

  const handleCreateDeal = async () => {
    if (!newDeal.company || !newDeal.value) return;
    setIsCreating(true);
    let createdId: string | null = null;

    try {
      const res = await fetch("/api/ma-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: newDeal.company,
          sector: newDeal.sector,
          value: Number(newDeal.value),
          notes: newDeal.notes,
          responsible: newDeal.responsible || userName,
          tipo_participante: newDeal.tipo_participante as "Vendedor" | "Investidor",
        }),
      });
      const json = await res.json();
      if (json.card) {
        createdId = json.card.id;
        setLocalDeals(prev => [...prev, { ...json.card, stage: newDeal.stage, comments: [], asset_data: { tipo_participante: newDeal.tipo_participante } }]);
      }
    } catch {
      setIsCreating(false);
      return;
    }

    if (!createdId) {
      setIsCreating(false);
      return;
    }

    if (createdId && pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        const form = new FormData();
        form.append("file", file);
        form.append("deal_id", createdId);
        form.append("doc_id", `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        await fetch("/api/ma/documents", { method: "POST", body: form }).catch(() => {});
      }
    }

    // Upload NDA e Mandato se fornecidos
    if (createdId) {
      for (const { file, docId } of [
        { file: pendingNda, docId: "nda_parceiro" },
        { file: pendingMandato, docId: "mandato_parceiro" },
      ]) {
        if (!file) continue;
        const form = new FormData();
        form.append("file", file);
        form.append("deal_id", createdId);
        form.append("doc_id", docId);
        await fetch("/api/ma/documents", { method: "POST", body: form }).catch(() => {});
      }
    }
    setNewDeal({ company: "", sector: "Fintech", value: "", stage: "prospeccao", responsible: "", notes: "", tipo_participante: "Vendedor" });
    setPendingFiles([]);
    setPendingNda(null);
    setPendingMandato(null);
    setIsCreating(false);
    setShowNewDeal(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedDeal || savingComment) return;
    setSavingComment(true);
    const comment: DealComment = {
      id: `cmt_${Date.now()}`,
      text: newComment.trim(),
      author: userName || "Partner",
      created_at: new Date().toISOString(),
    };
    const updated = [...(selectedDeal.comments ?? []), comment];
    try {
      await fetch("/api/ma-deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedDeal.id, comments: updated }),
      });
      setLocalDeals(prev => prev.map(d => d.id === selectedDeal.id ? { ...d, comments: updated } : d));
      setSelectedDeal(prev => prev ? { ...prev, comments: updated } : null);
      setNewComment("");
    } catch {}
    setSavingComment(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#C4922E]/15 flex items-center justify-center">
            <Building2 size={18} className="text-[#C4922E]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">M&A — Minhas Operações</h1>
            <p className="text-xs text-[#5A7490]">Seus deals no pipeline de fusões e aquisições</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewDeal(true)}
            className="flex items-center gap-2 rounded-lg border border-[#C4922E]/40 text-[#C4922E] text-xs font-semibold px-3 py-2 hover:bg-[#C4922E]/10 transition-colors"
          >
            <Plus size={14} />
            Rápido
          </button>
          <button
            onClick={() => setShowFullForm(true)}
            className="flex items-center gap-2 rounded-lg bg-[#C4922E] text-[#050C18] text-xs font-semibold px-4 py-2 hover:bg-[#E5B96A] transition-colors"
          >
            <Plus size={14} />
            Novo Deal Completo
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total de Deals", value: localDeals.length, icon: <Target size={16} />, color: "text-purple-400", accent: "#8B5CF6" },
          { label: "Volume Total", value: formatCurrency(totalValue), icon: <DollarSign size={16} />, color: "text-[#C4922E]", accent: "#C4922E" },
          { label: "Em Andamento", value: activeDeals, icon: <TrendingUp size={16} />, color: "text-amber-400", accent: "#F59E0B" },
          { label: "Concluídos", value: closedDeals, icon: <Award size={16} />, color: "text-emerald-400", accent: "#10B981" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-[#122036] bg-[#091221] p-4 flex items-center gap-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px]"
              style={{ background: `linear-gradient(90deg, transparent, ${kpi.accent}44, transparent)` }} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${kpi.accent}18`, color: kpi.accent }}>
              {kpi.icon}
            </div>
            <div>
              <p className="text-xs text-[#5A7490]">{kpi.label}</p>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      {normalizedDeals.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-[#122036]">
          <Building2 size={32} className="text-[#5A7490] mx-auto mb-3 opacity-40" />
          <p className="text-[#5A7490] text-sm mb-3">Nenhuma operação encontrada.</p>
          <button onClick={() => setShowNewDeal(true)} className="text-xs text-[#C4922E] hover:underline">
            + Cadastrar nova operação
          </button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {MA_PIPELINE.map(stage => {
            const stageDeals = normalizedDeals.filter(d => d.stage === stage.id);
            return (
              <div key={stage.id} className="flex-shrink-0 w-60">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                  <span className="text-xs font-semibold text-[#E8EDF5] flex-1 truncate">{stage.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ color: stage.color, background: stage.bg }}>
                    {stageDeals.length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[80px] rounded-xl border border-[#122036]/60 bg-[#050C18]/50 p-2">
                  {stageDeals.map(deal => (
                    <KanbanDealCard
                      key={deal.id}
                      deal={deal}
                      stage={stage}
                      onClick={() => setSelectedDeal(deal)}
                    />
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="h-14 flex items-center justify-center">
                      <p className="text-[11px] text-[#5A7490]">Sem operações</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Detalhe do Deal ── */}
      {selectedDeal && (() => {
        const normalizedStage = normalizeStage(selectedDeal.stage);
        const stageInfo = MA_PIPELINE.find(s => s.id === normalizedStage);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#091221] border border-[#122036] rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#122036]">
                <div>
                  <h3 className="text-sm font-bold text-[#E8EDF5]">{selectedDeal.target_company}</h3>
                  <span className="text-[10px] text-[#7A8FA8]">{selectedDeal.code}</span>
                </div>
                <button onClick={() => setSelectedDeal(null)} className="text-[#7A8FA8] hover:text-[#E8EDF5] transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                {/* Info grid completa */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Empresa", value: selectedDeal.target_company },
                    { label: "Setor", value: selectedDeal.sector ?? "—" },
                    { label: "Valor Estimado", value: selectedDeal.deal_value ? formatCurrency(selectedDeal.deal_value) : "—", gold: true },
                    { label: "Responsável", value: selectedDeal.responsible ?? "—" },
                    { label: "Probabilidade", value: `${selectedDeal.probability_percent ?? 0}%`, pct: selectedDeal.probability_percent ?? 0 },
                    { label: "Cadastrado em", value: selectedDeal.created_at ? formatDate(selectedDeal.created_at) : "—" },
                  ].map(item => (
                    <div key={item.label} className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                      <p className="text-[10px] text-[#7A8FA8] mb-1">{item.label}</p>
                      <p className={`text-xs font-medium ${item.gold ? "text-[#C4922E] font-bold" : "text-[#E8EDF5]"}`}
                        style={item.pct !== undefined ? { color: probColor(item.pct) } : undefined}>
                        {item.value}
                      </p>
                    </div>
                  ))}
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3 col-span-2">
                    <p className="text-[10px] text-[#7A8FA8] mb-1">Etapa atual</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ color: stageInfo?.color, background: stageInfo?.bg }}>
                      {stageInfo?.label ?? normalizedStage}
                    </span>
                  </div>
                </div>

                {/* Observações */}
                {Boolean(selectedDeal.notes) && (
                  <div>
                    <p className="text-xs text-[#7A8FA8] mb-1.5 flex items-center gap-1.5">
                      <FileText size={12} /> Observações
                    </p>
                    <p className="text-xs text-[#E8EDF5] bg-[#0F1E35] border border-[#122036] rounded-lg px-3 py-2.5 leading-relaxed">
                      {selectedDeal.notes ?? ""}
                    </p>
                  </div>
                )}

                {/* Documentos — upload e listagem */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[#7A8FA8] flex items-center gap-1.5">
                      <FileText size={12} /> Documentos do Ativo
                    </p>
                    <button
                      type="button"
                      onClick={() => detailFileRef.current?.click()}
                      className="flex items-center gap-1 text-xs text-[#C4922E] hover:text-[#E5B96A] transition-colors"
                    >
                      <Upload size={12} /> Enviar
                    </button>
                  </div>
                  <input
                    ref={detailFileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (!files.length || !selectedDeal) return;
                      if (detailFileRef.current) detailFileRef.current.value = "";
                      for (const file of files) {
                        const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                        setUploadingDoc(docId);
                        const form = new FormData();
                        form.append("file", file);
                        form.append("deal_id", selectedDeal.id);
                        form.append("doc_id", docId);
                        try {
                          const res = await fetch("/api/ma/documents", { method: "POST", body: form });
                          const json = await res.json();
                          if (json.ok && json.document) {
                            setDealDocs(prev => [...prev, json.document]);
                          } else {
                            alert(json.error ?? "Erro ao enviar arquivo");
                          }
                        } catch { alert("Erro ao enviar arquivo"); }
                        setUploadingDoc(null);
                      }
                    }}
                  />
                  {docsLoading ? (
                    <div className="flex items-center gap-2 py-2 text-xs text-[#7A8FA8]">
                      <div className="w-3 h-3 border-2 border-[#C4922E]/40 border-t-[#C4922E] rounded-full animate-spin" />
                      Carregando documentos...
                    </div>
                  ) : dealDocs.length === 0 && !uploadingDoc ? (
                    <p className="text-xs text-[#5A7490] py-1">Nenhum documento anexado.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {dealDocs.map(doc => (
                        <div key={doc.doc_id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#0F1E35] border border-[#122036]">
                          <Paperclip size={12} className="text-[#C4922E] flex-shrink-0" />
                          <span className="text-xs text-[#E8EDF5] flex-1 truncate">{doc.file_name}</span>
                          {doc.url && (
                            <>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[#7A8FA8] hover:text-[#C4922E] transition-colors">
                                <ExternalLink size={12} />
                              </a>
                              <button onClick={() => { navigator.clipboard.writeText(doc.url!); setCopiedDoc(doc.doc_id); setTimeout(() => setCopiedDoc(null), 2000); }}
                                className="text-[#7A8FA8] hover:text-[#C4922E] transition-colors">
                                {copiedDoc === doc.doc_id ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                      {uploadingDoc && (
                        <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#0F1E35] border border-dashed border-[#C4922E]/40">
                          <div className="w-3 h-3 border-2 border-[#C4922E]/40 border-t-[#C4922E] rounded-full animate-spin flex-shrink-0" />
                          <span className="text-xs text-[#7A8FA8]">Enviando...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Tipo Participante */}
                {Boolean((selectedDeal.asset_data as Record<string, unknown>)?.tipo_participante) && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#7A8FA8]">Tipo:</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      (selectedDeal.asset_data as Record<string, unknown>).tipo_participante === "Investidor"
                        ? "text-emerald-400 bg-emerald-500/10"
                        : "text-[#C9A84C] bg-[#C9A84C]/10"
                    }`}>
                      {String((selectedDeal.asset_data as Record<string, unknown>).tipo_participante ?? "")}
                    </span>
                  </div>
                )}

                {/* NDA / Mandato — documentos do parceiro */}
                <div>
                  <p className="text-xs text-[#7A8FA8] mb-2 flex items-center gap-1.5">
                    <FileText size={12} /> NDA / Mandato
                  </p>
                  {(() => {
                    const ndaDoc = dealDocs.find(d => d.doc_id === "nda_parceiro");
                    const mandatoDoc = dealDocs.find(d => d.doc_id === "mandato_parceiro");
                    return (
                      <div className="space-y-1.5">
                        {[
                          { label: "NDA", doc: ndaDoc, ref: "nda" },
                          { label: "Mandato", doc: mandatoDoc, ref: "mandato" },
                        ].map(({ label, doc, ref }) => (
                          <div key={ref} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#0F1E35] border border-[#122036]">
                            <FileText size={12} className={doc ? "text-emerald-400" : "text-[#5A7490]"} />
                            <span className="text-xs text-[#E8EDF5] flex-1">{label}</span>
                            {doc ? (
                              <>
                                <span className="text-[10px] text-emerald-400 truncate max-w-24">{doc.file_name}</span>
                                {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[#7A8FA8] hover:text-[#C4922E]"><ExternalLink size={11} /></a>}
                              </>
                            ) : (
                              <span className="text-[10px] text-[#5A7490]">Não anexado</span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Status FORJA — somente leitura para o partner */}
                {(() => {
                  const ad = selectedDeal.asset_data as Record<string, unknown> | null;
                  const fs = ad?.forja_status as string | undefined;
                  const score = ad?.forja_score as number | undefined;
                  const validatedAt = ad?.forja_validated_at as string | undefined;
                  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
                    APROVADO: { label: "Aprovado", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                    APROVADO_COM_RESSALVAS: { label: "Aprovado com Ressalvas", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
                    PENDENTE: { label: "Pendente", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
                    BLOQUEADO: { label: "Bloqueado", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
                  };
                  const cfg = fs ? statusConfig[fs] : null;
                  return (
                    <div>
                      <p className="text-xs text-[#7A8FA8] mb-2 flex items-center gap-1.5">
                        <span className="text-[#C9A84C]">⚡</span> Validação FORJA
                      </p>
                      <div className={`px-3 py-2.5 rounded-lg border ${cfg ? cfg.bg : "bg-[#0F1E35] border-[#122036]"} flex items-center justify-between gap-2`}>
                        <div>
                          <p className={`text-xs font-semibold ${cfg ? cfg.color : "text-[#7A8FA8]"}`}>
                            {cfg ? cfg.label : "Aguardando validação pela Mesa M&A"}
                          </p>
                          {validatedAt && (
                            <p className="text-[10px] text-[#5A7490] mt-0.5">
                              Validado em {new Date(validatedAt).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                        {score !== undefined && (
                          <span className={`text-sm font-bold ${cfg ? cfg.color : "text-[#7A8FA8]"}`}>{score}/100</span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Kit de Criativos — liberado pela Mesa M&A */}
                {(() => {
                  const ad = (selectedDeal.asset_data as Record<string, unknown>) ?? {};
                  const kitLiberado = !!ad.kit_liberado;
                  const kitFiles = (ad.kit_files_available ?? {}) as Record<string, boolean>;
                  const FILE_LABELS: Record<string, string> = {
                    cim: "CIM", teaser: "Teaser Cego",
                    linkedin_post: "LinkedIn Post", linkedin_story: "LinkedIn Story",
                  };
                  const availableEntries = Object.entries(kitFiles).filter(([, v]) => v);
                  return (
                    <div>
                      <p className="text-xs text-[#7A8FA8] mb-2 flex items-center gap-1.5">
                        <FileImage size={12} /> Kit de Criativos
                      </p>
                      {!kitLiberado ? (
                        <div className="px-3 py-2.5 rounded-lg bg-[#0F1E35] border border-dashed border-[#243A66] text-center">
                          <p className="text-[11px] text-[#5A7490]">🔒 Disponível após validação FORJA pela Mesa M&A</p>
                        </div>
                      ) : availableEntries.length === 0 ? (
                        <div className="px-3 py-2.5 rounded-lg bg-[#0F1E35] border border-dashed border-[#243A66] text-center">
                          <p className="text-[11px] text-[#5A7490]">Nenhum arquivo disponibilizado ainda pela Mesa M&A</p>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {availableEntries.map(([key]) => {
                            const [type, lang] = key.split("_pt-br").length > 1
                              ? [key.replace("_pt-br", ""), "pt-br"]
                              : [key.replace("_en", ""), "en"];
                            const label = FILE_LABELS[type] ?? type;
                            const previewUrl = `/api/ma/preview-criativo?dealId=${selectedDeal.id}&type=${type}&lang=${lang}`;
                            return (
                              <div key={key} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0F1E35] border border-[#1A3050]">
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileImage size={11} className="text-[#C9A84C] flex-shrink-0" />
                                  <span className="text-xs text-[#E8EDF5] font-medium truncate">{label}</span>
                                  <span className="text-[10px] text-[#5A7490] flex-shrink-0">{lang === "pt-br" ? "PT-BR" : "EN"}</span>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <a href={`${previewUrl}&format=pdf`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[10px] font-semibold text-red-400 hover:text-red-300 transition-colors">
                                    <Download size={9} />PDF
                                  </a>
                                  <span className="text-[#243A66]">·</span>
                                  <a href={`${previewUrl}&format=jpg`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-400 hover:text-amber-300 transition-colors">
                                    <Download size={9} />JPEG
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Edição do Deal — 6 etapas */}
                <DealFormEditorClient
                  dealId={selectedDeal.id}
                  dealData={{
                    target_company: selectedDeal.target_company,
                    sector: selectedDeal.sector ?? "",
                    location: selectedDeal.location ?? "",
                    deal_value: selectedDeal.deal_value ?? null,
                    probability_percent: selectedDeal.probability_percent ?? null,
                    notes: selectedDeal.notes ?? null,
                    asset_data: (selectedDeal.asset_data ?? {}) as Record<string, unknown>,
                  }}
                  compact={true}
                  onSaved={(updated) => {
                    setLocalDeals(prev => prev.map(d =>
                      d.id === selectedDeal.id
                        ? { ...d, ...updated, asset_data: updated.asset_data as Record<string, unknown> }
                        : d
                    ));
                    setSelectedDeal(prev => prev ? {
                      ...prev,
                      ...updated,
                      asset_data: updated.asset_data as Record<string, unknown>,
                    } : null);
                  }}
                />

                {/* Atualizações — leitura + escrita */}
                <div>
                  <p className="text-xs text-[#7A8FA8] mb-2 flex items-center gap-1.5">
                    <MessageSquare size={12} /> Atualizações
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                    {(selectedDeal.comments?.length ?? 0) === 0 ? (
                      <p className="text-xs text-[#5A7490] py-1">Nenhuma atualização ainda.</p>
                    ) : (
                      selectedDeal.comments!.map(c => (
                        <div key={c.id} className="rounded-lg bg-[#0F1E35] border border-[#122036] p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-semibold text-[#C9A84C]">{c.author}</span>
                            <span className="text-[10px] text-[#5A7490]">{formatDate(c.created_at)}</span>
                          </div>
                          <p className="text-xs text-[#E8EDF5] leading-relaxed">{c.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      placeholder="Adicionar atualização..."
                      rows={2}
                      onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) handleAddComment(); }}
                      className="flex-1 rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-xs px-3 py-2 placeholder:text-[#5A7490] focus:outline-none focus:border-[#C9A84C]/50 transition resize-none"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || savingComment}
                      className="rounded-lg bg-[#C4922E]/15 border border-[#C4922E]/40 text-[#C4922E] px-2.5 hover:bg-[#C4922E]/25 transition-colors disabled:opacity-40 flex items-center justify-center"
                    >
                      {savingComment
                        ? <div className="w-3 h-3 border-2 border-[#C4922E]/40 border-t-[#C4922E] rounded-full animate-spin" />
                        : <Send size={12} />}
                    </button>
                  </div>
                </div>

                {/* Botão Fechar */}
                <div className="pt-2 border-t border-[#122036]">
                  <button
                    onClick={() => setSelectedDeal(null)}
                    className="w-full rounded-lg border border-[#122036] text-[#7A8FA8] text-sm py-2.5 hover:text-[#E8EDF5] hover:border-[#243A66] transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Nova Operação ── */}
      {/* ── Modal Novo Deal Completo ── */}
      <Dialog open={showFullForm} onOpenChange={setShowFullForm}>
        <DialogContent className="bg-[#091221] border border-[#122036] text-[#E8EDF5] max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#E8EDF5]">Novo Deal M&A — Formulário Completo</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <NovoDealForm
              isDemo={false}
              userId={userId}
              onCancel={() => setShowFullForm(false)}
              onSuccess={(dealId, code) => {
                setShowFullForm(false);
                fetch("/api/ma-deals")
                  .then(r => r.json())
                  .then(({ deals: fresh }) => {
                    if (!Array.isArray(fresh)) return;
                    setLocalDeals(fresh.map((d: Record<string, unknown>) => ({
                      id: d.id as string,
                      code: d.code as string,
                      target_company: (d.target_company ?? d.title ?? "Sem nome") as string,
                      sector: d.sector as string | null,
                      deal_value: d.deal_value as number | null,
                      ebitda_multiple: d.ebitda_multiple as number | null,
                      stage: d.stage as string,
                      probability_percent: d.probability_percent as number | null,
                      created_at: d.created_at as string,
                      notes: d.notes as string | null,
                      location: d.location as string | null,
                      comments: Array.isArray(d.comments) ? d.comments as DealComment[] : [],
                      asset_data: (d.asset_data ?? {}) as Record<string, unknown>,
                      responsible: (() => {
                        const p = d.partner;
                        if (Array.isArray(p as unknown[])) return ((p as {full_name?: string}[])[0])?.full_name ?? null;
                        return (p as { full_name?: string } | null)?.full_name ?? null;
                      })(),
                    })));
                  })
                  .catch(() => {});
                void dealId; void code;
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {showNewDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#091221] border border-[#122036] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#122036]">
              <h3 className="text-sm font-bold text-[#E8EDF5]">Nova Operação M&A</h3>
              <button onClick={() => { setShowNewDeal(false); setPendingFiles([]); }} className="text-[#7A8FA8] hover:text-[#E8EDF5] transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Empresa *</label>
                <input value={newDeal.company} onChange={e => setNewDeal(p => ({ ...p, company: e.target.value }))}
                  placeholder="Nome da empresa alvo"
                  className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#7A8FA8] mb-1.5 block">Setor</label>
                  <select value={newDeal.sector} onChange={e => setNewDeal(p => ({ ...p, sector: e.target.value }))}
                    className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors">
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#7A8FA8] mb-1.5 block">Etapa</label>
                  <select value={newDeal.stage} onChange={e => setNewDeal(p => ({ ...p, stage: e.target.value }))}
                    className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors">
                    {MA_PIPELINE.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Valor Estimado (R$) *</label>
                <input type="number" value={newDeal.value} onChange={e => setNewDeal(p => ({ ...p, value: e.target.value }))}
                  placeholder="Ex: 50000000"
                  className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors" />
              </div>
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Responsável</label>
                <input value={newDeal.responsible} onChange={e => setNewDeal(p => ({ ...p, responsible: e.target.value }))}
                  placeholder={userName || "Nome do responsável"}
                  className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors" />
              </div>
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Observações</label>
                <textarea value={newDeal.notes} onChange={e => setNewDeal(p => ({ ...p, notes: e.target.value }))} rows={2}
                  placeholder="Contexto inicial da operação..."
                  className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors resize-none" />
              </div>

              {/* Tipo de Participante */}
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Tipo de Participante *</label>
                <div className="flex gap-2">
                  {(["Vendedor", "Investidor"] as const).map(tipo => (
                    <button
                      key={tipo}
                      type="button"
                      onClick={() => setNewDeal(p => ({ ...p, tipo_participante: tipo }))}
                      className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        newDeal.tipo_participante === tipo
                          ? tipo === "Investidor"
                            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                            : "bg-[#C9A84C]/15 border-[#C9A84C]/40 text-[#C9A84C]"
                          : "border-[#122036] text-[#5A7490] hover:border-[#243A66]"
                      }`}
                    >
                      {tipo === "Vendedor" ? "🏢 Vendedor" : "💼 Investidor"}
                    </button>
                  ))}
                </div>
              </div>

              {/* NDA */}
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Anexar NDA (opcional)</label>
                <input ref={ndaFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                  onChange={e => { setPendingNda(e.target.files?.[0] ?? null); if (ndaFileRef.current) ndaFileRef.current.value = ""; }} />
                <button type="button" onClick={() => ndaFileRef.current?.click()}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border border-[#122036] bg-[#0F1E35] text-xs px-3 py-2 hover:border-[#243A66] transition-colors">
                  <span className={pendingNda ? "text-[#E8EDF5]" : "text-[#5A7490]"}>
                    {pendingNda ? pendingNda.name : "Selecionar arquivo NDA..."}
                  </span>
                  {pendingNda
                    ? <button type="button" onClick={e => { e.stopPropagation(); setPendingNda(null); }} className="text-[#7A8FA8] hover:text-red-400"><X size={12} /></button>
                    : <Upload size={12} className="text-[#5A7490]" />}
                </button>
              </div>

              {/* Mandato */}
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Anexar Mandato (opcional)</label>
                <input ref={mandatoFileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
                  onChange={e => { setPendingMandato(e.target.files?.[0] ?? null); if (mandatoFileRef.current) mandatoFileRef.current.value = ""; }} />
                <button type="button" onClick={() => mandatoFileRef.current?.click()}
                  className="w-full flex items-center justify-between gap-2 rounded-lg border border-[#122036] bg-[#0F1E35] text-xs px-3 py-2 hover:border-[#243A66] transition-colors">
                  <span className={pendingMandato ? "text-[#E8EDF5]" : "text-[#5A7490]"}>
                    {pendingMandato ? pendingMandato.name : "Selecionar arquivo Mandato..."}
                  </span>
                  {pendingMandato
                    ? <button type="button" onClick={e => { e.stopPropagation(); setPendingMandato(null); }} className="text-[#7A8FA8] hover:text-red-400"><X size={12} /></button>
                    : <Upload size={12} className="text-[#5A7490]" />}
                </button>
              </div>

              {/* Documentos do ativo */}
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Documentos do Ativo</label>
                <input ref={fileInputRef} type="file" multiple className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    setPendingFiles(prev => [...prev, ...files]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }} />
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#C9A84C]/40 bg-[#C9A84C]/5 text-[#C9A84C] text-xs py-3 hover:bg-[#C9A84C]/10 transition-colors">
                  <Upload size={14} /> Adicionar arquivos
                </button>
                {pendingFiles.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {pendingFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#0F1E35] border border-[#122036]">
                        <Paperclip size={12} className="text-[#C9A84C] flex-shrink-0" />
                        <span className="text-xs text-[#E8EDF5] flex-1 truncate">{f.name}</span>
                        <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}>
                          <Trash2 size={12} className="text-[#7A8FA8] hover:text-red-400 transition-colors" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowNewDeal(false); setPendingFiles([]); }}
                  className="flex-1 rounded-lg border border-[#122036] text-[#7A8FA8] text-sm py-2.5 hover:text-[#E8EDF5] transition-colors">
                  Cancelar
                </button>
                <button onClick={handleCreateDeal} disabled={!newDeal.company || !newDeal.value || isCreating}
                  className="flex-1 rounded-lg bg-[#C4922E] text-[#09081A] text-sm font-semibold py-2.5 hover:bg-[#E5B96A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isCreating
                    ? <><div className="w-4 h-4 border-2 border-[#09081A]/40 border-t-[#09081A] rounded-full animate-spin" /> Criando...</>
                    : "Criar Operação"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
