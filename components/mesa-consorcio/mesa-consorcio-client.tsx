"use client";

import { useState, useEffect } from "react";
import {
  Users, Plus, X, ChevronRight, BarChart2,
  Mail, Circle, Home, Car, Building, Trash2, Loader2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  { id: "proposta",     label: "Proposta",      color: "#C9A84C", bg: "rgba(196,146,46,0.1)" },
  { id: "documentacao", label: "Documentação",  color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
  { id: "contemplado",  label: "Contemplado",   color: "#10B981", bg: "rgba(16,185,129,0.1)" },
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
  return "#7A8FA8";
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
      className="rounded-lg border border-[#122036] bg-[#091221] p-3 cursor-pointer hover:border-[#C9A84C]/60 hover:shadow-lg transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-[#E8EDF5] leading-tight group-hover:text-[#C9A84C] transition-colors">{card.client}</p>
        <span className="text-[10px] text-[#7A8FA8] flex-shrink-0 ml-1">{card.code}</span>
      </div>
      <div className="flex items-center gap-1 mb-2">
        <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border"
          style={{ color: stage?.color, borderColor: `${stage?.color}40`, background: stage?.bg }}>
          {typeIcon(card.type)}
          {card.type}
        </span>
      </div>
      <p className="text-sm font-bold text-[#C9A84C] mb-1">{formatM(card.value)}</p>
      <p className="text-[10px] text-[#7A8FA8] mb-2">{card.quota}</p>
      <p className="text-[10px] text-[#7A8FA8]">{card.responsible}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function MesaConsorcioClient({ userRole }: { userRole: string }) {
  const [activeTab, setActiveTab] = useState<"kanban" | "operadores">("kanban");
  const [cards, setCards] = useState<ConsorcioCard[]>([]);
  const [operators, setOperators] = useState<ConsorcioOperator[]>([]);
  const [selectedCard, setSelectedCard] = useState<ConsorcioCard | null>(null);
  const [showNewCard, setShowNewCard] = useState(false);
  const [showNewOp, setShowNewOp] = useState(false);
  const [deletingCard, setDeletingCard] = useState<string | null>(null);

  // New card form
  const [newCard, setNewCard] = useState({ client: "", type: "Imóvel", value: "", stage: "lead", responsible: "", quota: "", notes: "" });
  // New operator form
  const [newOp, setNewOp] = useState({ name: "", email: "", role: "Analista" });

  const ADMIN_ROLES_MC = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
  const isAdmin = ADMIN_ROLES_MC.includes(userRole);

  useEffect(() => {
    fetch("/api/consorcio/leads")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.leads)) {
          setCards(data.leads.map((l: Record<string, unknown>) => ({
            id: l.id as string,
            code: l.code as string,
            client: l.client as string,
            type: l.type as string,
            value: l.value as number,
            stage: l.stage as string,
            responsible: l.responsible as string,
            quota: (l.quota as string) ?? "",
            createdAt: l.created_at as string,
            notes: (l.notes as string) ?? undefined,
          })));
        }
      })
      .catch(() => {/* not admin or not authenticated, leave empty */});
  }, []);

  // KPIs
  const totalValue = cards.reduce((a, c) => a + c.value, 0);
  const contemplados = cards.filter(c => c.stage === "contemplado").length;
  const imoveis = cards.filter(c => c.type.includes("Imóvel")).length;

  const handleAdvanceStage = async (card: ConsorcioCard) => {
    const next = nextStage(card.stage);
    if (!next) return;
    setCards(prev => prev.map(c => c.id === card.id ? { ...c, stage: next } : c));
    setSelectedCard(prev => prev ? { ...prev, stage: next } : null);
    await fetch("/api/consorcio/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: card.id, stage: next }),
    }).catch(() => {/* optimistic, ignore error */});
  };

  const handleCreateCard = async () => {
    if (!newCard.client || !newCard.value || !newCard.responsible) return;
    const res = await fetch("/api/consorcio/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: newCard.client,
        type: newCard.type,
        value: Number(newCard.value),
        stage: newCard.stage,
        responsible: newCard.responsible,
        quota: newCard.quota || `Carta ${formatM(Number(newCard.value)).replace("R$ ", "")}`,
        notes: newCard.notes || null,
      }),
    });
    const json = await res.json();
    if (json.lead) {
      const lead = json.lead as Record<string, unknown>;
      const card: ConsorcioCard = {
        id: lead.id as string,
        code: lead.code as string,
        client: lead.client as string,
        type: lead.type as string,
        value: lead.value as number,
        stage: lead.stage as string,
        responsible: lead.responsible as string,
        quota: (lead.quota as string) ?? "",
        createdAt: lead.created_at as string,
        notes: (lead.notes as string) ?? undefined,
      };
      setCards(prev => [...prev, card]);
    }
    setNewCard({ client: "", type: "Imóvel", value: "", stage: "lead", responsible: "", quota: "", notes: "" });
    setShowNewCard(false);
  };

  const handleDeleteCard = async (id: string) => {
    const reason = window.prompt(
      userRole === "ADMIN"
        ? "Motivo da exclusão (obrigatório):"
        : "Motivo da solicitação de exclusão (obrigatório, será enviado por email à governança):"
    );
    if (!reason || reason.trim().length < 5) {
      if (reason !== null) alert("Motivo obrigatório: mínimo 5 caracteres");
      return;
    }
    setDeletingCard(id);
    try {
      const res = await fetch(`/api/consorcio/leads/${id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.mode === "deleted") {
          alert("Cota excluída. Disponível na Lixeira por 30 dias.");
          setCards(prev => prev.filter(c => c.id !== id));
          setSelectedCard(null);
        } else {
          alert("Solicitação enviada por email à governança. A cota continua ativa até a decisão do ADMIN.");
        }
      } else {
        alert(json.error ?? "Erro ao processar exclusão");
      }
    } catch { alert("Erro de conexão"); }
    setDeletingCard(null);
  };

  // ─── Lixeira (ADMIN) ─────────────────────────────────────────────────────
  const [showLixeira, setShowLixeira] = useState(false);
  const [lixeiraItems, setLixeiraItems] = useState<any[]>([]);
  const [lixeiraLoading, setLixeiraLoading] = useState(false);

  const loadLixeira = async () => {
    setLixeiraLoading(true);
    try {
      const res = await fetch("/api/consorcio/lixeira");
      const json = await res.json();
      setLixeiraItems(json.items ?? []);
    } catch { setLixeiraItems([]); }
    finally { setLixeiraLoading(false); }
  };

  const restoreFromLixeira = async (itemType: string, itemId: string) => {
    try {
      const res = await fetch("/api/consorcio/lixeira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: itemType, item_id: itemId }),
      });
      if (res.ok) {
        setLixeiraItems((prev) => prev.filter((i) => i.id !== itemId));
      } else {
        alert("Erro ao restaurar registro");
      }
    } catch { alert("Erro de conexão"); }
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
  ];

  return (
    <div className="min-h-screen bg-[#09081A] text-[#E8EDF5]">
      {/* Header */}
      <div className="border-b border-[#122036] bg-[#091221] px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#C9A84C]/15 flex items-center justify-center">
              <Home size={18} className="text-[#C9A84C]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#E8EDF5]">Mesa Consórcio</h1>
              <p className="text-xs text-[#7A8FA8]">Gestão de Cotas & Contemplações</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "kanban" && (
              <button
                onClick={() => setShowNewCard(true)}
                className="flex items-center gap-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-semibold px-4 py-2 hover:bg-[#E8C97A] transition-colors"
              >
                <Plus size={14} />
                Nova Cota
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { setShowLixeira(true); loadLixeira(); }}
                className="flex items-center gap-2 rounded-lg border border-[#7A8FA8]/40 text-[#7A8FA8] text-xs font-semibold px-3 py-2 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
              >
                <Trash2 size={14} />
                Lixeira
              </button>
            )}
          </div>

          {/* Modal Lixeira */}
          {showLixeira && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => setShowLixeira(false)}>
              <div className="w-full max-w-lg max-h-[80vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
                  <div className="text-sm font-bold text-[#E8EDF5]">Lixeira · Consórcio (30 dias)</div>
                  <button onClick={() => setShowLixeira(false)} className="text-[#7A8FA8] hover:text-[#E8EDF5] text-xl">&times;</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {lixeiraLoading ? (
                    <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#C9A84C]" /></div>
                  ) : lixeiraItems.length === 0 ? (
                    <div className="text-center text-xs text-[#7A8FA8] py-8">Lixeira vazia</div>
                  ) : (
                    lixeiraItems.map((item: any) => (
                      <div key={item.id} className="bg-[#0d1526] border border-[#122036] rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs font-bold text-[#E8EDF5]">
                              {item.client ?? item.name ?? item.group_name ?? item.code} <span className="text-[#7A8FA8] font-normal">({item.item_type})</span>
                            </div>
                            <div className="text-[10px] text-[#7A8FA8]">excluído por {item.profiles?.full_name ?? "N/D"}</div>
                            <div className="text-[10px] text-red-400 mt-1">{item.deletion_reason}</div>
                            <div className="text-[9px] text-[#7A8FA8]/70 mt-1">{item.days_remaining} dias restantes na lixeira</div>
                          </div>
                          <button onClick={() => restoreFromLixeira(item.item_type, item.id)}
                            className="flex-shrink-0 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/20 transition">
                            Restaurar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
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
                <p className="text-xs text-[#7A8FA8] mb-1">Total de Cotas</p>
                <p className="text-2xl font-bold text-[#E8EDF5]">{cards.length}</p>
              </div>
              <div className="rounded-xl border border-[#122036] bg-[#091221] p-4">
                <p className="text-xs text-[#7A8FA8] mb-1">Volume Total</p>
                <p className="text-2xl font-bold text-[#C9A84C]">{formatM(totalValue)}</p>
              </div>
              <div className="rounded-xl border border-[#122036] bg-[#091221] p-4">
                <p className="text-xs text-[#7A8FA8] mb-1">Contemplados</p>
                <p className="text-2xl font-bold text-emerald-400">{contemplados}</p>
              </div>
              <div className="rounded-xl border border-[#122036] bg-[#091221] p-4">
                <p className="text-xs text-[#7A8FA8] mb-1">Cotas Imóvel</p>
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
                    <div className="space-y-2 min-h-[100px] rounded-xl border border-[#122036]/60 bg-[#09081A]/50 p-2">
                      {stageCards.map(card => (
                        <KanbanCardItem key={card.id} card={card} onClick={() => setSelectedCard(card)} />
                      ))}
                      {stageCards.length === 0 && (
                        <div className="h-16 flex items-center justify-center">
                          <p className="text-[11px] text-[#7A8FA8]">Sem cotas</p>
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
                  {userRole === "admin" && (
                    <button
                      onClick={() => setOperators(prev => prev.filter(o => o.id !== op.id))}
                      className="absolute top-3 right-3 text-[#7A8FA8] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <div className="relative">
                      <div className="w-11 h-11 rounded-full bg-[#C9A84C]/20 flex items-center justify-center">
                        <span className="text-sm font-bold text-[#C9A84C]">{initials(op.name)}</span>
                      </div>
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#091221] ${op.status === "online" ? "animate-pulse" : ""}`}
                        style={{ background: statusColor(op.status) }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#E8EDF5] truncate">{op.name}</p>
                      <p className="text-xs text-[#7A8FA8] truncate">{op.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mb-3">
                    <Circle size={7} fill={statusColor(op.status)} stroke="none" />
                    <span className="text-xs" style={{ color: statusColor(op.status) }}>{statusLabel(op.status)}</span>
                  </div>

                  <div className="flex items-center gap-1.5 mb-3">
                    <Mail size={11} className="text-[#7A8FA8]" />
                    <span className="text-[11px] text-[#7A8FA8] truncate">{op.email}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <BarChart2 size={11} className="text-[#7A8FA8]" />
                    <span className="text-xs text-[#7A8FA8]">{op.assignedCards} cota{op.assignedCards !== 1 ? "s" : ""} atribuída{op.assignedCards !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


      </div>

      {/* ── CARD DETAIL MODAL ──────────────────────────────────── */}
      <Dialog open={!!selectedCard} onOpenChange={open => { if (!open) setSelectedCard(null); }}>
        <DialogContent className="bg-[#091221] border border-[#122036] text-[#E8EDF5] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#E8EDF5]">
              {selectedCard?.client}
              <span className="ml-2 text-xs font-normal text-[#7A8FA8]">{selectedCard?.code}</span>
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
                    <p className="text-xs text-[#7A8FA8] mb-1">Tipo</p>
                    <p className="text-sm font-medium text-[#E8EDF5]">{selectedCard.type}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#7A8FA8] mb-1">Valor da Carta</p>
                    <p className="text-sm font-bold text-[#C9A84C]">{formatM(selectedCard.value)}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#7A8FA8] mb-1">Etapa atual</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: stage?.color, background: stage?.bg }}>
                      {stage?.label}
                    </span>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#7A8FA8] mb-1">Responsável</p>
                    <p className="text-sm text-[#E8EDF5]">{selectedCard.responsible}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#7A8FA8] mb-1">Cota</p>
                    <p className="text-sm text-[#E8EDF5]">{selectedCard.quota}</p>
                  </div>
                  <div className="rounded-lg bg-[#0F1E35] border border-[#122036] p-3">
                    <p className="text-xs text-[#7A8FA8] mb-1">Data de entrada</p>
                    <p className="text-sm text-[#E8EDF5]">{formatDate(selectedCard.createdAt)}</p>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs text-[#7A8FA8] mb-1.5 block">Observações</label>
                  <textarea
                    value={selectedCard.notes ?? ""}
                    onChange={e => setSelectedCard(prev => prev ? { ...prev, notes: e.target.value } : null)}
                    rows={3}
                    placeholder="Adicione observações sobre a cota..."
                    className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-xs px-3 py-2 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors resize-none"
                  />
                </div>

                {/* Advance stage */}
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
                    <span className="text-xs text-emerald-400">Cota Contemplada</span>
                  </div>
                )}

                {/* Delete (admin only) */}
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteCard(selectedCard.id)}
                    disabled={deletingCard === selectedCard.id}
                    className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-500/30 text-red-400/70 text-sm py-2 hover:text-red-400 hover:border-red-500/60 transition-colors"
                  >
                    {deletingCard === selectedCard.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Excluir Cota
                  </button>
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
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Cliente *</label>
              <input
                value={newCard.client}
                onChange={e => setNewCard(p => ({ ...p, client: e.target.value }))}
                placeholder="Nome do cliente"
                className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 placeholder:text-[#7A8FA8] focus:outline-none focus:border-[#C9A84C] transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Tipo de Bem *</label>
                <select
                  value={newCard.type}
                  onChange={e => setNewCard(p => ({ ...p, type: e.target.value }))}
                  className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
                >
                  {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#7A8FA8] mb-1.5 block">Etapa</label>
                <select
                  value={newCard.stage}
                  onChange={e => setNewCard(p => ({ ...p, stage: e.target.value }))}
                  className="w-full rounded-lg border border-[#122036] bg-[#0F1E35] text-[#E8EDF5] text-sm px-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
                >
                  {CONSORCIO_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Valor da Carta (R$) *</label>
              <input
                type="number"
                value={newCard.value}
                onChange={e => setNewCard(p => ({ ...p, value: e.target.value }))}
                placeholder="Ex: 250000"
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
              <label className="text-xs text-[#7A8FA8] mb-1.5 block">Identificação da Cota</label>
              <input
                value={newCard.quota}
                onChange={e => setNewCard(p => ({ ...p, quota: e.target.value }))}
                placeholder="Ex: Carta 250K"
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
                disabled={!newCard.client || !newCard.value || !newCard.responsible}
                className="flex-1 rounded-lg bg-[#C9A84C] text-[#09081A] text-sm font-semibold py-2.5 hover:bg-[#E8C97A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
                {ROLES_CS.map(r => <option key={r} value={r}>{r}</option>)}
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
