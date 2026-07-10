"use client";

import { useState, useEffect, useRef } from "react";
import {
  Building2, Plus, X, ChevronRight, ChevronLeft,
  BarChart2, Mail, Circle, FileText,
  Paperclip, Trash2, ExternalLink, Upload, Copy, CheckCheck,
  MessageSquare, Send, Zap, FileImage, FileSignature,
  ArrowLeftRight, Pencil, Check, Loader2, DatabaseZap, Clock, TrendingUp, Bot,
  Link2, AlertCircle, CheckCircle2,
} from "lucide-react";
import { ExportButton } from "@/components/financeiro/export-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MA_PIPELINE } from "@/components/ma/ma-client";
import { ForjaPanel } from "@/components/ma/forja-panel";
import { DocumentRequestPanel } from "@/components/ma/document-request-panel";
import { ContratoPanel } from "@/components/ma/contrato-panel";
import { InvestorMatchPanel } from "@/components/ma/investor-match-panel";
import dynamic from "next/dynamic";
const DealAnalyticsPanel = dynamic(
  () => import("@/components/ma/deal-analytics-panel").then(m => m.DealAnalyticsPanel),
  { ssr: false }
);
const DealQAPanel = dynamic(
  () => import("@/components/ma/deal-qa-panel").then(m => m.DealQAPanel),
  { ssr: false }
);
const DealRoomPanel = dynamic(
  () => import("@/components/ma/deal-room-panel").then(m => m.DealRoomPanel),
  { ssr: false }
);
const DealTimeline = dynamic(
  () => import("@/components/ma/deal-timeline").then(m => m.DealTimeline),
  { ssr: false }
);
const BusinessPlanContainer = dynamic(
  () => import("@/components/ma/business-plan/business-plan-container").then(m => m.BusinessPlanContainer),
  { ssr: false }
);
import { NovoDealForm } from "@/components/ma/novo-deal-form";
import { DealFormEditorClient } from "@/components/ma/deal-form-editor-client";
import { BuysideDemandPanel } from "@/components/ma/buyside-demand-panel";
const DealIaChat = dynamic(
  () => import("@/components/ma/deal-ia-chat").then(m => m.DealIaChat),
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────
type DealComment = {
  id: string;
  text: string;
  author: string;
  created_at: string;
};

type MaCard = {
  id: string;
  code: string;
  company: string;
  sector: string;
  value: number;
  stage: string;
  dbStage?: string;
  responsible: string;
  assigned_to_id?: string;
  probability: number;
  createdAt: string;
  notes?: string;
  comments?: DealComment[];
  asset_data?: Record<string, unknown>;
  location?: string;
  tipo_participante?: string;
};

type MesaOperator = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "online" | "offline" | "away";
  assignedCards: number;
};

type MaStage = { id: string; label: string; color: string; bg: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const MA_STAGES_DEFAULT: MaStage[] = MA_PIPELINE.map(s => ({
  id: s.id,
  label: s.label,
  color: s.color,
  bg: s.bg.replace("0.12", "0.1"),
}));


const SECTORS = ["Fintech", "Real Estate", "Agronegócio", "Varejo", "Logística", "Saúde", "Tecnologia", "Indústria", "Energia", "Outro"];

// Mapeia pipeline IDs de volta para ENUM do banco
const PIPELINE_TO_DB: Record<string, string> = {
  prospeccao:    "PROSPECTING",
  qualificacao:  "QUALIFICATION",
  viabilidade:   "IOI",
  estruturacao:  "PROPOSAL",
  negociacao:    "NEGOTIATION",
  due_diligence: "DUE_DILIGENCE",
  aprovacao:     "CLOSING",
};

// Probabilidade padrão por fase — atualizada automaticamente ao mover
const STAGE_DEFAULT_PROBABILITY: Record<string, number> = {
  prospeccao:    10,
  qualificacao:  20,
  viabilidade:   35,
  estruturacao:  50,
  negociacao:    65,
  due_diligence: 75,
  aprovacao:     90,
};
const ROLES_MA = ["Analista Jr.", "Analista", "Analista Sênior", "Especialista M&A", "Gestor"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatM(v: number) {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v}`;
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

function probColor(p: number) {
  if (p >= 80) return "#10B981";
  if (p >= 50) return "#F59E0B";
  return "#EF4444";
}

function statusColor(s: MesaOperator["status"]) {
  if (s === "online") return "#10B981";
  if (s === "away") return "#F59E0B";
  return "#7A8FA8";
}

function statusLabel(s: MesaOperator["status"]) {
  if (s === "online") return "Online";
  if (s === "away") return "Ausente";
  return "Offline";
}

function nextStage(current: string, stages: MaStage[]): string | null {
  const idx = stages.findIndex(s => s.id === current);
  if (idx === -1 || idx === stages.length - 1) return null;
  return stages[idx + 1].id;
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────
function KanbanCardItem({
  card, stages, onClick, onOpenForja,
}: {
  card: MaCard;
  stages: MaStage[];
  onClick: () => void;
  onOpenForja: () => void;
}) {
  const stage = stages.find(s => s.id === card.stage);
  const isInvestidor = card.tipo_participante === "Investidor";
  const forjaStatus = card.asset_data?.forja_status as string | undefined;
  return (
    <div
      onClick={onClick}
      className="rounded-lg border border-[#122036] bg-[#091221] p-3 cursor-pointer hover:border-[#C9A84C]/60 hover:shadow-lg transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-[#E8EDF5] leading-tight group-hover:text-[#C9A84C] transition-colors">{card.company}</p>
        <span className="text-[10px] text-[#7A8FA8] flex-shrink-0 ml-1">{card.code}</span>
      </div>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
          style={{ color: stage?.color, borderColor: `${stage?.color}40`, background: stage?.bg }}>
          {card.sector}
        </span>
        {card.tipo_participante && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-semibold ${
            isInvestidor
              ? "text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
              : "text-[#C9A84C] border-[#C9A84C]/40 bg-[#C9A84C]/10"
          }`}>
            {isInvestidor ? "Investidor" : "Vendedor"}
          </span>
        )}
      </div>
      <p className="text-sm font-bold text-[#C9A84C] mb-2">{formatM(card.value)}</p>
      {/* Probability bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[#7A8FA8]">Probabilidade</span>
          <span className="text-[10px] font-medium" style={{ color: probColor(card.probability) }}>{card.probability}%</span>
        </div>
        <div className="h-1 rounded-full bg-[#122036] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${card.probability}%`, background: probColor(card.probability) }} />
        </div>
      </div>
      <p className="text-[10px] text-[#7A8FA8] mb-2">{card.responsible}</p>

      {/* Footer: FORJA/KIT badges + botão de inserção de dados */}
      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#122036]">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(() => {
            if (!forjaStatus) return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#122036] text-[#7A8FA8]">FORJA Pendente</span>;
            if (forjaStatus === "APROVADO") return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">⚡ FORJA OK</span>;
            if (forjaStatus === "APROVADO_COM_RESSALVAS") return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">⚡ FORJA Res.</span>;
            if (forjaStatus === "BLOQUEADO") return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">⚡ Bloqueado</span>;
            return <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400">⚡ Pendente</span>;
          })()}
          {Boolean(card.asset_data?.kit_liberado) && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#C9A84C]/15 text-[#C9A84C]">KIT ✓</span>
          )}
        </div>

        {/* Botão de inserção / conciliação de dados OCR */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenForja(); }}
          title="Inserir / conciliar dados via OCR"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-[#C9A84C]/25 text-[#C9A84C]/70 hover:text-[#C9A84C] hover:border-[#C9A84C]/50 hover:bg-[#C9A84C]/8 transition-colors flex-shrink-0"
        >
          <DatabaseZap className="w-3 h-3" />
          <span className="text-[9px] font-bold uppercase tracking-wide">OCR</span>
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MesaMaClient({ userRole, initialDeals = [], userId = "", userName = "" }: { userRole: string; initialDeals?: MaCard[]; userId?: string; userName?: string }) {
  const [activeTab, setActiveTab] = useState<"kanban" | "conexoes" | "operadores" | "buyside">("kanban");
  const [cards, setCards] = useState<MaCard[]>(initialDeals);
  const [operators, setOperators] = useState<MesaOperator[]>([]);
  const [selectedCard, setSelectedCard] = useState<MaCard | null>(null);
  const [detailTab, setDetailTab] = useState<"detalhes" | "forja" | "criativos" | "contrato" | "matches" | "analytics" | "qa" | "doc-requests" | "timeline" | "business-plan" | "chat-ia">("detalhes");
  const [showNewCard, setShowNewCard] = useState(false);
  const [showFullForm, setShowFullForm] = useState(false);
  const [showNewOp, setShowNewOp] = useState(false);
  const [maStages] = useState<MaStage[]>(MA_STAGES_DEFAULT);
  // Edit state
  const [editingCard, setEditingCard] = useState(false);
  const [editData, setEditData] = useState({ sector: "", value: "", probability: "", notes: "", assigned_to: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  // Partners disponíveis para atribuição
  const [partners, setPartners] = useState<{ id: string; name: string; role: string }[]>([]);

  // Busca dados do banco ao montar — mesma lógica do MaClient que funciona
  useEffect(() => {
    fetch("/api/ma-deals")
      .then(r => r.json())
      .then(({ deals: fresh }) => {
        if (!Array.isArray(fresh)) return;
        setCards(fresh.map((d: Record<string, unknown>) => {
          const STAGE_MAP: Record<string, string> = {
            PROSPECTING: "prospeccao", QUALIFICATION: "qualificacao",
            IOI: "viabilidade", DUE_DILIGENCE: "due_diligence",
            PROPOSAL: "estruturacao", NEGOTIATION: "negociacao",
            CLOSING: "aprovacao", CLOSED_WON: "aprovacao", CLOSED_LOST: "aprovacao",
          };
          const rawStage = d.stage as string;
          const assetData = (d.asset_data ?? {}) as Record<string, unknown>;
          return {
            id: d.id as string,
            code: d.code as string,
            company: (d.target_company ?? d.title ?? "Sem nome") as string,
            sector: (d.sector ?? "") as string,
            value: (d.deal_value ?? 0) as number,
            stage: STAGE_MAP[rawStage] ?? rawStage ?? "prospeccao",
            dbStage: rawStage,
            responsible: (() => {
              const p = d.partner;
              if (Array.isArray(p as unknown[])) return ((p as {full_name?: string}[])[0])?.full_name ?? userName;
              return (p as { full_name?: string } | null)?.full_name ?? userName;
            })(),
            assigned_to_id: (d.assigned_to as string) ?? undefined,
            probability: (d.probability_percent ?? 0) as number,
            createdAt: ((d.created_at as string) ?? "").split("T")[0],
            notes: (d.notes ?? "") as string,
            comments: Array.isArray(d.comments) ? d.comments as DealComment[] : [],
            asset_data: assetData,
            location: (d.location ?? "") as string,
            tipo_participante: assetData?.tipo_participante as string | undefined,
          };
        }));
      })
      .catch(() => {});

    // Busca partners disponíveis para atribuição
    fetch("/api/usuarios")
      .then(r => r.json())
      .then((data: { id: string; full_name: string | null; role: string }[]) => {
        if (!Array.isArray(data)) return;
        setPartners(
          data
            .filter(u => ["PARTNER", "PARTNER_PRO", "ADMIN", "GESTAO"].includes(u.role))
            .map(u => ({ id: u.id, name: u.full_name ?? u.id, role: u.role }))
        );
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New card form
  const [newCard, setNewCard] = useState({ company: "", sector: "Fintech", value: "", stage: "", responsible: "", notes: "" });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newOp, setNewOp] = useState({ name: "", email: "", role: "Analista" });

  // Documentos do card selecionado
  type DocEntry = { doc_id: string; file_name: string; url: string | null; uploaded_at: string };
  const [cardDocs, setCardDocs] = useState<DocEntry[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [copiedDoc, setCopiedDoc] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>("Due_Diligence");
  const detailFileRef = useRef<HTMLInputElement>(null);
  const DOC_CATEGORIES: { value: string; label: string }[] = [
    { value: "NDA", label: "NDA" },
    { value: "Teaser", label: "Teaser" },
    { value: "CIM", label: "CIM" },
    { value: "Due_Diligence", label: "Due Diligence" },
    { value: "Propostas", label: "Propostas" },
    { value: "Contrato", label: "Contrato" },
    { value: "Closing", label: "Closing" },
  ];

  // Comentários
  const [newComment, setNewComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  // Excluir deal
  const [deletingCard, setDeletingCard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [showKitOverride, setShowKitOverride] = useState(false);
  const [overrideWord, setOverrideWord] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);

  // Transferência de deal
  const [showTransferDeal, setShowTransferDeal] = useState(false);
  const [transferForm, setTransferForm] = useState({
    new_partner_id: "", new_partner_name: "", new_partner_email: "",
    motivo: "cadastro_mesa", justificativa: "", confirmar: false,
    modo: "existente" as "existente" | "externo",
  });
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferOk, setTransferOk] = useState(false);

  // Badge de não lidos por deal na aba Timeline
  const [timelineUnread, setTimelineUnread] = useState<Record<string, number>>({});

  // n8n warm-up (cold start Render)
  type WarmupStatus = "idle" | "pinging" | "online" | "warming" | "error";
  const [warmupStatus, setWarmupStatus] = useState<WarmupStatus>("idle");
  const [warmupElapsed, setWarmupElapsed] = useState<number | null>(null);
  const [warmupCountdown, setWarmupCountdown] = useState(0);

  // Link de upload externo (gerado pelo botão no tab FORJA)
  const [uploadLinkUrl, setUploadLinkUrl]         = useState<string | null>(null);
  const [uploadLinkLoading, setUploadLinkLoading] = useState(false);
  const [uploadLinkCopied, setUploadLinkCopied]   = useState(false);

  // Contexto FORJA — campo livre por deal
  const [ctxForja, setCtxForja]   = useState("");
  const [ctxSaving, setCtxSaving] = useState(false);
  const [ctxOk, setCtxOk]         = useState(false);

  // Enviar para Securitizadora
  type IntegrationPartner = {
    id: string; name: string; display_name: string;
    crm_type: string; active: boolean; sla_days: number; has_api_key: boolean;
  };
  type SubmitResult = {
    submission_id: string; vdr_url: string; sla_deadline: string;
    pipedrive_sent: boolean; partner: { display_name: string; active: boolean };
  };
  const [showSubmitPartner, setShowSubmitPartner] = useState(false);
  const [integrationPartners, setIntegrationPartners] = useState<IntegrationPartner[]>([]);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>("");
  const [submitPartnerLoading, setSubmitPartnerLoading] = useState(false);
  const [submitPartnerResult, setSubmitPartnerResult] = useState<SubmitResult | null>(null);
  const [submitPartnerError, setSubmitPartnerError] = useState<string | null>(null);
  const [submitPartnersLoading, setSubmitPartnersLoading] = useState(false);

  // Teaser Cego
  const [showTeaserCego, setShowTeaserCego] = useState(false);
  const [teaserForm, setTeaserForm] = useState({
    apelido: "", setor: "Real Estate", uf: "", tipo: "Venda de Participação",
    valor: "", descricao: "", contato_nome: "", contato_telefone: "",
  });
  const [teaserSaving, setTeaserSaving] = useState(false);
  const [teaserError, setTeaserError] = useState<string | null>(null);

  const handleWarmup = async () => {
    setWarmupStatus("pinging");
    setWarmupElapsed(null);
    setWarmupCountdown(0);
    try {
      const res = await fetch("/api/ma/n8n-warmup", { method: "POST" });
      const json = await res.json() as { status: string; elapsed_ms?: number };
      if (json.status === "online") {
        setWarmupStatus("online");
        setWarmupElapsed(json.elapsed_ms ?? null);
        setTimeout(() => setWarmupStatus("idle"), 8000);
      } else if (json.status === "warming") {
        // Render está acordando — conta regressiva de 35s e re-pinga
        setWarmupStatus("warming");
        let secs = 35;
        setWarmupCountdown(secs);
        const interval = setInterval(() => {
          secs -= 1;
          setWarmupCountdown(secs);
          if (secs <= 0) {
            clearInterval(interval);
            setWarmupStatus("pinging");
            fetch("/api/ma/n8n-warmup", { method: "POST" })
              .then(r => r.json())
              .then((j: { status: string; elapsed_ms?: number }) => {
                if (j.status === "online") {
                  setWarmupStatus("online");
                  setWarmupElapsed(j.elapsed_ms ?? null);
                  setTimeout(() => setWarmupStatus("idle"), 8000);
                } else {
                  setWarmupStatus("error");
                  setTimeout(() => setWarmupStatus("idle"), 6000);
                }
              })
              .catch(() => { setWarmupStatus("error"); setTimeout(() => setWarmupStatus("idle"), 6000); });
          }
        }, 1000);
      } else {
        setWarmupStatus("error");
        setTimeout(() => setWarmupStatus("idle"), 6000);
      }
    } catch {
      setWarmupStatus("error");
      setTimeout(() => setWarmupStatus("idle"), 6000);
    }
  };

  useEffect(() => {
    if (!selectedCard) { setCardDocs([]); setDetailTab("detalhes"); setEditingCard(false); return; }
    setUploadLinkUrl(null);
    // Busca contagem de notificações não lidas para o badge da aba Timeline
    fetch(`/api/ma/timeline?deal_id=${selectedCard.id}&count_only=true`)
      .then(r => r.json())
      .then(({ unread_count }: { unread_count?: number }) => {
        if (typeof unread_count === "number" && unread_count > 0) {
          setTimelineUnread(prev => ({ ...prev, [selectedCard.id]: unread_count }));
        }
      })
      .catch(() => {});
    // Inicializa contexto FORJA do card selecionado
    setCtxForja(((selectedCard.asset_data as Record<string,unknown> | undefined)?.contexto_forja as string) ?? "");
    setDocsLoading(true);
    fetch(`/api/ma/documents?deal_id=${selectedCard.id}`)
      .then(r => r.json())
      .then(({ documents }) => setCardDocs(Array.isArray(documents) ? documents : []))
      .catch(() => setCardDocs([]))
      .finally(() => setDocsLoading(false));
    setEditData({
      sector: selectedCard.sector ?? "",
      value: selectedCard.value ? String(selectedCard.value) : "",
      probability: selectedCard.probability ? String(selectedCard.probability) : "",
      notes: selectedCard.notes ?? "",
      assigned_to: selectedCard.assigned_to_id ?? "",
    });
  }, [selectedCard?.id]);

  const handleSaveEdit = async () => {
    if (!selectedCard) return;
    setEditSaving(true);
    const payload: Record<string, unknown> = { id: selectedCard.id };
    if (editData.sector) payload.sector = editData.sector;
    if (editData.value) payload.deal_value = Number(editData.value);
    if (editData.probability) payload.probability_percent = Number(editData.probability);
    payload.notes = editData.notes;
    if (editData.assigned_to) payload.assigned_to = editData.assigned_to;
    const newResponsible = partners.find(p => p.id === editData.assigned_to)?.name ?? selectedCard.responsible;
    try {
      await fetch("/api/ma-deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setCards(prev => prev.map(c => c.id === selectedCard.id ? {
        ...c,
        sector: editData.sector || c.sector,
        value: editData.value ? Number(editData.value) : c.value,
        probability: editData.probability ? Number(editData.probability) : c.probability,
        notes: editData.notes,
        responsible: editData.assigned_to ? newResponsible : c.responsible,
        assigned_to_id: editData.assigned_to || c.assigned_to_id,
      } : c));
      setSelectedCard(prev => prev ? {
        ...prev,
        sector: editData.sector || prev.sector,
        value: editData.value ? Number(editData.value) : prev.value,
        probability: editData.probability ? Number(editData.probability) : prev.probability,
        notes: editData.notes,
        responsible: editData.assigned_to ? newResponsible : prev.responsible,
        assigned_to_id: editData.assigned_to || prev.assigned_to_id,
      } : null);
      setEditSuccess(true);
      setEditingCard(false);
      setTimeout(() => setEditSuccess(false), 3000);
    } catch {}
    setEditSaving(false);
  };

  const totalValue = cards.reduce((a, c) => a + c.value, 0);
  const avgProb = cards.length ? Math.round(cards.reduce((a, c) => a + c.probability, 0) / cards.length) : 0;
  const lastStageId = maStages[maStages.length - 1]?.id ?? "closing";

  const handleMoveStage = (card: MaCard, targetStageId: string) => {
    if (targetStageId === card.stage) return;
    const newProb = STAGE_DEFAULT_PROBABILITY[targetStageId] ?? card.probability;
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, stage: targetStageId, probability: newProb } : c));
    setSelectedCard(prev => prev ? { ...prev, stage: targetStageId, probability: newProb } : null);

    const dbStage = PIPELINE_TO_DB[targetStageId];
    if (dbStage) {
      fetch("/api/ma-deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: card.id, stage: dbStage, probability_percent: newProb }),
      }).catch(() => {});
    }
  };

  const handleAdvanceStage = (card: MaCard) => {
    const next = nextStage(card.stage, maStages);
    if (!next) return;
    handleMoveStage(card, next);
  };

  const handleDeleteCard = async (card: MaCard) => {
    setDeletingCard(true);
    try {
      await fetch(`/api/ma-deals?id=${card.id}`, { method: "DELETE" });
      setCards(prev => prev.filter(c => c.id !== card.id));
      setSelectedCard(null);
      setConfirmDelete(false);
    } catch {}
    setDeletingCard(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedCard) return;
    setSavingComment(true);
    const comment: DealComment = {
      id: `cmt_${Date.now()}`,
      text: newComment.trim(),
      author: userName,
      created_at: new Date().toISOString(),
    };
    const updatedComments = [...(selectedCard.comments ?? []), comment];
    try {
      const res = await fetch("/api/ma-deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedCard.id, comments: updatedComments }),
      });
      const json = await res.json();
      if (json.ok) {
        setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, comments: updatedComments } : c));
        setSelectedCard(prev => prev ? { ...prev, comments: updatedComments } : null);
        setNewComment("");
      }
    } catch {}
    setSavingComment(false);
  };

  const handleCreateCard = async () => {
    if (!newCard.company || !newCard.value) return;
    const defaultStage = newCard.stage || maStages[0]?.id || "prospeccao";
    setIsCreating(true);

    let createdId: string | null = null;

    try {
      const res = await fetch("/api/ma-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: newCard.company,
          sector: newCard.sector,
          value: Number(newCard.value),
          notes: newCard.notes,
          responsible: newCard.responsible,
        }),
      });
      const json = await res.json();
      if (json.card) {
        createdId = json.card.id;
        setCards(prev => [...prev, { ...json.card, stage: defaultStage }]);
      }
    } catch {}

    // Fallback local se API falhar
    if (!createdId) {
      const card: MaCard = {
        id: `ma-${Date.now()}`,
        code: `MA-26-${String(cards.length + 1).padStart(3, "0")}`,
        company: newCard.company,
        sector: newCard.sector,
        value: Number(newCard.value),
        stage: defaultStage,
        responsible: userName || newCard.responsible,
        probability: 10,
        createdAt: new Date().toISOString().split("T")[0],
        notes: newCard.notes,
      };
      setCards(prev => [...prev, card]);
    }

    // Upload dos arquivos pendentes (se houver deal salvo no banco)
    if (createdId && pendingFiles.length > 0) {
      for (const file of pendingFiles) {
        const form = new FormData();
        form.append("file", file);
        form.append("deal_id", createdId);
        form.append("doc_id", `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        await fetch("/api/ma/documents", { method: "POST", body: form }).catch(() => {});
      }
    }

    setNewCard({ company: "", sector: "Fintech", value: "", stage: "", responsible: "", notes: "" });
    setPendingFiles([]);
    setIsCreating(false);
    setShowNewCard(false);
  };

  const handleCreateOp = () => {
    if (!newOp.name || !newOp.email) return;
    const op: MesaOperator = {
      id: `op-ma-${Date.now()}`,
      name: newOp.name,
      email: newOp.email,
      role: newOp.role,
      status: "offline",
      assignedCards: 0,
    };
    setOperators(prev => [...prev, op]);
    setNewOp({ name: "", email: "", role: "Analista" });
    setShowNewOp(false);
  };

  const handleNovaOperacao = () => {
    setShowNewCard(true);
  };

  const tabs = [
    { id: "kanban" as const, label: "Kanban" },
    { id: "conexoes" as const, label: "Conexões / Match" },
    { id: "buyside" as const, label: "Buy-Side" },
    { id: "operadores" as const, label: "Operadores" },
  ];

  return (
    <div className="min-h-screen bg-[#09081A] text-[#E8EDF5]">
      {/* Header */}
      <div className="border-b border-[#122036] bg-[#091221] px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center">
              <Building2 size={18} className="text-[#C9A84C]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#E8EDF5]">Mesa M&A</h1>
              <p className="text-xs text-[#7A8FA8]">Fusões & Aquisições</p>
            </div>
          </div>
          {(activeTab === "kanban" || activeTab === "conexoes") && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowTeaserCego(true); setTeaserError(null); }}
                className="flex items-center gap-2 rounded-lg border border-[#7A8FA8]/40 text-[#7A8FA8] text-xs font-semibold px-3 py-2 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                title="Cadastrar oportunidade pontual sem necessidade de securitização"
              >
                <FileSignature size={14} />
                Teaser Cego
              </button>
              <button
                onClick={() => setShowNewCard(true)}
                className="flex items-center gap-2 rounded-lg border border-[#C9A84C]/40 text-[#C9A84C] text-xs font-semibold px-3 py-2 hover:bg-[#C9A84C]/10 transition-colors"
              >
                <Plus size={14} />
                Rápido
              </button>
              <button
                onClick={() => setShowFullForm(true)}
                className="flex items-center gap-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-semibold px-4 py-2 hover:bg-[#E8C97A] transition-colors"
              >
                <Plus size={14} />
                Novo Deal Completo
              </button>
            </div>
          )}
          {activeTab === "operadores" && (
            <button
              onClick={() => setShowNewOp(true)}
              className="flex items-center gap-2 rounded-lg border border-[#122036] bg-[#0F1E35] text-xs font-medium px-4 py-2 hover:border-[#C9A84C]/50 hover:text-[#C9A84C] transition-colors"
            >
              <Plus size={14} />
              Adicionar Operador
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#C9A84C] text-[#C9A84C]"
                  : "border-transparent text-[#7A8FA8] hover:text-[#E8EDF5]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {/* ── KANBAN TAB ─────────────────────────────────────── */}
        {activeTab === "kanban" && (
          <div>
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="rounded-xl border border-[#122036] bg-[#091221] p-4">
                <p className="text-xs text-[#7A8FA8] mb-1">Total de Operações</p>
                <p className="text-2xl font-bold text-[#E8EDF5]">{cards.length}</p>
              </div>
              <div className="rounded-xl border border-[#122036] bg-[#091221] p-4">
                <p className="text-xs text-[#7A8FA8] mb-1">Volume Total</p>
                <p className="text-2xl font-bold text-[#C9A84C]">{formatM(totalValue)}</p>
              </div>
              <div className="rounded-xl border border-[#122036] bg-[#091221] p-4">
                <p className="text-xs text-[#7A8FA8] mb-1">Em Closing</p>
                <p className="text-2xl font-bold text-emerald-400">{cards.filter(c => c.stage === "closing").length}</p>
              </div>
              <div className="rounded-xl border border-[#122036] bg-[#091221] p-4">
                <p className="text-xs text-[#7A8FA8] mb-1">Prob. Média</p>
                <p className="text-2xl font-bold" style={{ color: probColor(avgProb) }}>{avgProb}%</p>
              </div>
            </div>

            {/* Kanban Board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
              {maStages.map(stage => {
                const stageCards = cards.filter(c => c.stage === stage.id);
                return (
                  <div key={stage.id} className="flex-shrink-0 w-64">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                      <span className="text-xs font-semibold text-[#E8EDF5] flex-1">{stage.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ color: stage.color, background: stage.bg }}>
                        {stageCards.length}
                      </span>
                    </div>
                    {/* Cards */}
                    <div className="space-y-2 min-h-[100px] rounded-xl border border-[#122036]/60 bg-[#09081A]/50 p-2">
                      {stageCards.map(card => (
                        <KanbanCardItem
                          key={card.id}
                          card={card}
                          stages={maStages}
                          onClick={() => setSelectedCard(card)}
                          onOpenForja={() => { setDetailTab("forja"); setSelectedCard(card); }}
                        />
                      ))}
                      {stageCards.length === 0 && (
                        <div className="h-16 flex items-center justify-center">
                          <p className="text-[11px] text-[#7A8FA8]">Sem operações</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── CONEXÕES / MATCH TAB ───────────────────────────── */}
        {activeTab === "conexoes" && (() => {
          const vendedores = cards.filter(c => c.tipo_participante === "Vendedor");
          const investidores = cards.filter(c => c.tipo_participante === "Investidor");
          const matches: { investidor: MaCard; vendedor: MaCard }[] = [];
          for (const inv of investidores) {
            for (const vend of vendedores) {
              if (inv.sector && vend.sector && inv.sector === vend.sector) {
                matches.push({ investidor: inv, vendedor: vend });
              }
            }
          }
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-2 p-4 rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5">
                <ArrowLeftRight size={16} className="text-[#C9A84C]" />
                <div>
                  <p className="text-sm font-bold text-[#E8EDF5]">Conexões por Segmento</p>
                  <p className="text-xs text-[#7A8FA8]">Match automático entre Investidores e Vendedores no mesmo setor</p>
                </div>
                <div className="ml-auto flex gap-3 text-center">
                  <div><p className="text-lg font-bold text-emerald-400">{investidores.length}</p><p className="text-[10px] text-[#7A8FA8]">Investidores</p></div>
                  <div><p className="text-lg font-bold text-[#C9A84C]">{vendedores.length}</p><p className="text-[10px] text-[#7A8FA8]">Vendedores</p></div>
                  <div><p className="text-lg font-bold text-purple-400">{matches.length}</p><p className="text-[10px] text-[#7A8FA8]">Matches</p></div>
                </div>
              </div>
              {matches.length === 0 ? (
                <div className="text-center py-16 rounded-xl border border-dashed border-[#122036]">
                  <ArrowLeftRight size={28} className="text-[#5A7490] mx-auto mb-3 opacity-40" />
                  <p className="text-[#5A7490] text-sm">Nenhum match encontrado ainda.</p>
                  <p className="text-[#5A7490] text-xs mt-1">Cadastre deals como Investidor ou Vendedor no mesmo setor para gerar conexões.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.map((m, i) => (
                    <div key={i} className="rounded-xl border border-[#122036] bg-[#091221] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-[#C9A84C]/15 text-[#C9A84C]">
                          {m.investidor.sector}
                        </span>
                        <span className="text-[10px] text-[#5A7490]">Match #{i + 1}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                          <p className="text-[10px] font-bold text-emerald-400 mb-1 flex items-center gap-1">
                            <ArrowLeftRight size={9} /> INVESTIDOR
                          </p>
                          <p className="text-xs font-semibold text-[#E8EDF5]">{m.investidor.company}</p>
                          <p className="text-xs text-[#C9A84C] font-bold mt-1">{formatM(m.investidor.value)}</p>
                          <p className="text-[10px] text-[#7A8FA8] mt-1">{m.investidor.code}</p>
                        </div>
                        <div className="rounded-lg border border-[#C9A84C]/20 bg-[#C9A84C]/5 p-3">
                          <p className="text-[10px] font-bold text-[#C9A84C] mb-1 flex items-center gap-1">
                            <Building2 size={9} /> VENDEDOR
                          </p>
                          <p className="text-xs font-semibold text-[#E8EDF5]">{m.vendedor.company}</p>
                          <p className="text-xs text-[#C9A84C] font-bold mt-1">{formatM(m.vendedor.value)}</p>
                          <p className="text-[10px] text-[#7A8FA8] mt-1">{m.vendedor.code}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── BUY-SIDE TAB ───────────────────────────────────── */}
        {activeTab === "buyside" && (
          <BuysideDemandPanel />
        )}

        {/* ── OPERADORES TAB ─────────────────────────────────── */}
        {activeTab === "operadores" && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {operators.map(op => (
                <div key={op.id} className="rounded-xl border border-[#122036] bg-[#091221] p-5 relative group hover:border-[#C9A84C]/40 transition-colors">
                  {/* Remove button (admin) */}
                  {userRole === "admin" && (
                    <button
                      onClick={() => setOperators(prev => prev.filter(o => o.id !== op.id))}
                      className="absolute top-3 right-3 text-[#7A8FA8] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  )}

                  {/* Avatar */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-[#C9A84C]">{initials(op.name)}</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#E8EDF5] truncate">{op.name}</p>
                      <p className="text-xs text-[#7A8FA8] truncate">{op.role}</p>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <Circle size={7} fill={statusColor(op.status)} stroke="none" />
                    <span className="text-xs" style={{ color: statusColor(op.status) }}>{statusLabel(op.status)}</span>
                  </div>

                  {/* Email */}
                  <div className="flex items-center gap-1.5 mb-3">
                    <Mail size={11} className="text-[#7A8FA8]" />
                    <span className="text-[11px] text-[#7A8FA8] truncate">{op.email}</span>
                  </div>

                  {/* Cards count */}
                  <div className="flex items-center gap-1.5">
                    <BarChart2 size={11} className="text-[#7A8FA8]" />
                    <span className="text-xs text-[#7A8FA8]">{op.assignedCards} card{op.assignedCards !== 1 ? "s" : ""} atribuído{op.assignedCards !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* ── CARD DETAIL MODAL ──────────────────────────────────── */}
      <Dialog open={!!selectedCard} onOpenChange={open => { if (!open) { setSelectedCard(null); setConfirmDelete(false); setEditingCard(false); } }}>
        <DialogContent
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="bg-[#091221] border-0 text-[#E8EDF5] w-screen h-screen max-w-none max-h-none rounded-none overflow-y-auto grid-cols-1 sm:rounded-none"
        >
          <DialogHeader className="min-w-0 w-full">
            <DialogTitle className="text-[#E8EDF5] flex items-center gap-2 flex-wrap min-w-0 w-full">
              <span className="break-words">{selectedCard?.company}</span>
              <span className="text-xs font-normal text-[#7A8FA8]">{selectedCard?.code}</span>
              {selectedCard?.tipo_participante && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedCard.tipo_participante === "Investidor"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-[#C9A84C]/15 text-[#C9A84C]"
                }`}>{selectedCard.tipo_participante}</span>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Tabs do detalhe */}
          {selectedCard && (
            <div className="flex border-b border-[#122036] mb-2 items-center">
              <div className="flex gap-0 overflow-x-auto flex-1">
                {([
                  { id: "detalhes" as const, label: "Detalhes", icon: <FileText size={12} /> },
                  { id: "forja" as const, label: "FORJA", icon: <Zap size={12} /> },
                  { id: "analytics" as const, label: "Analytics", icon: <BarChart2 size={12} /> },
                  { id: "business-plan" as const, label: "Business Plan", icon: <TrendingUp size={12} /> },
                  { id: "qa" as const, label: "Q&A", icon: <MessageSquare size={12} /> },
                  { id: "matches" as const, label: "Matches", icon: <ArrowLeftRight size={12} /> },
                  { id: "criativos" as const, label: "Criativos", icon: <FileImage size={12} /> },
                  { id: "contrato" as const, label: "NDA / Mandato", icon: <FileSignature size={12} /> },
                  { id: "doc-requests" as const, label: "Docs", icon: <FileText size={12} /> },
                  { id: "timeline" as const, label: "Timeline", icon: <Clock size={12} /> },
                  { id: "chat-ia" as const, label: "Chat IA", icon: <Bot size={12} /> },
                ]).map(tab => {
                  const isTimeline = tab.id === "timeline";
                  const unread = isTimeline && selectedCard ? (timelineUnread[selectedCard.id] ?? 0) : 0;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setDetailTab(tab.id);
                        if (isTimeline && selectedCard && unread > 0) {
                          fetch(`/api/ma/timeline?deal_id=${selectedCard.id}`, { method: "PATCH" }).catch(() => {});
                          setTimelineUnread(prev => ({ ...prev, [selectedCard.id]: 0 }));
                        }
                      }}
                      className={`relative flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors flex-shrink-0 ${
                        detailTab === tab.id
                          ? "border-[#C9A84C] text-[#C9A84C]"
                          : "border-transparent text-[#7A8FA8] hover:text-[#E8EDF5]"
                      }`}
                    >
                      {tab.icon}{tab.label}
                      {unread > 0 && (
                        <span className="ml-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[#C9A84C] text-[#09081A] text-[9px] font-bold px-1">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setDetailTab("forja")}
                title="Inserir / conciliar dados via OCR"
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1 mx-2 rounded border border-[#C9A84C]/30 text-[#C9A84C]/70 hover:text-[#C9A84C] hover:border-[#C9A84C]/60 hover:bg-[#C9A84C]/8 transition-colors"
              >
                <DatabaseZap className="w-3 h-3" />
                <span className="text-[9px] font-bold uppercase tracking-wide">OCR</span>
              </button>
            </div>
          )}

          {selectedCard && (() => {
            const stage = maStages.find(s => s.id === selectedCard.stage);
            const nextId = nextStage(selectedCard.stage, maStages);
            const nextStageData = nextId ? maStages.find(s => s.id === nextId) : null;

            // Objeto deal completo para ForjaPanel e ContratoPanel
            const dealObj = {
              id: selectedCard.id,
              code: selectedCard.code,
              target_company: selectedCard.company,
              sector: selectedCard.sector,
              deal_value: selectedCard.value,
              probability_percent: selectedCard.probability,
              stage: selectedCard.dbStage ?? selectedCard.stage,
              location: selectedCard.location ?? "",
              notes: selectedCard.notes ?? "",
              asset_data: selectedCard.asset_data ?? {},
              comments: selectedCard.comments ?? [],
            };

            if (detailTab === "forja") {
              const forjaStatus = (selectedCard.asset_data?.forja_status as string) ?? null;
              const kitLiberado = !!(selectedCard.asset_data?.kit_liberado);
              const forjaAprovado = forjaStatus === "APROVADO" || forjaStatus === "APROVADO_COM_RESSALVAS";
              return (
                <div className="mt-2 space-y-4">
                  <ForjaPanel
                    deal={dealObj}
                    dealId={selectedCard.id}
                    savedResult={(selectedCard.asset_data?.forja_result ?? null) as never}
                    onSaved={(result) => {
                      const newAssetData = {
                        ...(selectedCard.asset_data ?? {}),
                        forja_result: result,
                        forja_status: result.recommendation,
                        forja_score: result.score,
                      };
                      setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, asset_data: newAssetData } : c));
                      setSelectedCard(prev => prev ? { ...prev, asset_data: newAssetData } : null);
                    }}
                    onReportSaved={(reportUrl, generatedAt) => {
                      const prev = (selectedCard.asset_data?.forja_reports as Array<{url:string;generated_at:string}>) ?? [];
                      const newReports = [{ url: reportUrl, generated_at: generatedAt }, ...prev].slice(0, 10);
                      const newAssetData = { ...(selectedCard.asset_data ?? {}), forja_reports: newReports };
                      setCards(p => p.map(c => c.id === selectedCard.id ? { ...c, asset_data: newAssetData } : c));
                      setSelectedCard(p => p ? { ...p, asset_data: newAssetData } : null);
                    }}
                  />
                  {/* Gerar Link de Upload — sempre visível no tab FORJA */}
                  <div className="p-4 rounded-xl border border-[#122036] bg-[#091221]">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-[#E8EDF5] flex items-center gap-1.5">
                          <Upload size={13} className="text-[#C9A84C]" /> Link de Upload Externo
                        </p>
                        <p className="text-[10px] text-[#7A8FA8] mt-0.5">
                          {uploadLinkUrl
                            ? "Link válido por 14 dias — copie e envie ao cliente"
                            : "Link seguro para cliente enviar documentos sem login"}
                        </p>
                      </div>
                      {!uploadLinkUrl ? (
                        <button
                          onClick={async () => {
                            if (!selectedCard || uploadLinkLoading) return;
                            setUploadLinkLoading(true);
                            try {
                              const r = await fetch("/api/ma/upload-links", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ deal_id: selectedCard.id }),
                              });
                              const data = await r.json();
                              if (data.upload_url) setUploadLinkUrl(data.upload_url);
                            } catch {
                              // silencia — link não é crítico
                            } finally {
                              setUploadLinkLoading(false);
                            }
                          }}
                          disabled={uploadLinkLoading}
                          className="text-[10px] font-semibold text-[#C9A84C] px-3 py-1.5 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          {uploadLinkLoading ? "Gerando..." : "Gerar Link"}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (!uploadLinkUrl) return;
                            navigator.clipboard.writeText(uploadLinkUrl).catch(() => {});
                            setUploadLinkCopied(true);
                            setTimeout(() => setUploadLinkCopied(false), 2000);
                          }}
                          className="text-[10px] font-semibold px-3 py-1.5 rounded-lg border transition-colors flex-shrink-0 text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                        >
                          {uploadLinkCopied ? "✓ Copiado" : "Copiar Link"}
                        </button>
                      )}
                    </div>
                    {uploadLinkUrl && (
                      <p className="mt-2 text-[10px] text-[#C9A84C] font-mono bg-[#09081A] rounded px-2 py-1.5 truncate select-all">
                        {uploadLinkUrl}
                      </p>
                    )}
                  </div>

                  {/* Liberar / Bloquear KIT — aparece após FORJA validada */}
                  {forjaAprovado && (
                    <div className="p-4 rounded-xl border border-[#122036] bg-[#091221]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-[#E8EDF5] flex items-center gap-1.5">
                            <FileImage size={13} className="text-[#C9A84C]" /> Kit de Criativos
                          </p>
                          <p className="text-[10px] text-[#7A8FA8] mt-0.5">
                            {kitLiberado ? "Liberado para o partner" : "Libera acesso ao kit de divulgação na aba M&A do parceiro"}
                          </p>
                        </div>
                        {kitLiberado ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                              ✓ Liberado
                            </span>
                            <button
                              onClick={async () => {
                                if (!selectedCard) return;
                                await fetch("/api/ma/forja-kit", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ deal_id: selectedCard.id, action: "bloquear_kit" }),
                                }).catch(() => {});
                                const newAssetData = { ...(selectedCard.asset_data ?? {}), kit_liberado: false };
                                setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, asset_data: newAssetData } : c));
                                setSelectedCard(prev => prev ? { ...prev, asset_data: newAssetData } : null);
                              }}
                              className="text-[10px] text-red-400 px-2.5 py-1 rounded-lg border border-red-500/30 hover:bg-red-500/10 transition-colors"
                            >
                              Bloquear
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={async () => {
                              if (!selectedCard) return;
                              await fetch("/api/ma/forja-kit", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ deal_id: selectedCard.id, action: "liberar_kit" }),
                              }).catch(() => {});
                              const newAssetData = { ...(selectedCard.asset_data ?? {}), kit_liberado: true };
                              setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, asset_data: newAssetData } : c));
                              setSelectedCard(prev => prev ? { ...prev, asset_data: newAssetData } : null);
                            }}
                            className="text-[10px] font-semibold text-[#C9A84C] px-3 py-1.5 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors"
                          >
                            Liberar KIT
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Override manual — Head de M&A (ADMIN/GESTAO) quando score insuficiente */}
                  {!forjaAprovado && forjaStatus && !kitLiberado &&
                   (userRole === "ADMIN" || userRole === "GESTAO") && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                            <FileImage size={13} /> Liberação Manual — Head M&A
                          </p>
                          <p className="text-[10px] text-[#7A8FA8] mt-0.5">
                            Score {forjaStatus === "PENDENTE" ? "pendente" : "bloqueado"} — override disponível para gestão.
                            Esta ação substitui a validação automática do FORJA.
                          </p>
                        </div>
                        {!showKitOverride ? (
                          <button
                            onClick={() => { setShowKitOverride(true); setOverrideWord(""); }}
                            className="text-[10px] font-semibold text-amber-400 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-colors flex-shrink-0"
                          >
                            Override KIT
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowKitOverride(false)}
                            className="text-[10px] text-[#7A8FA8] hover:text-red-400 transition-colors flex-shrink-0"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>

                      {showKitOverride && (
                        <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2">
                          <p className="text-[10px] text-amber-400/80">
                            Digite <strong>LIBERAR</strong> para confirmar a liberação manual do kit:
                          </p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={overrideWord}
                              onChange={e => setOverrideWord(e.target.value.toUpperCase())}
                              placeholder="LIBERAR"
                              maxLength={7}
                              className="flex-1 bg-[#09081A] border border-amber-500/30 rounded-lg px-3 py-1.5 text-xs text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:border-amber-500/60 font-mono tracking-widest"
                            />
                            <button
                              disabled={overrideWord !== "LIBERAR" || overrideLoading}
                              onClick={async () => {
                                if (!selectedCard || overrideWord !== "LIBERAR") return;
                                setOverrideLoading(true);
                                try {
                                  await fetch("/api/ma/forja-kit", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ deal_id: selectedCard.id, action: "liberar_kit" }),
                                  });
                                  const newAssetData = { ...(selectedCard.asset_data ?? {}), kit_liberado: true, kit_override: true, kit_override_by: userName };
                                  setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, asset_data: newAssetData } : c));
                                  setSelectedCard(prev => prev ? { ...prev, asset_data: newAssetData } : null);
                                  setShowKitOverride(false);
                                  setOverrideWord("");
                                } finally {
                                  setOverrideLoading(false);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-amber-500 text-[#09081A] hover:bg-amber-400"
                            >
                              {overrideLoading ? "..." : "Confirmar"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            if (detailTab === "matches") {
              return (
                <div className="mt-2">
                  <InvestorMatchPanel
                    dealId={selectedCard.id}
                    dealCode={selectedCard.code}
                  />
                </div>
              );
            }

            if (detailTab === "criativos") {
              return (
                <div className="mt-2 space-y-4">
                  <div className="rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 p-4">
                    <p className="text-xs font-bold text-[#C9A84C] mb-1 flex items-center gap-1.5"><FileImage size={13} /> Kit de Criativos</p>
                    <p className="text-xs text-[#7A8FA8] mb-3">Gerar CIM · Teaser · LinkedIn Post · Story — PT-BR e EN</p>
                    <a
                      href={`/ma/${selectedCard.id}/criativos`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold px-4 py-2 hover:bg-[#E8C97A] transition-colors"
                    >
                      <FileImage size={13} /> Acessar Criativos
                    </a>
                  </div>
                  {/* Documentos anexados ao deal */}
                  <div>
                    <p className="text-xs font-semibold text-[#7A8FA8] mb-2 flex items-center gap-1.5"><Paperclip size={12} /> Documentos Anexados</p>
                    {cardDocs.length === 0 ? (
                      <p className="text-xs text-[#5A7490]">Nenhum documento anexado ainda.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {cardDocs.map(doc => (
                          <div key={doc.doc_id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#0F1E35] border border-[#122036]">
                            <Paperclip size={12} className="text-[#C9A84C] flex-shrink-0" />
                            <span className="text-xs text-[#E8EDF5] flex-1 truncate">{doc.file_name}</span>
                            {doc.url && (
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-[#7A8FA8] hover:text-[#C9A84C] transition-colors">
                                <ExternalLink size={12} />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (detailTab === "analytics") {
              return (
                <div className="mt-2">
                  <DealAnalyticsPanel dealId={selectedCard.id} />
                </div>
              );
            }

            if (detailTab === "business-plan") {
              const intakeToken = (selectedCard.asset_data as Record<string, unknown>)?.bp_intake_token as string | undefined;
              const intakeUrl = intakeToken
                ? `${typeof window !== "undefined" ? window.location.origin : "https://app.v3partners.com.br"}/intake/bp/${intakeToken}`
                : null;

              return (
                <div className="mt-2 space-y-3">
                  {/* Gerar Link de Intake */}
                  <div className="p-3 rounded-xl border border-[#243A66] bg-[#162744]">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-semibold text-[#E8C97A]">Link de Captação de KPIs</p>
                        <p className="text-[9px] text-[#9BAFC5] mt-0.5">
                          Envie ao contador ou equipe financeira do deal para preenchimento remoto
                        </p>
                      </div>
                      {intakeUrl ? (
                        <button
                          onClick={() => { navigator.clipboard.writeText(intakeUrl); }}
                          className="flex items-center gap-1 text-[9px] font-semibold text-[#C9A84C] px-2.5 py-1 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors flex-shrink-0"
                        >
                          <Copy size={10} /> Copiar link
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            if (!selectedCard) return;
                            const res = await fetch("/api/ma/bp-intake/generate", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ deal_id: selectedCard.id }),
                            });
                            const json = await res.json();
                            if (res.ok && json.token) {
                              const newAssetData = { ...(selectedCard.asset_data ?? {}), bp_intake_token: json.token, bp_intake_expires_at: json.expires_at };
                              setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, asset_data: newAssetData } : c));
                              setSelectedCard(prev => prev ? { ...prev, asset_data: newAssetData } : null);
                            }
                          }}
                          className="text-[9px] font-semibold text-[#C9A84C] px-2.5 py-1 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors flex-shrink-0"
                        >
                          Gerar Link
                        </button>
                      )}
                    </div>
                    {intakeUrl && (
                      <p className="text-[8px] mt-1.5 truncate" style={{ color: "#9BAFC5" }}>{intakeUrl}</p>
                    )}
                  </div>

                  <BusinessPlanContainer
                    dealId={selectedCard.id}
                    dealCode={selectedCard.code}
                    sector={selectedCard.sector}
                    userRole={userRole}
                  />
                </div>
              );
            }

            if (detailTab === "qa") {
              return (
                <div className="mt-2">
                  <DealQAPanel dealId={selectedCard.id} userRole={userRole} />
                </div>
              );
            }

            if (detailTab === "contrato") {
              return (
                <div className="mt-2 space-y-4">
                  {/* Deal Room VDR */}
                  <DealRoomPanel dealId={selectedCard.id} dealCode={selectedCard.code} userRole={userRole} />
                  <ContratoPanel deal={dealObj} dealCode={selectedCard.code} isDemo={false} />
                  {/* Liberar Kit de Criativos */}
                  <div className="p-4 rounded-xl border border-[#122036] bg-[#091221]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-[#E8EDF5]">Kit de Criativos</p>
                        <p className="text-[10px] text-[#7A8FA8] mt-0.5">Libera acesso ao kit de divulgação na aba M&A do parceiro</p>
                      </div>
                      {(selectedCard?.asset_data as Record<string, unknown>)?.kit_liberado ? (
                        <span className="text-[10px] font-semibold text-emerald-400 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          ✓ Liberado
                        </span>
                      ) : (
                        <button
                          onClick={async () => {
                            if (!selectedCard) return;
                            const newAssetData = { ...(selectedCard.asset_data ?? {}), kit_liberado: true };
                            await fetch("/api/ma-deals", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: selectedCard.id, asset_data: newAssetData }),
                            }).catch(() => {});
                            setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, asset_data: newAssetData } : c));
                            setSelectedCard(prev => prev ? { ...prev, asset_data: newAssetData } : null);
                          }}
                          className="text-[10px] font-semibold text-[#C9A84C] px-3 py-1.5 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors"
                        >
                          Liberar Kit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            if (detailTab === "timeline") {
              return (
                <div className="mt-2">
                  <DealTimeline dealId={selectedCard.id} />
                </div>
              );
            }

            if (detailTab === "doc-requests") {
              type MF = { field: string; impact: string; priority: "ALTA" | "MEDIA" | "BAIXA" };
              const forjaResult = selectedCard.asset_data?.forja_result as { missing?: MF[] } | null;
              const missingFields: MF[] = forjaResult?.missing ?? [];
              return (
                <div className="mt-2">
                  <DocumentRequestPanel
                    dealId={selectedCard.id}
                    dealCode={selectedCard.code ?? selectedCard.id.slice(0, 8).toUpperCase()}
                    missingFields={missingFields}
                    forjaSnapshotAt={(selectedCard.asset_data?.forja_validated_at as string) ?? null}
                  />
                </div>
              );
            }

            if (detailTab === "chat-ia") {
              return (
                <div className="mt-2">
                  <DealIaChat dealId={selectedCard.id} dealTitle={selectedCard.company} />
                </div>
              );
            }

            // ── TAB DETALHES ──
            return (
              <div className="space-y-4 mt-2">
                {editSuccess && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                    <Check size={12} /> Informações atualizadas com sucesso!
                  </div>
                )}

                {/* ── Contexto para o FORJA ─────────────────────── */}
                <div className="rounded-xl border border-[#C9A84C]/20 bg-[#09081A] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Zap size={12} className="text-[#C9A84C]" />
                      <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C]">Contexto para o FORJA</p>
                    </div>
                    {ctxOk && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Check size={10} />Salvo</span>}
                  </div>
                  <textarea
                    value={ctxForja}
                    onChange={e => setCtxForja(e.target.value)}
                    rows={3}
                    placeholder="Adicione contexto que o FORJA deve considerar: situação do vendedor, urgência, interesse de compradores, restrições, tese preliminar, condições especiais..."
                    className="w-full rounded-lg border border-[#243A66] bg-[#111F35] text-[#E8EDF5] text-xs px-3 py-2 placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C] transition-colors resize-none"
                  />
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-[#7A8FA8]">Injetado no prompt do FORJA antes da validação.</p>
                    <button
                      onClick={async () => {
                        setCtxSaving(true);
                        try {
                          const newAssetData = { ...(selectedCard.asset_data as Record<string,unknown> ?? {}), contexto_forja: ctxForja };
                          await fetch("/api/ma-deals", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: selectedCard.id, asset_data: newAssetData }),
                          });
                          setCards(prev => prev.map(c => c.id === selectedCard.id ? { ...c, asset_data: newAssetData } : c));
                          setSelectedCard(prev => prev ? { ...prev, asset_data: newAssetData } : null);
                          setCtxOk(true);
                          setTimeout(() => setCtxOk(false), 2500);
                        } catch { /* silencioso */ }
                        setCtxSaving(false);
                      }}
                      disabled={ctxSaving}
                      className="flex items-center gap-1.5 text-[10px] font-semibold text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C]/30 px-3 py-1.5 rounded-lg hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {ctxSaving ? <><Loader2 size={10} className="animate-spin" />Salvando</> : <><Check size={10} />Salvar Contexto</>}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#7A8FA8] mb-1">Setor</p>
                    <p className="text-sm font-medium text-[#E8EDF5]">{selectedCard.sector}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#7A8FA8] mb-1">Valor</p>
                    <p className="text-sm font-bold text-[#C9A84C]">{formatM(selectedCard.value)}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#7A8FA8] mb-1">Etapa atual</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: stage?.color, background: stage?.bg }}>
                      {stage?.label ?? selectedCard.stage}
                    </span>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#7A8FA8] mb-1">Responsável</p>
                    <p className="text-sm text-[#E8EDF5]">{selectedCard.responsible}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#7A8FA8] mb-1">Probabilidade</p>
                    <p className="text-sm font-bold" style={{ color: probColor(selectedCard.probability) }}>{selectedCard.probability}%</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#7A8FA8] mb-1">Data de entrada</p>
                    <p className="text-sm text-[#E8EDF5]">{formatDate(selectedCard.createdAt)}</p>
                  </div>
                </div>

                {/* ── Dados do Formulário M&A — 6 Passos ── */}
                {(() => {
                  type AdTyped = {
                    tipo_participante?: string; tipoOperacao?: string; cnpj?: string; founding_year?: string;
                    descricao_ptbr?: string; produtos_servicos?: string; diferenciais?: string[]; mercado_atendido?: string;
                    financeiro?: { receita?: Record<string, string>; ebitda?: Record<string, string>; lucro?: Record<string, string> };
                    divida_total?: string;
                    juridico?: { licencas?: string; tem_processos?: boolean; detalhes_processos?: string; tem_pendencias?: boolean };
                    contato?: { nome?: string; email?: string; telefone?: string };
                    comissionamento?: string; info_adicionais?: string;
                    documentos?: { nome: string; tamanho: number }[];
                  };
                  const ad = (selectedCard.asset_data ?? {}) as AdTyped;
                  const fin = ad.financeiro;
                  const anos = ["2023", "2024", "2025"];
                  const hasFin = fin && anos.some(a => fin.receita?.[a] || fin.ebitda?.[a] || fin.lucro?.[a]);
                  const fmtV = (v?: string) => v ? `R$ ${v}` : "—";
                  const jur = ad.juridico;
                  const ct = ad.contato;
                  const difArr = Array.isArray(ad.diferenciais) ? ad.diferenciais : [];

                  return (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C]">Dados do Formulário</p>

                      {/* Identificação */}
                      <div className="rounded-xl border border-[#122036] bg-[#0F1E35] p-3">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-3">Identificação</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div><p className="text-[10px] text-[#7A8FA8] mb-0.5">Empresa / Ativo</p><p className="text-xs text-[#E8EDF5]">{selectedCard.company}</p></div>
                          {Boolean(ad.tipo_participante) && <div><p className="text-[10px] text-[#7A8FA8] mb-0.5">Tipo de Participante</p><p className="text-xs text-[#E8EDF5]">{String(ad.tipo_participante)}</p></div>}
                          <div><p className="text-[10px] text-[#7A8FA8] mb-0.5">Setor</p><p className="text-xs text-[#E8EDF5]">{selectedCard.sector || "—"}</p></div>
                          {Boolean(ad.tipoOperacao) && <div><p className="text-[10px] text-[#7A8FA8] mb-0.5">Tipo de Operação</p><p className="text-xs text-[#E8EDF5]">{String(ad.tipoOperacao)}</p></div>}
                          {Boolean(selectedCard.location) && <div><p className="text-[10px] text-[#7A8FA8] mb-0.5">Localização</p><p className="text-xs text-[#E8EDF5]">{selectedCard.location}</p></div>}
                          {Boolean(ad.cnpj) && <div><p className="text-[10px] text-[#7A8FA8] mb-0.5">CNPJ</p><p className="text-xs text-[#E8EDF5]">{String(ad.cnpj)}</p></div>}
                          {Boolean(ad.founding_year) && <div><p className="text-[10px] text-[#7A8FA8] mb-0.5">Ano de Fundação</p><p className="text-xs text-[#E8EDF5]">{String(ad.founding_year)}</p></div>}
                        </div>
                      </div>

                      {/* Passo 2 — Descrição */}
                      {(ad.descricao_ptbr || ad.produtos_servicos || difArr.length > 0 || ad.mercado_atendido) && (
                        <div className="rounded-xl border border-[#122036] bg-[#0F1E35] p-3 space-y-3">
                          <p className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8]">Descrição</p>
                          {Boolean(ad.descricao_ptbr) && (
                            <div>
                              <p className="text-[10px] text-[#7A8FA8] mb-1">Descrição</p>
                              <p className="text-xs text-[#E8EDF5] leading-relaxed">{String(ad.descricao_ptbr)}</p>
                            </div>
                          )}
                          {Boolean(ad.produtos_servicos) && (
                            <div>
                              <p className="text-[10px] text-[#7A8FA8] mb-1">Produtos / Serviços</p>
                              <p className="text-xs text-[#E8EDF5] leading-relaxed">{String(ad.produtos_servicos)}</p>
                            </div>
                          )}
                          {difArr.length > 0 && (
                            <div>
                              <p className="text-[10px] text-[#7A8FA8] mb-1">Diferenciais</p>
                              <ul className="space-y-1">
                                {difArr.map((d, i) => (
                                  <li key={i} className="flex items-start gap-2 text-xs text-[#E8EDF5]">
                                    <span className="text-[#C9A84C] mt-0.5">▸</span>{d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {Boolean(ad.mercado_atendido) && (
                            <div>
                              <p className="text-[10px] text-[#7A8FA8] mb-1">Mercado Atendido</p>
                              <p className="text-xs text-[#E8EDF5] leading-relaxed">{String(ad.mercado_atendido)}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Passo 3 — Financeiro */}
                      <div className="rounded-xl border border-[#122036] bg-[#0F1E35] p-3">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-3">Financeiro</p>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div>
                            <p className="text-[10px] text-[#7A8FA8] mb-0.5">Valor Pretendido</p>
                            <p className="text-xs font-bold text-[#C9A84C]">{formatM(selectedCard.value)}</p>
                          </div>
                          {Boolean(ad.divida_total) && (
                            <div>
                              <p className="text-[10px] text-[#7A8FA8] mb-0.5">Dívida Total</p>
                              <p className="text-xs text-[#E8EDF5]">R$ {String(ad.divida_total)}</p>
                            </div>
                          )}
                        </div>
                        {hasFin && fin && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr>
                                  <th className="text-left text-[10px] font-semibold text-[#7A8FA8] pb-2 pr-3 w-16"></th>
                                  {anos.map(a => <th key={a} className="text-right text-[10px] font-semibold text-[#7A8FA8] pb-2 px-2">{a}</th>)}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#122036]">
                                {fin.receita && anos.some(a => fin.receita![a]) && (
                                  <tr>
                                    <td className="py-1.5 pr-3 font-medium text-[#E8EDF5]">Receita</td>
                                    {anos.map(a => <td key={a} className="py-1.5 px-2 text-right text-[#C9A84C] font-semibold">{fmtV(fin.receita?.[a])}</td>)}
                                  </tr>
                                )}
                                {fin.ebitda && anos.some(a => fin.ebitda![a]) && (
                                  <tr>
                                    <td className="py-1.5 pr-3 font-medium text-[#E8EDF5]">EBITDA</td>
                                    {anos.map(a => <td key={a} className="py-1.5 px-2 text-right text-[#C9A84C] font-semibold">{fmtV(fin.ebitda?.[a])}</td>)}
                                  </tr>
                                )}
                                {fin.lucro && anos.some(a => fin.lucro![a]) && (
                                  <tr>
                                    <td className="py-1.5 pr-3 font-medium text-[#E8EDF5]">Lucro</td>
                                    {anos.map(a => <td key={a} className="py-1.5 px-2 text-right text-[#C9A84C] font-semibold">{fmtV(fin.lucro?.[a])}</td>)}
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {!hasFin && !ad.divida_total && (
                          <p className="text-[10px] text-[#7A8FA8] italic">Dados financeiros não informados.</p>
                        )}
                      </div>

                      {/* Passo 4 — Jurídico */}
                      <div className="rounded-xl border border-[#122036] bg-[#0F1E35] p-3">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-3">Jurídico</p>
                        {jur ? (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[10px] text-[#7A8FA8] mb-0.5">Processos Judiciais</p>
                                <p className={`text-xs font-semibold ${jur.tem_processos ? "text-red-400" : "text-emerald-400"}`}>
                                  {jur.tem_processos ? "Sim" : "Não"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-[#7A8FA8] mb-0.5">Pendências Fiscais</p>
                                <p className={`text-xs font-semibold ${jur.tem_pendencias ? "text-red-400" : "text-emerald-400"}`}>
                                  {jur.tem_pendencias ? "Sim" : "Não"}
                                </p>
                              </div>
                              {jur.licencas && (
                                <div className="col-span-2">
                                  <p className="text-[10px] text-[#7A8FA8] mb-0.5">Licenças / Alvarás</p>
                                  <p className="text-xs text-[#E8EDF5]">{jur.licencas}</p>
                                </div>
                              )}
                            </div>
                            {jur.tem_processos && jur.detalhes_processos && (
                              <div className="mt-2 pt-2 border-t border-[#122036]">
                                <p className="text-[10px] text-[#7A8FA8] mb-1">Detalhes dos Processos</p>
                                <p className="text-xs text-[#E8EDF5] leading-relaxed">{jur.detalhes_processos}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-[#7A8FA8] italic">Situação jurídica não informada.</p>
                        )}
                      </div>

                      {/* Contato */}
                      <div className="rounded-xl border border-[#122036] bg-[#0F1E35] p-3">
                        <p className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-3">Contato</p>
                        {ct ? (
                          <>
                            <div className="grid grid-cols-2 gap-2">
                              {ct.nome && <div><p className="text-[10px] text-[#7A8FA8] mb-0.5">Nome</p><p className="text-xs text-[#E8EDF5]">{ct.nome}</p></div>}
                              {ct.email && <div><p className="text-[10px] text-[#7A8FA8] mb-0.5">E-mail</p><p className="text-xs text-[#E8EDF5]">{ct.email}</p></div>}
                              {ct.telefone && <div><p className="text-[10px] text-[#7A8FA8] mb-0.5">Telefone / WhatsApp</p><p className="text-xs text-[#E8EDF5]">{ct.telefone}</p></div>}
                              {Boolean(ad.comissionamento) && <div><p className="text-[10px] text-[#7A8FA8] mb-0.5">Comissionamento (%)</p><p className="text-xs text-[#E8EDF5]">{String(ad.comissionamento)}%</p></div>}
                            </div>
                            {Boolean(ad.info_adicionais) && (
                              <div className="mt-2 pt-2 border-t border-[#122036]">
                                <p className="text-[10px] text-[#7A8FA8] mb-1">Informações Adicionais</p>
                                <p className="text-xs text-[#E8EDF5] leading-relaxed">{String(ad.info_adicionais)}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-[10px] text-[#7A8FA8] italic">Contato não informado.</p>
                        )}
                      </div>

                      {/* Documentos */}
                      {Array.isArray(ad.documentos) && (ad.documentos as unknown[]).length > 0 && (
                        <div className="rounded-xl border border-[#122036] bg-[#0F1E35] p-3">
                          <p className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-2">
                            Documentos ({(ad.documentos as unknown[]).length})
                          </p>
                          <div className="space-y-1.5">
                            {(ad.documentos as { nome: string; tamanho: number }[]).map((doc, i) => (
                              <div key={i} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#091221] border border-[#122036]">
                                <span className="text-xs text-[#E8EDF5] truncate">{doc.nome}</span>
                                <span className="text-[10px] text-[#7A8FA8] ml-2 flex-shrink-0">{(doc.tamanho / 1024 / 1024).toFixed(1)} MB</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Editor completo dos 6 passos ── */}
                <DealFormEditorClient
                  dealId={selectedCard.id}
                  dealData={{
                    target_company:      selectedCard.company,
                    sector:              selectedCard.sector,
                    location:            selectedCard.location ?? "",
                    deal_value:          selectedCard.value,
                    probability_percent: selectedCard.probability,
                    notes:               selectedCard.notes ?? null,
                    asset_data:          (selectedCard.asset_data ?? {}) as Parameters<typeof DealFormEditorClient>[0]["dealData"]["asset_data"],
                  }}
                  compact={true}
                  onSaved={(updated) => {
                    setCards(prev => prev.map(c => c.id === selectedCard.id ? {
                      ...c,
                      company:   updated.target_company,
                      sector:    updated.sector,
                      location:  updated.location,
                      value:     updated.deal_value ?? c.value,
                      notes:     updated.notes ?? c.notes,
                      asset_data: updated.asset_data,
                    } : c));
                    setSelectedCard(prev => prev ? {
                      ...prev,
                      company:    updated.target_company,
                      sector:     updated.sector,
                      location:   updated.location,
                      value:      updated.deal_value ?? prev.value,
                      notes:      updated.notes ?? prev.notes,
                      asset_data: updated.asset_data,
                    } : null);
                  }}
                />

                {/* ── Documentos do ativo ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[#7A8FA8] flex items-center gap-1.5">
                      <FileText size={13} /> Documentos do Ativo
                    </p>
                    <div className="flex items-center gap-2">
                      {/* Botão cold-start n8n — acorda o Render antes de fazer upload */}
                      <button
                        type="button"
                        onClick={handleWarmup}
                        disabled={warmupStatus === "pinging" || warmupStatus === "warming"}
                        title={
                          warmupStatus === "online"
                            ? `n8n online (${warmupElapsed != null ? (warmupElapsed / 1000).toFixed(1) + "s" : "ok"})`
                            : warmupStatus === "warming"
                            ? `Acordando Render... ${warmupCountdown}s`
                            : warmupStatus === "error"
                            ? "Falha ao conectar — tente novamente"
                            : "Verificar / acordar n8n antes de fazer upload"
                        }
                        className={[
                          "flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded transition-colors",
                          warmupStatus === "online"
                            ? "bg-emerald-900/40 text-emerald-400"
                            : warmupStatus === "error"
                            ? "bg-red-900/30 text-red-400"
                            : warmupStatus === "warming" || warmupStatus === "pinging"
                            ? "bg-[#162744] text-[#E8C97A] opacity-80 cursor-not-allowed"
                            : "bg-[#162744] text-[#9BAFC5] hover:text-[#C9A84C] hover:bg-[#243A66]",
                        ].join(" ")}
                      >
                        {warmupStatus === "pinging" ? (
                          <><Loader2 size={10} className="animate-spin" /> Ping...</>
                        ) : warmupStatus === "warming" ? (
                          <><Loader2 size={10} className="animate-spin" /> {warmupCountdown}s</>
                        ) : warmupStatus === "online" ? (
                          <><Zap size={10} className="fill-current" /> Online</>
                        ) : warmupStatus === "error" ? (
                          <><DatabaseZap size={10} /> Erro</>
                        ) : (
                          <><DatabaseZap size={10} /> n8n</>
                        )}
                      </button>
                      <select
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value)}
                        title="Categoria do documento a anexar"
                        className="text-[10px] bg-[#162744] text-[#9BAFC5] border border-[#243A66] rounded px-1.5 py-0.5 focus:outline-none focus:border-[#C9A84C]"
                      >
                        {DOC_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => detailFileRef.current?.click()}
                        className="flex items-center gap-1 text-xs text-[#C9A84C] hover:text-[#E8C97A] transition-colors"
                      >
                        <Upload size={12} /> Anexar
                      </button>
                    </div>
                  </div>
                  <input
                    ref={detailFileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []);
                      if (!files.length || !selectedCard) return;
                      if (detailFileRef.current) detailFileRef.current.value = "";
                      for (const file of files) {
                        const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
                        setUploadingDoc(docId);
                        setUploadProgress(0);
                        try {
                          if (file.size > 4 * 1024 * 1024) {
                            // Arquivo grande: upload direto ao Supabase Storage via URL assinada
                            const urlRes = await fetch(
                              `/api/ma/documents/upload-url?deal_id=${selectedCard.id}&doc_id=${encodeURIComponent(docId)}&file_name=${encodeURIComponent(file.name)}&category=${encodeURIComponent(uploadCategory)}`
                            );
                            if (!urlRes.ok) throw new Error((await urlRes.json()).error ?? "Erro ao obter URL");
                            const { token, storagePath, bucket } = await urlRes.json() as { signedUrl: string; token: string; storagePath: string; bucket: string };

                            // Upload via XHR para ter progresso real
                            await new Promise<void>((resolve, reject) => {
                              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
                              const xhr = new XMLHttpRequest();
                              xhr.open("PUT", `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${storagePath}?token=${token}`);
                              xhr.setRequestHeader("Content-Type", file.type || "application/pdf");
                              xhr.upload.onprogress = (ev) => {
                                if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
                              };
                              xhr.onload = () => xhr.status < 300 ? resolve() : reject(new Error(`Storage: ${xhr.status}`));
                              xhr.onerror = () => reject(new Error("Falha na conexão com o storage"));
                              xhr.send(file);
                            });

                            setUploadProgress(100);

                            // Registra metadados (servidor calcula hash e bloqueia duplicata exata)
                            const regRes = await fetch("/api/ma/documents/register", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                deal_id: selectedCard.id, doc_id: docId,
                                file_name: file.name, storage_path: storagePath,
                                bucket, category: uploadCategory,
                                file_size_bytes: file.size,
                              }),
                            });
                            const regJson = await regRes.json();
                            if (regJson.ok && regJson.document) {
                              if (regJson.duplicate) {
                                alert(`Arquivo idêntico já existe neste deal: ${regJson.document.file_name}. Nenhuma cópia nova foi criada.`);
                              } else {
                                setCardDocs(prev => [...prev, { ...regJson.document }]);
                              }
                            } else {
                              alert(regJson.error ?? "Erro ao registrar arquivo");
                            }
                          } else {
                            // Arquivo pequeno (≤ 4MB): fluxo original via FormData
                            const form = new FormData();
                            form.append("file", file);
                            form.append("deal_id", selectedCard.id);
                            form.append("doc_id", docId);
                            form.append("category", uploadCategory);
                            const res = await fetch("/api/ma/documents", { method: "POST", body: form });
                            const json = await res.json();
                            if (json.ok && json.document) {
                              if (json.duplicate) {
                                alert(`Arquivo idêntico já existe neste deal: ${json.document.file_name}. Nenhuma cópia nova foi criada.`);
                              } else {
                                setCardDocs(prev => [...prev, { ...json.document }]);
                              }
                            } else {
                              alert(json.error ?? "Erro ao enviar arquivo");
                            }
                          }
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "Erro ao enviar arquivo");
                        }
                        setUploadingDoc(null);
                        setUploadProgress(0);
                      }
                    }}
                  />
                  {docsLoading ? (
                    <div className="flex items-center gap-2 py-3 text-xs text-[#7A8FA8]">
                      <div className="w-3 h-3 border-2 border-[#C9A84C]/40 border-t-[#C9A84C] rounded-full animate-spin" />
                      Carregando documentos...
                    </div>
                  ) : cardDocs.length === 0 && !uploadingDoc ? (
                    <p className="text-xs text-[#5A7490] py-2">Nenhum documento anexado.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {cardDocs.map((doc) => (
                        <div key={doc.doc_id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#0F1E35] border border-[#122036]">
                          <Paperclip size={12} className="text-[#C9A84C] flex-shrink-0" />
                          <span className="text-xs text-[#E8EDF5] flex-1 truncate">{doc.file_name}</span>
                          {doc.url && (
                            <>
                              <a href={doc.url} target="_blank" rel="noopener noreferrer" title="Abrir" className="text-[#7A8FA8] hover:text-[#C9A84C] transition-colors">
                                <ExternalLink size={12} />
                              </a>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(doc.url!);
                                  setCopiedDoc(doc.doc_id);
                                  setTimeout(() => setCopiedDoc(null), 2000);
                                }}
                                title="Copiar link" className="text-[#7A8FA8] hover:text-[#C9A84C] transition-colors"
                              >
                                {copiedDoc === doc.doc_id ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} />}
                              </button>
                            </>
                          )}
                          <button
                            onClick={async () => {
                              await fetch(`/api/ma/documents?deal_id=${selectedCard!.id}&doc_id=${encodeURIComponent(doc.doc_id)}`, { method: "DELETE" });
                              setCardDocs(prev => prev.filter(d => d.doc_id !== doc.doc_id));
                            }}
                            className="text-[#7A8FA8] hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      {uploadingDoc && (
                        <div className="px-2.5 py-2 rounded-lg bg-[#0F1E35] border border-dashed border-[#C9A84C]/40">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="w-3 h-3 border-2 border-[#C9A84C]/40 border-t-[#C9A84C] rounded-full animate-spin flex-shrink-0" />
                            <span className="text-xs text-[#7A8FA8] flex-1">
                              {uploadProgress > 0 ? `Enviando... ${uploadProgress}%` : "Preparando envio..."}
                            </span>
                            {uploadProgress > 0 && (
                              <span className="text-[10px] font-bold text-[#C9A84C]">{uploadProgress}%</span>
                            )}
                          </div>
                          {uploadProgress > 0 && (
                            <div className="h-1 rounded-full bg-[#122036] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{ width: `${uploadProgress}%`, background: uploadProgress === 100 ? "#10B981" : "#C9A84C" }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Comentários / Atualizações da Mesa ── */}
                <div>
                  <p className="text-xs font-semibold text-[#7A8FA8] mb-2 flex items-center gap-1.5">
                    <MessageSquare size={13} /> Atualizações da Mesa M&A
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                    {(selectedCard.comments ?? []).length === 0 ? (
                      <p className="text-xs text-[#5A7490] py-1">Nenhuma atualização ainda.</p>
                    ) : (
                      (selectedCard.comments ?? []).map(c => (
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
                      placeholder="Adicionar atualização para o partner..."
                      rows={2}
                      className="flex-1 rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-xs px-3 py-2 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors resize-none"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || savingComment}
                      className="rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C] px-3 hover:bg-[#C9A84C]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {savingComment
                        ? <div className="w-3 h-3 border-2 border-[#C9A84C]/40 border-t-[#C9A84C] rounded-full animate-spin" />
                        : <Send size={13} />}
                    </button>
                  </div>
                </div>

                {/* ── Mover Fase ── */}
                <div className="rounded-xl border border-[#122036] bg-[#0F1E35] p-3 space-y-2.5">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8]">Mover Fase</p>
                  <select
                    value={selectedCard.stage}
                    onChange={e => handleMoveStage(selectedCard, e.target.value)}
                    className="w-full rounded-lg border border-[#122036] bg-[#091221] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
                  >
                    {maStages.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    {(() => {
                      const idx = maStages.findIndex(s => s.id === selectedCard.stage);
                      const prev = idx > 0 ? maStages[idx - 1] : null;
                      const next = idx < maStages.length - 1 ? maStages[idx + 1] : null;
                      return (
                        <>
                          <button
                            onClick={() => prev && handleMoveStage(selectedCard, prev.id)}
                            disabled={!prev}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-[#122036] text-[#7A8FA8] text-xs py-2 hover:text-[#E8EDF5] hover:border-[#243A66] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft size={12} /> Voltar
                          </button>
                          <button
                            onClick={() => next && handleMoveStage(selectedCard, next.id)}
                            disabled={!next}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C] text-xs py-2 hover:bg-[#C9A84C]/25 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                            Avançar <ChevronRight size={12} />
                          </button>
                        </>
                      );
                    })()}
                  </div>
                  <p className="text-[9px] text-[#5A7490]">
                    Probabilidade atualiza automaticamente ao mover fase · valor atual: <span style={{ color: probColor(selectedCard.probability) }}>{selectedCard.probability}%</span>
                  </p>
                </div>

                {/* Enviar para Securitizadora */}
                {["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(userRole) && (
                  <div className="pt-1 border-t border-[#122036]">
                    <button
                      onClick={() => {
                        setSubmitPartnerResult(null);
                        setSubmitPartnerError(null);
                        setSelectedPartnerId("");
                        setSubmitPartnersLoading(true);
                        fetch("/api/integrations")
                          .then(r => r.json())
                          .then(({ partners }) => setIntegrationPartners(partners ?? []))
                          .catch(() => setIntegrationPartners([]))
                          .finally(() => setSubmitPartnersLoading(false));
                        setShowSubmitPartner(true);
                      }}
                      className="w-full text-xs text-[#C9A84C]/80 hover:text-[#C9A84C] transition-colors py-1.5 flex items-center justify-center gap-1.5 font-medium"
                    >
                      <Send size={12} /> Enviar para Securitizadora
                    </button>
                  </div>
                )}

                {/* Transferir deal */}
                {["ADMIN", "GESTAO"].includes(userRole) && (
                  <div className="pt-1 border-t border-[#122036]">
                    <button
                      onClick={() => {
                        setTransferForm({ new_partner_id: "", new_partner_name: "", new_partner_email: "", motivo: "cadastro_mesa", justificativa: "", confirmar: false, modo: "existente" });
                        setTransferError(null);
                        setTransferOk(false);
                        setShowTransferDeal(true);
                      }}
                      className="w-full text-xs text-[#7A8FA8] hover:text-[#C9A84C] transition-colors py-1.5 flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeftRight size={12} /> Transferir Deal para outro Partner
                    </button>
                  </div>
                )}

                {/* Excluir deal */}
                <div className="pt-1 border-t border-[#122036]">
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full text-xs text-[#7A8FA8] hover:text-red-400 transition-colors py-1.5 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={12} /> Excluir esta operação
                    </button>
                  ) : (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
                      <p className="text-xs text-red-400 text-center font-medium">Confirmar exclusão permanente?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 rounded-lg border border-[#122036] text-[#7A8FA8] text-xs py-2 hover:text-[#E8EDF5] transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleDeleteCard(selectedCard)}
                          disabled={deletingCard}
                          className="flex-1 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs py-2 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {deletingCard
                            ? <div className="w-3 h-3 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" />
                            : <><Trash2 size={12} /> Excluir</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>


      {/* ── NEW CARD MODAL ─────────────────────────────────────── */}
      <Dialog open={showNewCard} onOpenChange={setShowNewCard}>
        <DialogContent className="bg-[#091221] border border-[#122036] text-[#E8EDF5] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#E8EDF5]">Nova Operação M&A</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Empresa *</label>
              <input
                value={newCard.company}
                onChange={e => setNewCard(p => ({ ...p, company: e.target.value }))}
                placeholder="Nome da empresa alvo"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Setor *</label>
                <select
                  value={newCard.sector}
                  onChange={e => setNewCard(p => ({ ...p, sector: e.target.value }))}
                  className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
                >
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Etapa</label>
                <select
                  value={newCard.stage || maStages[0]?.id || ""}
                  onChange={e => setNewCard(p => ({ ...p, stage: e.target.value }))}
                  className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
                >
                  {maStages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Valor Estimado (R$) *</label>
              <input
                type="number"
                value={newCard.value}
                onChange={e => setNewCard(p => ({ ...p, value: e.target.value }))}
                placeholder="Ex: 50000000"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Responsável *</label>
              <input
                value={newCard.responsible}
                onChange={e => setNewCard(p => ({ ...p, responsible: e.target.value }))}
                placeholder="Nome do responsável"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Observações</label>
              <textarea
                value={newCard.notes}
                onChange={e => setNewCard(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Observações iniciais..."
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors resize-none"
              />
            </div>
            {/* Anexos do ativo */}
            <div>
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Documentos do Ativo</label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={e => {
                  const files = Array.from(e.target.files ?? []);
                  setPendingFiles(prev => [...prev, ...files]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-[#C9A84C]/40 bg-[#C9A84C]/5 text-[#C9A84C] text-xs py-3 hover:bg-[#C9A84C]/10 transition-colors"
              >
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
              <button
                onClick={() => { setShowNewCard(false); setPendingFiles([]); }}
                className="flex-1 rounded-lg border border-[#122036] text-[#7A8FA8] text-sm py-2.5 hover:text-[#E8EDF5] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCard}
                disabled={!newCard.company || !newCard.value || !newCard.responsible || isCreating}
                className="flex-1 rounded-lg bg-[#C9A84C] text-[#09081A] text-sm font-semibold py-2.5 hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <><div className="w-4 h-4 border-2 border-[#09081A]/40 border-t-[#09081A] rounded-full animate-spin" /> Criando...</>
                ) : "Criar Operação"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── FULL DEAL FORM MODAL ────────────────────────────────── */}
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
                // Adiciona o novo deal à lista localmente
                const newDealCard: MaCard = {
                  id: dealId,
                  code,
                  company: "",
                  sector: "",
                  value: 0,
                  stage: "prospeccao",
                  responsible: userName,
                  probability: 10,
                  createdAt: new Date().toISOString().split("T")[0],
                };
                setCards(prev => [...prev, newDealCard]);
                // Recarrega deals do banco
                fetch("/api/ma-deals")
                  .then(r => r.json())
                  .then(({ deals: fresh }) => {
                    if (!Array.isArray(fresh)) return;
                    setCards(fresh.map((d: Record<string, unknown>) => ({
                      id: d.id as string,
                      code: d.code as string,
                      company: (d.target_company ?? d.title ?? "Sem nome") as string,
                      sector: (d.sector ?? "") as string,
                      value: (d.deal_value ?? 0) as number,
                      stage: (d.stage as string) ?? "prospeccao",
                      responsible: (() => {
                        const p = d.partner;
                        if (Array.isArray(p as unknown[])) return ((p as {full_name?: string}[])[0])?.full_name ?? userName;
                        return (p as { full_name?: string } | null)?.full_name ?? userName;
                      })(),
                      probability: (d.probability_percent ?? 10) as number,
                      createdAt: ((d.created_at as string) ?? "").split("T")[0],
                      notes: (d.notes ?? "") as string,
                      comments: Array.isArray(d.comments) ? d.comments as DealComment[] : [],
                      asset_data: (d.asset_data ?? {}) as Record<string, unknown>,
                      tipo_participante: ((d.asset_data ?? {}) as Record<string, unknown>)?.tipo_participante as string | undefined,
                    })));
                  })
                  .catch(() => {});
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* ── NEW OPERATOR MODAL ─────────────────────────────────── */}
      <Dialog open={showNewOp} onOpenChange={setShowNewOp}>
        <DialogContent className="bg-[#091221] border border-[#122036] text-[#E8EDF5] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#E8EDF5]">Adicionar Operador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Nome completo *</label>
              <input
                value={newOp.name}
                onChange={e => setNewOp(p => ({ ...p, name: e.target.value }))}
                placeholder="Nome do operador"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Email *</label>
              <input
                type="email"
                value={newOp.email}
                onChange={e => setNewOp(p => ({ ...p, email: e.target.value }))}
                placeholder="email@v3partners.com"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Função</label>
              <select
                value={newOp.role}
                onChange={e => setNewOp(p => ({ ...p, role: e.target.value }))}
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
              >
                {ROLES_MA.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowNewOp(false)}
                className="flex-1 rounded-lg border border-[#122036] text-[#7A8FA8] text-sm py-2.5 hover:text-[#E8EDF5] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateOp}
                disabled={!newOp.name || !newOp.email}
                className="flex-1 rounded-lg bg-[#C9A84C] text-[#09081A] text-sm font-semibold py-2.5 hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Adicionar
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL ENVIAR PARA SECURITIZADORA ────────────────────────────── */}
      <Dialog open={showSubmitPartner} onOpenChange={v => { setShowSubmitPartner(v); if (!v) setSubmitPartnerResult(null); }}>
        <DialogContent className="max-w-lg bg-[#111F35] border border-[#243A66] text-[#E8EDF5]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#F0ECE4]">
              <Send size={16} className="text-[#C9A84C]" />
              Enviar para Securitizadora — {selectedCard?.code}
            </DialogTitle>
          </DialogHeader>

          {submitPartnerResult ? (
            /* ── Resultado ── */
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">Envio realizado com sucesso</p>
                    <p className="text-xs text-[#9BAFC5] mt-0.5">
                      SLA: {new Date(submitPartnerResult.sla_deadline).toLocaleDateString("pt-BR")} · {submitPartnerResult.partner.display_name}
                    </p>
                  </div>
                </div>
                {!submitPartnerResult.partner.active && (
                  <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
                    Parceiro aguardando API key — VDR gerado mas sem envio automático ao CRM.
                  </p>
                )}
                {submitPartnerResult.pipedrive_sent && (
                  <p className="text-xs text-emerald-400">Lead criado no Pipedrive automaticamente.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#E8C97A]">Link VDR para Análise</p>
                <div className="flex items-center gap-2 rounded-lg bg-[#09081A] border border-[#243A66] px-3 py-2">
                  <Link2 size={12} className="text-[#C9A84C] flex-shrink-0" />
                  <span className="text-xs text-[#9BAFC5] truncate flex-1">{submitPartnerResult.vdr_url}</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(submitPartnerResult.vdr_url)}
                    className="text-[#C9A84C] hover:text-[#E8C97A] transition-colors flex-shrink-0"
                    title="Copiar link"
                  >
                    <Copy size={12} />
                  </button>
                </div>
                <p className="text-[10px] text-[#5A7490]">Compartilhe este link com a securitizadora para acesso aos documentos.</p>
              </div>

              <button
                onClick={() => { setShowSubmitPartner(false); setSubmitPartnerResult(null); }}
                className="w-full rounded-lg bg-[#162744] border border-[#243A66] text-sm text-[#F0ECE4] py-2.5 hover:bg-[#1E3A5F] transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : (
            /* ── Formulário ── */
            <div className="space-y-4 py-2">
              <p className="text-xs text-[#9BAFC5]">
                Selecione a securitizadora que receberá os dados deste deal. Um link VDR exclusivo será gerado para análise de crédito.
              </p>

              {/* Lista de parceiros */}
              {submitPartnersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-[#C9A84C]" />
                </div>
              ) : integrationPartners.length === 0 ? (
                <div className="rounded-xl border border-[#243A66] bg-[#09081A] p-4 text-center">
                  <p className="text-xs text-[#9BAFC5]">Nenhuma securitizadora cadastrada.</p>
                  <a href="/configuracoes/integracoes" className="text-xs text-[#C9A84C] hover:underline mt-1 inline-block">
                    Configurar integrações →
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {integrationPartners.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPartnerId(p.id)}
                      className={`w-full rounded-xl border text-left px-4 py-3 transition-all ${
                        selectedPartnerId === p.id
                          ? "border-[#C9A84C]/60 bg-[#C9A84C]/8"
                          : "border-[#243A66] bg-[#09081A] hover:border-[#C9A84C]/30"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[#F0ECE4]">{p.display_name}</p>
                          <p className="text-[10px] text-[#9BAFC5] mt-0.5 uppercase tracking-wide">{p.crm_type} · SLA {p.sla_days} dias</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {p.active ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">ATIVO</span>
                          ) : (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">AGUARDANDO KEY</span>
                          )}
                          {selectedPartnerId === p.id && (
                            <div className="w-3 h-3 rounded-full bg-[#C9A84C] flex items-center justify-center">
                              <Check size={8} className="text-[#09081A]" />
                            </div>
                          )}
                        </div>
                      </div>
                      {!p.active && selectedPartnerId === p.id && (
                        <p className="text-[10px] text-amber-400 mt-2 flex items-center gap-1">
                          <AlertCircle size={10} />
                          VDR será gerado, mas envio ao CRM aguarda API key.
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {submitPartnerError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <AlertCircle size={12} /> {submitPartnerError}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowSubmitPartner(false)}
                  className="flex-1 rounded-lg border border-[#122036] text-[#7A8FA8] text-sm py-2.5 hover:text-[#E8EDF5] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={!selectedPartnerId || submitPartnerLoading}
                  onClick={async () => {
                    if (!selectedCard || !selectedPartnerId) return;
                    setSubmitPartnerLoading(true);
                    setSubmitPartnerError(null);
                    try {
                      const res = await fetch(`/api/ma/deals/${selectedCard.id}/submit-partner`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ partner_id: selectedPartnerId }),
                      });
                      const json = await res.json() as SubmitResult & { error?: string };
                      if (!res.ok) throw new Error(json.error ?? "Erro ao enviar");
                      setSubmitPartnerResult(json);
                    } catch (err) {
                      setSubmitPartnerError((err as Error).message);
                    } finally {
                      setSubmitPartnerLoading(false);
                    }
                  }}
                  className="flex-1 rounded-lg bg-[#C9A84C] text-[#09081A] text-sm font-semibold py-2.5 hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitPartnerLoading
                    ? <><Loader2 size={14} className="animate-spin" /> Enviando...</>
                    : <><Send size={14} /> Enviar Deal</>
                  }
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MODAL TRANSFERÊNCIA DE DEAL ─────────────────────────────────── */}
      <Dialog open={showTransferDeal} onOpenChange={setShowTransferDeal}>
        <DialogContent className="max-w-lg bg-[#111F35] border border-[#243A66] text-[#E8EDF5]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#F0ECE4]">
              <ArrowLeftRight size={16} className="text-[#C9A84C]" />
              Transferir Deal — {selectedCard?.code}
            </DialogTitle>
          </DialogHeader>

          {transferOk ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <Check size={22} className="text-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-emerald-400">Transferência realizada com sucesso</p>
              <p className="text-xs text-[#7A8FA8]">Email enviado para Financeiro, Head de Ativos e Compliance.</p>
              <button
                onClick={() => setShowTransferDeal(false)}
                className="mt-2 px-6 py-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-sm font-bold hover:bg-[#E8C97A] transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Aviso */}
              <div className="rounded-lg p-3 flex items-start gap-2" style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.25)" }}>
                <Mail size={13} className="text-[#C9A84C] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#C9A84C] leading-relaxed">
                  Ao confirmar, um email será enviado automaticamente para <strong>Financeiro</strong>, <strong>Head de Ativos</strong> e <strong>Compliance</strong> com os detalhes da transferência.
                </p>
              </div>

              {/* Motivo */}
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Motivo <span className="text-red-400">*</span></label>
                <select
                  value={transferForm.motivo}
                  onChange={e => setTransferForm(p => ({ ...p, motivo: e.target.value }))}
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
                >
                  <option value="cadastro_mesa">Cadastro via Mesa — parceiro sem acesso à plataforma</option>
                  <option value="inadimplencia">Inadimplência — parceiro em atraso</option>
                  <option value="solicitacao">Solicitação do parceiro</option>
                  <option value="reestruturacao">Reestruturação de carteira</option>
                  <option value="outro">Outro motivo</option>
                </select>
              </div>

              {/* Modo: existente ou externo */}
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-2 block">Novo Partner</label>
                <div className="flex gap-2 mb-3">
                  {(["existente", "externo"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setTransferForm(p => ({ ...p, modo: m, new_partner_id: "", new_partner_name: "", new_partner_email: "" }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                        transferForm.modo === m
                          ? "bg-[#C9A84C]/15 border-[#C9A84C]/50 text-[#C9A84C]"
                          : "border-[#243A66] text-[#7A8FA8] hover:text-[#E8EDF5]"
                      }`}
                    >
                      {m === "existente" ? "Com conta na plataforma" : "Sem conta (externo)"}
                    </button>
                  ))}
                </div>

                {transferForm.modo === "existente" ? (
                  <select
                    value={transferForm.new_partner_id}
                    onChange={e => setTransferForm(p => ({ ...p, new_partner_id: e.target.value }))}
                    className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
                  >
                    <option value="">Selecione o partner...</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {p.role}</option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      placeholder="Nome completo do partner"
                      value={transferForm.new_partner_name}
                      onChange={e => setTransferForm(p => ({ ...p, new_partner_name: e.target.value }))}
                      className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors placeholder:text-[#7A8FA8]/50"
                    />
                    <input
                      placeholder="Email (opcional)"
                      type="email"
                      value={transferForm.new_partner_email}
                      onChange={e => setTransferForm(p => ({ ...p, new_partner_email: e.target.value }))}
                      className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors placeholder:text-[#7A8FA8]/50"
                    />
                  </div>
                )}
              </div>

              {/* Justificativa */}
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Justificativa <span className="text-red-400">*</span></label>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Descreva o motivo detalhado da transferência. Esta informação ficará no log de auditoria e será enviada aos diretores..."
                  value={transferForm.justificativa}
                  onChange={e => setTransferForm(p => ({ ...p, justificativa: e.target.value }))}
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors resize-none placeholder:text-[#7A8FA8]/50"
                />
                <p className="text-[10px] text-[#7A8FA8] text-right">{transferForm.justificativa.length}/500</p>
              </div>

              {/* Checkbox de confirmação */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <div
                  onClick={() => setTransferForm(p => ({ ...p, confirmar: !p.confirmar }))}
                  className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
                    transferForm.confirmar
                      ? "bg-[#C9A84C] border-[#C9A84C]"
                      : "bg-transparent border-[#243A66] group-hover:border-[#C9A84C]/50"
                  }`}
                >
                  {transferForm.confirmar && <Check size={10} className="text-[#09081A]" />}
                </div>
                <span className="text-xs text-[#7A8FA8] leading-relaxed">
                  Confirmo que esta transferência está autorizada e estou ciente de que um email será enviado para os diretores da V3 Partners com os detalhes registrados acima.
                </span>
              </label>

              {transferError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <X size={12} /> {transferError}
                </p>
              )}

              {/* Ações */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowTransferDeal(false)}
                  className="flex-1 rounded-lg border border-[#243A66] text-[#7A8FA8] text-sm py-2.5 hover:text-[#E8EDF5] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={
                    transferSaving ||
                    !transferForm.motivo ||
                    !transferForm.justificativa.trim() ||
                    !transferForm.confirmar ||
                    (transferForm.modo === "existente" && !transferForm.new_partner_id) ||
                    (transferForm.modo === "externo" && !transferForm.new_partner_name.trim())
                  }
                  onClick={async () => {
                    if (!selectedCard) return;
                    setTransferSaving(true);
                    setTransferError(null);
                    try {
                      const res = await fetch("/api/ma/transfer-deal", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          deal_id:          selectedCard.id,
                          new_partner_id:   transferForm.modo === "existente" ? transferForm.new_partner_id : undefined,
                          new_partner_name: transferForm.modo === "externo"   ? transferForm.new_partner_name : undefined,
                          new_partner_email:transferForm.modo === "externo"   ? transferForm.new_partner_email : undefined,
                          motivo:           transferForm.motivo,
                          justificativa:    transferForm.justificativa,
                          confirmar:        transferForm.confirmar,
                        }),
                      });
                      const data = await res.json() as { ok?: boolean; error?: string; transfer?: { to_name: string; to_id?: string } };
                      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
                      // Atualizar card local
                      if (data.transfer) {
                        const newResp = data.transfer.to_name;
                        const newId   = data.transfer.to_id;
                        setCards(prev => prev.map(c => c.id === selectedCard.id ? {
                          ...c, responsible: newResp, assigned_to_id: newId,
                        } : c));
                        setSelectedCard(prev => prev ? { ...prev, responsible: newResp, assigned_to_id: newId } : null);
                      }
                      setTransferOk(true);
                    } catch (e) {
                      setTransferError(e instanceof Error ? e.message : "Erro ao transferir");
                    } finally {
                      setTransferSaving(false);
                    }
                  }}
                  className="flex-1 rounded-lg bg-[#C9A84C] text-[#09081A] text-sm font-bold py-2.5 hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {transferSaving
                    ? <><Loader2 size={14} className="animate-spin" /> Transferindo...</>
                    : <><ArrowLeftRight size={14} /> Confirmar Transferência</>}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MODAL TEASER CEGO ────────────────────────────────────────────── */}
      <Dialog open={showTeaserCego} onOpenChange={setShowTeaserCego}>
        <DialogContent className="max-w-md bg-[#111F35] border border-[#243A66] text-[#E8EDF5]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-[#F0ECE4]">
              <FileSignature size={16} className="text-[#C9A84C]" />
              Teaser Cego — Oportunidade Pontual
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-[#7A8FA8] -mt-2 mb-1">
            Para oportunidades sem necessidade de securitização ou empréstimo. Dados mínimos, identidade protegida.
          </p>

          <div className="space-y-3">
            {/* Apelido */}
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Apelido do Ativo <span className="text-red-400">*</span></label>
              <input
                placeholder="Ex: Plataforma Logística Sul, Ativo Industrial ABC..."
                value={teaserForm.apelido}
                onChange={e => setTeaserForm(p => ({ ...p, apelido: e.target.value }))}
                className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors placeholder:text-[#7A8FA8]/50"
              />
              <p className="text-[10px] text-[#7A8FA8] mt-1">Não use o nome real da empresa. Use apelido neutro.</p>
            </div>

            {/* Setor + UF em linha */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Setor <span className="text-red-400">*</span></label>
                <select
                  value={teaserForm.setor}
                  onChange={e => setTeaserForm(p => ({ ...p, setor: e.target.value }))}
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
                >
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">UF / Região <span className="text-red-400">*</span></label>
                <input
                  placeholder="Ex: SP, RJ, Sul..."
                  value={teaserForm.uf}
                  onChange={e => setTeaserForm(p => ({ ...p, uf: e.target.value }))}
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors placeholder:text-[#7A8FA8]/50"
                />
              </div>
            </div>

            {/* Tipo */}
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Tipo de Oportunidade <span className="text-red-400">*</span></label>
              <select
                value={teaserForm.tipo}
                onChange={e => setTeaserForm(p => ({ ...p, tipo: e.target.value }))}
                className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
              >
                {["Venda de Participação", "Captação de Capital", "Parceria Estratégica", "Real Estate", "M&A Cross-Border", "Outro"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Valor */}
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Valor Aproximado (R$) <span className="text-red-400">*</span></label>
              <input
                type="number"
                placeholder="Ex: 5000000"
                value={teaserForm.valor}
                onChange={e => setTeaserForm(p => ({ ...p, valor: e.target.value }))}
                className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors placeholder:text-[#7A8FA8]/50"
              />
            </div>

            {/* Descrição cega */}
            <div>
              <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Descrição Cega <span className="text-red-400">*</span></label>
              <textarea
                rows={3}
                maxLength={250}
                placeholder="Descreva a oportunidade sem identificar empresa, sócios ou localização exata..."
                value={teaserForm.descricao}
                onChange={e => setTeaserForm(p => ({ ...p, descricao: e.target.value }))}
                className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors resize-none placeholder:text-[#7A8FA8]/50"
              />
              <p className="text-[10px] text-[#7A8FA8] text-right">{teaserForm.descricao.length}/250</p>
            </div>

            {/* Contato */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Contato (nome) <span className="text-red-400">*</span></label>
                <input
                  placeholder="Nome do originador"
                  value={teaserForm.contato_nome}
                  onChange={e => setTeaserForm(p => ({ ...p, contato_nome: e.target.value }))}
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors placeholder:text-[#7A8FA8]/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest uppercase text-[#7A8FA8] mb-1 block">Telefone / Email</label>
                <input
                  placeholder="(11) 99999-9999"
                  value={teaserForm.contato_telefone}
                  onChange={e => setTeaserForm(p => ({ ...p, contato_telefone: e.target.value }))}
                  className="w-full rounded-lg border border-[#243A66] bg-[#09081A] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors placeholder:text-[#7A8FA8]/50"
                />
              </div>
            </div>

            {teaserError && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <X size={12} /> {teaserError}
              </p>
            )}

            {/* Ações */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowTeaserCego(false)}
                className="flex-1 rounded-lg border border-[#243A66] text-[#7A8FA8] text-sm py-2.5 hover:text-[#E8EDF5] transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={teaserSaving || !teaserForm.apelido || !teaserForm.uf || !teaserForm.valor || !teaserForm.descricao || !teaserForm.contato_nome}
                onClick={async () => {
                  setTeaserSaving(true);
                  setTeaserError(null);
                  try {
                    const res = await fetch("/api/ma-deals", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: teaserForm.apelido,
                        target_company: "Ativo Confidencial",
                        sector: teaserForm.setor,
                        location: teaserForm.uf,
                        deal_value: Number(teaserForm.valor),
                        deal_type: "TEASER_CEGO",
                        stage: "PROSPECTING",
                        probability_percent: 30,
                        notes: teaserForm.descricao,
                        asset_data: {
                          teaser_cego: true,
                          tipo_oportunidade: teaserForm.tipo,
                          descricao_blind: teaserForm.descricao,
                          contato_nome: teaserForm.contato_nome,
                          contato_telefone: teaserForm.contato_telefone,
                          forja_status: "PENDENTE",
                        },
                      }),
                    });
                    if (!res.ok) throw new Error("Falha ao criar teaser");
                    const { deal } = await res.json() as { deal?: { id: string; code?: string } };
                    if (deal) {
                      const newCard: MaCard = {
                        id: deal.id,
                        code: deal.code ?? "TC-" + Date.now().toString().slice(-4),
                        company: teaserForm.apelido,
                        sector: teaserForm.setor,
                        value: Number(teaserForm.valor),
                        stage: "prospeccao",
                        dbStage: "PROSPECTING",
                        responsible: userName,
                        probability: 30,
                        createdAt: new Date().toISOString().split("T")[0],
                        notes: teaserForm.descricao,
                        comments: [],
                        location: teaserForm.uf,
                        tipo_participante: "Vendedor",
                        asset_data: { teaser_cego: true, tipo_oportunidade: teaserForm.tipo, forja_status: "PENDENTE" },
                      };
                      setCards(prev => [newCard, ...prev]);
                    }
                    setShowTeaserCego(false);
                    setTeaserForm({ apelido: "", setor: "Real Estate", uf: "", tipo: "Venda de Participação", valor: "", descricao: "", contato_nome: "", contato_telefone: "" });
                  } catch (e) {
                    setTeaserError(e instanceof Error ? e.message : "Erro ao salvar");
                  } finally {
                    setTeaserSaving(false);
                  }
                }}
                className="flex-1 rounded-lg bg-[#C9A84C] text-[#09081A] text-sm font-semibold py-2.5 hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {teaserSaving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><FileSignature size={14} /> Criar Teaser Cego</>}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
