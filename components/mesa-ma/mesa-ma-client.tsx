"use client";

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, X, ChevronRight,
  BarChart2, Mail, Circle, ExternalLink, FileText, Webhook, RefreshCw,
} from "lucide-react";
import { ExportButton } from "@/components/financeiro/export-button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PipefyConfig, type PipefyPhase } from "@/components/shared/pipefy-config";
import { MA_PIPELINE } from "@/components/ma/ma-client";

// ─── Types ────────────────────────────────────────────────────────────────────
type MaCard = {
  id: string;
  code: string;
  company: string;
  sector: string;
  value: number;
  stage: string;
  responsible: string;
  probability: number;
  createdAt: string;
  notes?: string;
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
const MA_STAGES = [
  { id: "prospeccao",  label: "Prospecção",    color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
  { id: "ioi",         label: "IOI",           color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
  { id: "due_dilig",   label: "Due Diligence", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  { id: "proposta",    label: "Proposta",      color: "#C9A84C", bg: "rgba(196,146,46,0.1)" },
  { id: "negociacao",  label: "Negociação",    color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
  { id: "closing",     label: "Closing",       color: "#10B981", bg: "rgba(16,185,129,0.1)" },
];

const MA_STAGES_DEFAULT: MaStage[] = MA_PIPELINE.map(s => ({
  id: s.id,
  label: s.label,
  color: s.color,
  bg: s.bg.replace("0.12", "0.1"),
}));

// Mapeia nome da fase do Pipefy para o ID de estágio padrão do pipeline
function mapPhaseNameToStageId(name: string): string {
  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (n.includes("prospec")) return "prospeccao";
  if (n.includes("qualif") || n.includes("qualificacao")) return "qualificacao";
  if (n.includes("viabil") || n.includes("ioi") || n.includes("intenc")) return "viabilidade";
  if (n.includes("estrutur") || n.includes("oferta") || n.includes("proposta")) return "estruturacao";
  if (n.includes("negoc")) return "negociacao";
  if (n.includes("due") || n.includes("dilig") || n.includes("auditoria")) return "due_diligence";
  if (n.includes("aprova") || n.includes("fech") || n.includes("closing") || n.includes("conclu") || n.includes("won") || n.includes("ganho")) return "aprovacao";
  return "prospeccao";
}

function pipefyPhasesToStages(phases: PipefyPhase[]): MaStage[] {
  return phases.map((p, i) => ({
    id: mapPhaseNameToStageId(p.name),
    label: p.name,
    ...STAGE_COLORS[i % STAGE_COLORS.length],
  }));
}

const SECTORS = ["Fintech", "Real Estate", "Agronegócio", "Varejo", "Logística", "Saúde", "Tecnologia", "Indústria", "Energia", "Outro"];
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
function KanbanCardItem({ card, stages, onClick }: { card: MaCard; stages: MaStage[]; onClick: () => void }) {
  const stage = stages.find(s => s.id === card.stage);
  return (
    <div
      onClick={onClick}
      className="rounded-lg border border-[#122036] bg-[#091221] p-3 cursor-pointer hover:border-[#C9A84C]/60 hover:shadow-lg transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-[#E8EDF5] leading-tight group-hover:text-[#C9A84C] transition-colors">{card.company}</p>
        <span className="text-[10px] text-[#7A8FA8] flex-shrink-0 ml-1">{card.code}</span>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
          style={{ color: stage?.color, borderColor: `${stage?.color}40`, background: stage?.bg }}>
          {card.sector}
        </span>
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
      <p className="text-[10px] text-[#7A8FA8]">{card.responsible}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MesaMaClient({ userRole, initialDeals = [], userId = "", userName = "" }: { userRole: string; initialDeals?: MaCard[]; userId?: string; userName?: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"kanban" | "operadores" | "pipefy">("kanban");
  const [cards, setCards] = useState<MaCard[]>(initialDeals);
  const [operators, setOperators] = useState<MesaOperator[]>([]);
  const [selectedCard, setSelectedCard] = useState<MaCard | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [showNewOp, setShowNewOp] = useState(false);
  const [showPipefyChoice, setShowPipefyChoice] = useState(false);
  const [pipefyFormUrl, setPipefyFormUrl] = useState("");
  const [maStages, setMaStages] = useState<MaStage[]>(MA_STAGES_DEFAULT);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncCount, setLastSyncCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const syncedOnMount = useRef(false);

  const syncFromPipefy = useCallback(async (token: string, pipeId: string, silent = false) => {
    if (!token || !pipeId) return;
    if (!silent) setSyncing(true);
    try {
      const res = await fetch("/api/pipefy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_ma", token, pipeId, userId }),
      });
      const data = await res.json();
      if (data.success) {
        setLastSyncCount(data.synced ?? 0);
        // Sempre atualiza — independente de synced > 0
        startTransition(() => router.refresh());
      }
    } catch {}
    if (!silent) setSyncing(false);
  }, [router, userId]);

  // Atualiza cards quando initialDeals mudar (após router.refresh)
  useEffect(() => {
    setCards(initialDeals);
  }, [initialDeals]);

  // Load Pipefy config e auto-sync apenas na primeira montagem
  useEffect(() => {
    try {
      const saved = localStorage.getItem("v3_pipefy_mesa_ma");
      if (saved) {
        const config = JSON.parse(saved);
        if (config.formUrl) setPipefyFormUrl(config.formUrl);
        if (config.savedPhases?.length) {
          setMaStages(pipefyPhasesToStages(config.savedPhases));
        }
        // Auto-sync apenas uma vez ao montar (evita loop infinito)
        if (config.token && config.pipeId && !syncedOnMount.current) {
          syncedOnMount.current = true;
          syncFromPipefy(config.token, config.pipeId, true);
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New card form — stage defaults to first stage dynamically
  const [newCard, setNewCard] = useState({ company: "", sector: "Fintech", value: "", stage: "", responsible: "", notes: "" });
  const [newOp, setNewOp] = useState({ name: "", email: "", role: "Analista" });

  const totalValue = cards.reduce((a, c) => a + c.value, 0);
  const avgProb = cards.length ? Math.round(cards.reduce((a, c) => a + c.probability, 0) / cards.length) : 0;
  const lastStageId = maStages[maStages.length - 1]?.id ?? "closing";

  const handleAdvanceStage = (card: MaCard) => {
    const next = nextStage(card.stage, maStages);
    if (!next) return;
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, stage: next } : c));
    setSelectedCard(prev => prev ? { ...prev, stage: next } : null);
  };

  const handleCreateCard = async () => {
    if (!newCard.company || !newCard.value) return;
    const defaultStage = newCard.stage || maStages[0]?.id || "prospeccao";

    // Salva no Supabase via API
    try {
      const res = await fetch("/api/ma-deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: newCard.company,
          sector: newCard.sector,
          value: newCard.value,
          notes: newCard.notes,
        }),
      });
      const json = await res.json();
      if (json.card) {
        setCards(prev => [...prev, { ...json.card, stage: defaultStage }]);
        setNewCard({ company: "", sector: "Fintech", value: "", stage: "", responsible: "", notes: "" });
        setShowNewCard(false);
        return;
      }
    } catch {}

    // Fallback local (demo)
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
    setNewCard({ company: "", sector: "Fintech", value: "", stage: "", responsible: "", notes: "" });
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
    if (pipefyFormUrl) {
      setShowPipefyChoice(true);
    } else {
      setShowNewCard(true);
    }
  };

  const tabs = [
    { id: "kanban" as const, label: "Kanban" },
    { id: "operadores" as const, label: "Operadores" },
    { id: "pipefy" as const, label: "Pipefy" },
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
          {activeTab === "kanban" && (
            <button
              onClick={() => setShowNewCard(true)}
              className="flex items-center gap-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-semibold px-4 py-2 hover:bg-[#E8C97A] transition-colors"
            >
              <Plus size={14} />
              Nova Operação
            </button>
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
                        <KanbanCardItem key={card.id} card={card} stages={maStages} onClick={() => setSelectedCard(card)} />
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

        {/* ── PIPEFY TAB ─────────────────────────────────────── */}
        {activeTab === "pipefy" && (
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-[#E8EDF5] mb-1">Integração Pipefy — Mesa M&A</h3>
              <p className="text-xs text-[#7A8FA8]">Configure a sincronização das operações M&A com o Pipefy</p>
            </div>
            <PipefyConfig
              mesaName="M&A"
              storageKey="mesa_ma"
              stageMapping={maStages.map(s => ({ localStage: s.id, label: s.label }))}
              syncAction="sync_ma"
            />
          </div>
        )}
      </div>

      {/* ── CARD DETAIL MODAL ──────────────────────────────────── */}
      <Dialog open={!!selectedCard} onOpenChange={open => { if (!open) setSelectedCard(null); }}>
        <DialogContent className="bg-[#091221] border border-[#122036] text-[#E8EDF5] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#E8EDF5]">
              {selectedCard?.company}
              <span className="ml-2 text-xs font-normal text-[#7A8FA8]">{selectedCard?.code}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedCard && (() => {
            const stage = maStages.find(s => s.id === selectedCard.stage);
            const nextId = nextStage(selectedCard.stage, maStages);
            const nextStageData = nextId ? maStages.find(s => s.id === nextId) : null;
            return (
              <div className="space-y-4 mt-2">
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

                <div>
                  <label className="text-xs text-[#7A8FA8] mb-1.5 block">Observações</label>
                  <textarea
                    value={selectedCard.notes ?? ""}
                    onChange={e => setSelectedCard(prev => prev ? { ...prev, notes: e.target.value } : null)}
                    rows={3}
                    placeholder="Adicione observações sobre a operação..."
                    className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-xs px-3 py-2 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors resize-none"
                  />
                </div>

                {nextStageData && (
                  <button
                    onClick={() => handleAdvanceStage(selectedCard)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-medium py-2.5 hover:bg-[#C9A84C]/25 transition-colors"
                  >
                    Avançar para {nextStageData.label}
                    <ChevronRight size={16} />
                  </button>
                )}
                {!nextStageData && (
                  <div className="text-center py-2">
                    <span className="text-xs text-emerald-400">Operação na etapa final — {maStages[maStages.length - 1]?.label}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── PIPEFY CHOICE MODAL ────────────────────────────────── */}
      <Dialog open={showPipefyChoice} onOpenChange={setShowPipefyChoice}>
        <DialogContent className="bg-[#091221] border border-[#122036] text-[#E8EDF5] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[#E8EDF5]">Nova Operação M&A</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-[#5A7490] mt-1 mb-4">Como deseja cadastrar a operação?</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setShowPipefyChoice(false);
                window.open(pipefyFormUrl, "_blank");
              }}
              className="flex items-center gap-3 rounded-xl border border-[#C4922E]/40 bg-[#C4922E]/10 p-4 hover:bg-[#C4922E]/20 transition-colors text-left"
            >
              <ExternalLink size={18} className="text-[#C4922E] flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#E8EDF5]">Formulário Pipefy</p>
                <p className="text-xs text-[#5A7490]">Abre o formulário público do pipe no Pipefy</p>
              </div>
            </button>
            <button
              onClick={() => {
                setShowPipefyChoice(false);
                setShowNewCard(true);
              }}
              className="flex items-center gap-3 rounded-xl border border-[#122036] bg-[#0F1E35] p-4 hover:border-[#C4922E]/30 transition-colors text-left"
            >
              <FileText size={18} className="text-[#5A7490] flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#E8EDF5]">Formulário Local</p>
                <p className="text-xs text-[#5A7490]">Preencha direto na plataforma V3</p>
              </div>
            </button>
          </div>
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
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowNewCard(false)}
                className="flex-1 rounded-lg border border-[#122036] text-[#7A8FA8] text-sm py-2.5 hover:text-[#E8EDF5] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCard}
                disabled={!newCard.company || !newCard.value || !newCard.responsible}
                className="flex-1 rounded-lg bg-[#C9A84C] text-[#09081A] text-sm font-semibold py-2.5 hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Criar Operação
              </button>
            </div>
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
    </div>
  );
}
