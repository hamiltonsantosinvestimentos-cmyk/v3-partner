"use client";

import { useState, useRef, useEffect } from "react";
import {
  Building2, Plus, FileText,
  TrendingUp, DollarSign, Target, Award,
  Paperclip, Trash2, Upload, X, MessageSquare,
  ExternalLink, Copy, CheckCheck,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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
  comments?: DealComment[];
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
  const [newDeal, setNewDeal] = useState({ company: "", sector: "Fintech", value: "", stage: "prospeccao", responsible: "", notes: "" });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<MaDeal | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
          comments: Array.isArray(d.comments) ? d.comments as DealComment[] : [],
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
        }),
      });
      const json = await res.json();
      if (json.card) {
        createdId = json.card.id;
        setLocalDeals(prev => [...prev, { ...json.card, stage: newDeal.stage, comments: [] }]);
      }
    } catch {}

    if (!createdId) {
      const deal: MaDeal = {
        id: `ma-${Date.now()}`,
        code: `MA-26-${String(localDeals.length + 1).padStart(3, "0")}`,
        target_company: newDeal.company,
        sector: newDeal.sector,
        deal_value: Number(newDeal.value),
        stage: newDeal.stage,
        responsible: newDeal.responsible || userName || null,
        probability_percent: 10,
        created_at: new Date().toISOString(),
        comments: [],
      };
      setLocalDeals(prev => [...prev, deal]);
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

    setNewDeal({ company: "", sector: "Fintech", value: "", stage: "prospeccao", responsible: "", notes: "" });
    setPendingFiles([]);
    setIsCreating(false);
    setShowNewDeal(false);
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
        <button
          onClick={() => setShowNewDeal(true)}
          className="flex items-center gap-2 rounded-lg bg-[#C4922E] text-[#050C18] text-xs font-semibold px-4 py-2 hover:bg-[#E5B96A] transition-colors"
        >
          <Plus size={14} />
          Nova Operação
        </button>
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
                {selectedDeal.notes && (
                  <div>
                    <p className="text-xs text-[#7A8FA8] mb-1.5 flex items-center gap-1.5">
                      <FileText size={12} /> Observações
                    </p>
                    <p className="text-xs text-[#E8EDF5] bg-[#0F1E35] border border-[#122036] rounded-lg px-3 py-2.5 leading-relaxed">
                      {selectedDeal.notes}
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

                {/* Atualizações da Mesa (somente leitura) */}
                <div>
                  <p className="text-xs text-[#7A8FA8] mb-2 flex items-center gap-1.5">
                    <MessageSquare size={12} /> Atualizações da Mesa M&A
                  </p>
                  {(selectedDeal.comments?.length ?? 0) === 0 ? (
                    <p className="text-xs text-[#5A7490] py-1">Nenhuma atualização ainda.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {selectedDeal.comments!.map(c => (
                        <div key={c.id} className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-semibold text-[#C9A84C]">{c.author}</span>
                            <span className="text-[10px] text-[#5A7490]">{formatDate(c.created_at)}</span>
                          </div>
                          <p className="text-xs text-[#E8EDF5] leading-relaxed">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Nova Operação ── */}
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
