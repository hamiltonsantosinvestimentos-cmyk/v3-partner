"use client";

import { useState } from "react";
import {
  Users, Plus, X, ChevronRight, BarChart2,
  Mail, Circle, Home, Car, Building
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PipefyConfig } from "@/components/shared/pipefy-config";

// ─── Types ────────────────────────────────────────────────────────────────────
type ConsorcioCard = {
  id: string;
  code: string;
  client: string;
  type: string;
  value: number;
  stage: string;
  responsible: string;
  quota: string;
  createdAt: string;
  notes?: string;
};

type ConsorcioOperator = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "online" | "offline" | "away";
  assignedCards: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const CONSORCIO_STAGES = [
  { id: "lead",         label: "Lead",         color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
  { id: "qualificacao", label: "Qualificação",  color: "#8B5CF6", bg: "rgba(139,92,246,0.1)" },
  { id: "simulacao",    label: "Simulação",     color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
  { id: "proposta",     label: "Proposta",      color: "#C4922E", bg: "rgba(196,146,46,0.1)" },
  { id: "documentacao", label: "Documentação",  color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
  { id: "contemplado",  label: "Contemplado",   color: "#10B981", bg: "rgba(16,185,129,0.1)" },
];

const DEMO_CARDS: ConsorcioCard[] = [
  { id: "cs-001", code: "CS-26-001", client: "José Santos", type: "Imóvel", value: 250000, stage: "lead", responsible: "Marcos Vieira", quota: "Carta 250K", createdAt: "2026-03-10" },
  { id: "cs-002", code: "CS-26-002", client: "Maria Oliveira", type: "Veículo", value: 85000, stage: "qualificacao", responsible: "Patrícia Lima", quota: "Carta 85K", createdAt: "2026-03-08" },
  { id: "cs-003", code: "CS-26-003", client: "Carlos Empresa Ltda", type: "Imóvel Comercial", value: 800000, stage: "simulacao", responsible: "Marcos Vieira", quota: "Carta 800K", createdAt: "2026-03-01" },
  { id: "cs-004", code: "CS-26-004", client: "Ana Paula Ferreira", type: "Imóvel", value: 320000, stage: "proposta", responsible: "Beatriz Costa", quota: "Carta 320K", createdAt: "2026-02-20" },
  { id: "cs-005", code: "CS-26-005", client: "Ricardo Alves", type: "Veículo", value: 120000, stage: "documentacao", responsible: "Patrícia Lima", quota: "Carta 120K", createdAt: "2026-02-10" },
  { id: "cs-006", code: "CS-26-006", client: "Investimentos SP Ltda", type: "Imóvel", value: 1200000, stage: "contemplado", responsible: "Beatriz Costa", quota: "Carta 1.2M", createdAt: "2026-01-20" },
];

const DEMO_OPERATORS: ConsorcioOperator[] = [
  { id: "op-cs-001", name: "Marcos Vieira", email: "marcos.vieira@v3partners.com", role: "Especialista Consórcio", status: "online", assignedCards: 2 },
  { id: "op-cs-002", name: "Patrícia Lima", email: "patricia.lima@v3partners.com", role: "Analista", status: "online", assignedCards: 2 },
  { id: "op-cs-003", name: "Beatriz Costa", email: "beatriz.costa@v3partners.com", role: "Consultora", status: "away", assignedCards: 2 },
  { id: "op-cs-004", name: "Felipe Mendes", email: "felipe.mendes@v3partners.com", role: "Analista Jr.", status: "offline", assignedCards: 0 },
];

const CARD_TYPES = ["Imóvel", "Imóvel Comercial", "Veículo", "Outros Bens", "Serviços"];
const ROLES_CS = ["Analista Jr.", "Analista", "Consultora", "Especialista Consórcio", "Gestor"];

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

function statusColor(s: ConsorcioOperator["status"]) {
  if (s === "online") return "#10B981";
  if (s === "away") return "#F59E0B";
  return "#5A7490";
}

function statusLabel(s: ConsorcioOperator["status"]) {
  if (s === "online") return "Online";
  if (s === "away") return "Ausente";
  return "Offline";
}

function typeIcon(type: string) {
  if (type.includes("Veículo")) return <Car size={11} />;
  if (type.includes("Comercial")) return <Building size={11} />;
  return <Home size={11} />;
}

function nextStage(current: string): string | null {
  const idx = CONSORCIO_STAGES.findIndex(s => s.id === current);
  if (idx === -1 || idx === CONSORCIO_STAGES.length - 1) return null;
  return CONSORCIO_STAGES[idx + 1].id;
}

// ─── Kanban Card ──────────────────────────────────────────────────────────────
function KanbanCardItem({ card, onClick }: { card: ConsorcioCard; onClick: () => void }) {
  const stage = CONSORCIO_STAGES.find(s => s.id === card.stage);
  return (
    <div
      onClick={onClick}
      className="rounded-lg border border-[#122036] bg-[#091221] p-3 cursor-pointer hover:border-[#C4922E]/60 hover:shadow-lg transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-[#E8EDF5] leading-tight group-hover:text-[#C4922E] transition-colors">{card.client}</p>
        <span className="text-[10px] text-[#5A7490] flex-shrink-0 ml-1">{card.code}</span>
      </div>
      <div className="flex items-center gap-1 mb-2">
        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border"
          style={{ color: stage?.color, borderColor: `${stage?.color}40`, background: stage?.bg }}>
          {typeIcon(card.type)}
          {card.type}
        </span>
      </div>
      <p className="text-sm font-bold text-[#C4922E] mb-1">{formatM(card.value)}</p>
      <p className="text-[10px] text-[#5A7490] mb-2">{card.quota}</p>
      <p className="text-[10px] text-[#5A7490]">{card.responsible}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MesaConsorcioClient({ userRole }: { userRole: string }) {
  const [activeTab, setActiveTab] = useState<"kanban" | "operadores" | "pipefy">("kanban");
  const [cards, setCards] = useState<ConsorcioCard[]>(DEMO_CARDS);
  const [operators, setOperators] = useState<ConsorcioOperator[]>(DEMO_OPERATORS);
  const [selectedCard, setSelectedCard] = useState<ConsorcioCard | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [showNewOp, setShowNewOp] = useState(false);

  // New card form
  const [newCard, setNewCard] = useState({ client: "", type: "Imóvel", value: "", stage: "lead", responsible: "", quota: "", notes: "" });
  // New operator form
  const [newOp, setNewOp] = useState({ name: "", email: "", role: "Analista" });

  // KPIs
  const totalValue = cards.reduce((a, c) => a + c.value, 0);
  const contemplados = cards.filter(c => c.stage === "contemplado").length;
  const imoveis = cards.filter(c => c.type.includes("Imóvel")).length;

  const handleAdvanceStage = (card: ConsorcioCard) => {
    const next = nextStage(card.stage);
    if (!next) return;
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, stage: next } : c));
    setSelectedCard(prev => prev ? { ...prev, stage: next } : null);
  };

  const handleCreateCard = () => {
    if (!newCard.client || !newCard.value || !newCard.responsible) return;
    const card: ConsorcioCard = {
      id: `cs-${Date.now()}`,
      code: `CS-26-${String(cards.length + 1).padStart(3, "0")}`,
      client: newCard.client,
      type: newCard.type,
      value: Number(newCard.value),
      stage: newCard.stage,
      responsible: newCard.responsible,
      quota: newCard.quota || `Carta ${formatM(Number(newCard.value)).replace("R$ ", "")}`,
      createdAt: new Date().toISOString().split("T")[0],
      notes: newCard.notes,
    };
    setCards(prev => [...prev, card]);
    setNewCard({ client: "", type: "Imóvel", value: "", stage: "lead", responsible: "", quota: "", notes: "" });
    setShowNewCard(false);
  };

  const handleCreateOp = () => {
    if (!newOp.name || !newOp.email) return;
    const op: ConsorcioOperator = {
      id: `op-cs-${Date.now()}`,
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

  const tabs = [
    { id: "kanban" as const, label: "Kanban" },
    { id: "operadores" as const, label: "Operadores" },
    { id: "pipefy" as const, label: "Pipefy" },
  ];

  return (
    <div className="min-h-screen bg-[#050C18] text-[#E8EDF5]">
      {/* Header */}
      <div className="border-b border-[#122036] bg-[#091221] px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#C4922E]/15 flex items-center justify-center">
              <Home size={18} className="text-[#C4922E]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#E8EDF5]">Mesa Consórcio</h1>
              <p className="text-xs text-[#5A7490]">Gestão de Cotas & Contemplações</p>
            </div>
          </div>
          {activeTab === "kanban" && (
            <button
              onClick={() => setShowNewCard(true)}
              className="flex items-center gap-2 rounded-lg bg-[#C4922E] text-[#050C18] text-xs font-semibold px-4 py-2 hover:bg-[#E5B96A] transition-colors"
            >
              <Plus size={14} />
              Nova Cota
            </button>
          )}
          {activeTab === "operadores" && (
            <button
              onClick={() => setShowNewOp(true)}
              className="flex items-center gap-2 rounded-lg border border-[#122036] bg-[#0F1E35] text-xs font-medium px-4 py-2 hover:border-[#C4922E]/50 hover:text-[#C4922E] transition-colors"
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
                  ? "border-[#C4922E] text-[#C4922E]"
                  : "border-transparent text-[#5A7490] hover:text-[#E8EDF5]"
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
                <p className="text-xs text-[#5A7490] mb-1">Total de Cotas</p>
                <p className="text-2xl font-bold text-[#E8EDF5]">{cards.length}</p>
              </div>
              <div className="rounded-xl border border-[#122036] bg-[#091221] p-4">
                <p className="text-xs text-[#5A7490] mb-1">Volume Total</p>
                <p className="text-2xl font-bold text-[#C4922E]">{formatM(totalValue)}</p>
              </div>
              <div className="rounded-xl border border-[#122036] bg-[#091221] p-4">
                <p className="text-xs text-[#5A7490] mb-1">Contemplados</p>
                <p className="text-2xl font-bold text-emerald-400">{contemplados}</p>
              </div>
              <div className="rounded-xl border border-[#122036] bg-[#091221] p-4">
                <p className="text-xs text-[#5A7490] mb-1">Cotas Imóvel</p>
                <p className="text-2xl font-bold text-blue-400">{imoveis}</p>
              </div>
            </div>

            {/* Kanban Board */}
            <div className="flex gap-4 overflow-x-auto pb-4">
              {CONSORCIO_STAGES.map(stage => {
                const stageCards = cards.filter(c => c.stage === stage.id);
                return (
                  <div key={stage.id} className="flex-shrink-0 w-60">
                    {/* Column header */}
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                      <span className="text-xs font-semibold text-[#E8EDF5] flex-1">{stage.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ color: stage.color, background: stage.bg }}>
                        {stageCards.length}
                      </span>
                    </div>
                    {/* Cards */}
                    <div className="space-y-2 min-h-[100px] rounded-xl border border-[#122036]/60 bg-[#050C18]/50 p-2">
                      {stageCards.map(card => (
                        <KanbanCardItem key={card.id} card={card} onClick={() => setSelectedCard(card)} />
                      ))}
                      {stageCards.length === 0 && (
                        <div className="h-16 flex items-center justify-center">
                          <p className="text-[11px] text-[#5A7490]">Sem cotas</p>
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
                <div key={op.id} className="rounded-xl border border-[#122036] bg-[#091221] p-5 relative group hover:border-[#C4922E]/40 transition-colors">
                  {userRole === "admin" && (
                    <button
                      onClick={() => setOperators(prev => prev.filter(o => o.id !== op.id))}
                      className="absolute top-3 right-3 text-[#5A7490] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-full bg-[#C4922E]/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-[#C4922E]">{initials(op.name)}</span>
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#091221] ${op.status === "online" ? "animate-pulse" : ""}`}
                        style={{ background: statusColor(op.status) }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#E8EDF5] truncate">{op.name}</p>
                      <p className="text-xs text-[#5A7490] truncate">{op.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mb-3">
                    <Circle size={7} fill={statusColor(op.status)} stroke="none" />
                    <span className="text-xs" style={{ color: statusColor(op.status) }}>{statusLabel(op.status)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-3">
                    <Mail size={11} className="text-[#5A7490]" />
                    <span className="text-[11px] text-[#5A7490] truncate">{op.email}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <BarChart2 size={11} className="text-[#5A7490]" />
                    <span className="text-xs text-[#5A7490]">{op.assignedCards} cota{op.assignedCards !== 1 ? "s" : ""} atribuída{op.assignedCards !== 1 ? "s" : ""}</span>
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
              <h3 className="text-sm font-semibold text-[#E8EDF5] mb-1">Integração Pipefy — Mesa Consórcio</h3>
              <p className="text-xs text-[#5A7490]">Configure a sincronização das cotas com o Pipefy</p>
            </div>
            <PipefyConfig
              mesaName="Consórcio"
              storageKey="mesa_consorcio"
              stageMapping={CONSORCIO_STAGES.map(s => ({ localStage: s.id, label: s.label }))}
            />
          </div>
        )}
      </div>

      {/* ── CARD DETAIL MODAL ──────────────────────────────────── */}
      <Dialog open={!!selectedCard} onOpenChange={open => { if (!open) setSelectedCard(null); }}>
        <DialogContent className="bg-[#091221] border border-[#122036] text-[#E8EDF5] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#E8EDF5]">
              {selectedCard?.client}
              <span className="ml-2 text-xs font-normal text-[#5A7490]">{selectedCard?.code}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedCard && (() => {
            const stage = CONSORCIO_STAGES.find(s => s.id === selectedCard.stage);
            const next = nextStage(selectedCard.stage);
            const nextStageData = next ? CONSORCIO_STAGES.find(s => s.id === next) : null;
            return (
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#5A7490] mb-1">Tipo</p>
                    <p className="text-sm font-medium text-[#E8EDF5]">{selectedCard.type}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#5A7490] mb-1">Valor da Carta</p>
                    <p className="text-sm font-bold text-[#C4922E]">{formatM(selectedCard.value)}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#5A7490] mb-1">Etapa atual</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: stage?.color, background: stage?.bg }}>
                      {stage?.label}
                    </span>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#5A7490] mb-1">Responsável</p>
                    <p className="text-sm text-[#E8EDF5]">{selectedCard.responsible}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#5A7490] mb-1">Cota</p>
                    <p className="text-sm text-[#E8EDF5]">{selectedCard.quota}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#5A7490] mb-1">Data de entrada</p>
                    <p className="text-sm text-[#E8EDF5]">{formatDate(selectedCard.createdAt)}</p>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs text-[#5A7490] mb-1.5 block">Observações</label>
                  <textarea
                    value={selectedCard.notes ?? ""}
                    onChange={e => setSelectedCard(prev => prev ? { ...prev, notes: e.target.value } : null)}
                    rows={3}
                    placeholder="Adicione observações sobre a cota..."
                    className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-xs px-3 py-2 placeholder:text-[#5A7490] focus:outline-none focus:border-[#C4922E] transition-colors resize-none"
                  />
                </div>

                {/* Advance stage */}
                {nextStageData && (
                  <button
                    onClick={() => handleAdvanceStage(selectedCard)}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#C4922E]/15 border border-[#C4922E]/40 text-[#C4922E] text-sm font-medium py-2.5 hover:bg-[#C4922E]/25 transition-colors"
                  >
                    Avançar para {nextStageData.label}
                    <ChevronRight size={16} />
                  </button>
                )}
                {!nextStageData && (
                  <div className="text-center py-2">
                    <span className="text-xs text-emerald-400">Cota Contemplada</span>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── NEW CARD MODAL ─────────────────────────────────────── */}
      <Dialog open={showNewCard} onOpenChange={setShowNewCard}>
        <DialogContent className="bg-[#091221] border border-[#122036] text-[#E8EDF5] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#E8EDF5]">Nova Cota Consórcio</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-[#5A7490] mb-1.5 block">Cliente *</label>
              <input
                value={newCard.client}
                onChange={e => setNewCard(p => ({ ...p, client: e.target.value }))}
                placeholder="Nome do cliente"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#5A7490] focus:outline-none focus:border-[#C4922E] transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#5A7490] mb-1.5 block">Tipo de Bem *</label>
                <select
                  value={newCard.type}
                  onChange={e => setNewCard(p => ({ ...p, type: e.target.value }))}
                  className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C4922E] transition-colors"
                >
                  {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#5A7490] mb-1.5 block">Etapa</label>
                <select
                  value={newCard.stage}
                  onChange={e => setNewCard(p => ({ ...p, stage: e.target.value }))}
                  className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C4922E] transition-colors"
                >
                  {CONSORCIO_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-[#5A7490] mb-1.5 block">Valor da Carta (R$) *</label>
              <input
                type="number"
                value={newCard.value}
                onChange={e => setNewCard(p => ({ ...p, value: e.target.value }))}
                placeholder="Ex: 250000"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#5A7490] focus:outline-none focus:border-[#C4922E] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#5A7490] mb-1.5 block">Responsável *</label>
              <input
                value={newCard.responsible}
                onChange={e => setNewCard(p => ({ ...p, responsible: e.target.value }))}
                placeholder="Nome do responsável"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#5A7490] focus:outline-none focus:border-[#C4922E] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#5A7490] mb-1.5 block">Identificação da Cota</label>
              <input
                value={newCard.quota}
                onChange={e => setNewCard(p => ({ ...p, quota: e.target.value }))}
                placeholder="Ex: Carta 250K"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#5A7490] focus:outline-none focus:border-[#C4922E] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#5A7490] mb-1.5 block">Observações</label>
              <textarea
                value={newCard.notes}
                onChange={e => setNewCard(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Observações iniciais..."
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2 placeholder:text-[#5A7490] focus:outline-none focus:border-[#C4922E] transition-colors resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowNewCard(false)}
                className="flex-1 rounded-lg border border-[#122036] text-[#5A7490] text-sm py-2.5 hover:text-[#E8EDF5] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCard}
                disabled={!newCard.client || !newCard.value || !newCard.responsible}
                className="flex-1 rounded-lg bg-[#C4922E] text-[#050C18] text-sm font-semibold py-2.5 hover:bg-[#E5B96A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Criar Cota
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
              <label className="text-xs text-[#5A7490] mb-1.5 block">Nome completo *</label>
              <input
                value={newOp.name}
                onChange={e => setNewOp(p => ({ ...p, name: e.target.value }))}
                placeholder="Nome do operador"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#5A7490] focus:outline-none focus:border-[#C4922E] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#5A7490] mb-1.5 block">Email *</label>
              <input
                type="email"
                value={newOp.email}
                onChange={e => setNewOp(p => ({ ...p, email: e.target.value }))}
                placeholder="email@v3partners.com"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#5A7490] focus:outline-none focus:border-[#C4922E] transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-[#5A7490] mb-1.5 block">Função</label>
              <select
                value={newOp.role}
                onChange={e => setNewOp(p => ({ ...p, role: e.target.value }))}
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C4922E] transition-colors"
              >
                {ROLES_CS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowNewOp(false)}
                className="flex-1 rounded-lg border border-[#122036] text-[#5A7490] text-sm py-2.5 hover:text-[#E8EDF5] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateOp}
                disabled={!newOp.name || !newOp.email}
                className="flex-1 rounded-lg bg-[#C4922E] text-[#050C18] text-sm font-semibold py-2.5 hover:bg-[#E5B96A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
