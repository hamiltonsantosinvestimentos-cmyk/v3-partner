"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Headphones, Plus, ChevronRight, User, Building2,
  Banknote, Clock, CheckCircle2, AlertCircle, Link2,
  LayoutGrid, List, Search, X, FileText, ArrowRight, ArrowLeft, MessageSquare, Trash2,
  ScrollText, RefreshCw, XCircle, Download,
} from "lucide-react";
import { ExportButton } from "@/components/financeiro/export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
  type OperationStatus, type TicketPriority,
} from "@/lib/constants";
import { PropostaDetailModal, PIPELINE_STAGES, type ProposalFull } from "@/components/mesa-credito/proposta-detail-modal";

// ─── Tipos ─────────────────────────────────────────────────────────────────
interface Ticket {
  id: string; code: string; title: string; category: string;
  priority: string; status: string; due_date: string | null; created_at: string;
}

interface ProposalCard {
  id: string; code: string; title: string;
  client_name: string; client_type?: string;
  credit_line: string; requested_value: number;
  stage: string; status: string;
  partner_name?: string; partner_id?: string;
  docs_uploaded?: number; docs_required?: number;
  created_at: string;
  cpf_cnpj?: string; email?: string; telefone?: string;
  approved_value?: number | null;
  prazo?: string; finalidade?: string;
  current_level?: string;
  mesa_comments_count?: number;
  valor_credito_atual?: number;
  comissao_mandato_perc?: number;
  comissao_instituicao_perc?: number;
  metadata?: Record<string, unknown>;
  instituicao_encaminhada?: string | null;
}

interface MesaOpClientProps {
  tickets: Ticket[];
  proposals: ProposalCard[];
  currentUser?: { id: string; full_name: string; role: string };
}

// ─── Novo Ticket Modal ─────────────────────────────────────────────────────
function NovoTicketModal({ open, onClose, onSubmit }: {
  open: boolean; onClose: () => void;
  onSubmit: (t: Ticket) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("operacional");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [descricao, setDescricao] = useState("");

  function submit() {
    if (!title.trim()) return;
    const t: Ticket = {
      id: `tick-${Date.now()}`, code: `TICK-26-${String(Date.now()).slice(-6)}`,
      title, category, priority,
      status: "PENDING",
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      created_at: new Date().toISOString(),
    };
    onSubmit(t);
    setTitle(""); setCategory("operacional"); setPriority("MEDIUM"); setDueDate(""); setDescricao("");
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-white">Abrir Novo Ticket</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Título *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Descreva o ticket..."
              className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Categoria</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
                {["compliance", "tecnico", "juridico", "onboarding", "operacional", "financeiro"].map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Prioridade</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Prazo</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Descrição</label>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3}
              placeholder="Detalhes do ticket..."
              className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={submit} disabled={!title.trim()}>Criar Ticket</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export function MesaOpClient({ tickets: initialTickets, proposals: initialProposals, currentUser }: MesaOpClientProps) {
  const [view, setView] = useState<"kanban" | "tickets" | "contratos">("kanban");
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [proposals, setProposals] = useState<ProposalCard[]>(initialProposals);

  // Busca dados frescos da API ao montar (reflete atualizações de outras abas)
  useEffect(() => {
    fetch("/api/credit-proposals")
      .then(r => r.json())
      .then(({ proposals: fresh }) => {
        if (!Array.isArray(fresh)) return;
        setProposals(fresh.map((p: Record<string, unknown>) => {
          const meta = p.metadata as Record<string, unknown> | null;
          return {
            id: p.id as string,
            code: p.code as string,
            title: p.title as string,
            client_name: p.client_name as string,
            client_type: (meta?.client_type as string | undefined) ?? p.client_type as string | undefined,
            cpf_cnpj: p.client_cpf_cnpj as string | undefined,
            email: meta?.email as string | undefined,
            telefone: meta?.telefone as string | undefined,
            prazo: meta?.prazo as string | undefined,
            finalidade: meta?.finalidade as string | undefined,
            credit_line: p.credit_line as string,
            requested_value: p.requested_value as number,
            approved_value: (p.approved_value as number | null) ?? null,
            current_level: p.current_level as string,
            status: p.status as string,
            stage: (p.stage as string | undefined) ?? "RECEBIDO",
            partner_id: (p.partner as { id?: string } | null)?.id,
            partner_name: (p.partner as { full_name?: string } | null)?.full_name,
            created_at: p.created_at as string,
            valor_credito_atual: p.valor_credito_atual as number | undefined,
            comissao_mandato_perc: p.comissao_mandato_perc as number | undefined,
            comissao_instituicao_perc: p.comissao_instituicao_perc as number | undefined,
            // Garante que metadata completo (com imoveis, endereço, cep, etc.) é passado
            metadata: meta ?? undefined,
            instituicao_encaminhada: p.instituicao_encaminhada as string | null | undefined,
          };
        }));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [novoTicket, setNovoTicket] = useState(false);
  const [detailProposal, setDetailProposal] = useState<ProposalCard | null>(null);
  const [search, setSearch] = useState("");
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const canChangeStage = (currentUser?.role === "MESA_OPERACIONAL" || currentUser?.role === "ADMIN" || currentUser?.role === "GESTAO");

  // ─── Ações rápidas de aprovação ───────────────────────────────────────────
  const [quickAction, setQuickAction] = useState<{ type: "aprovar" | "reprovar"; proposal: ProposalCard } | null>(null);
  const [quickValorAprovado, setQuickValorAprovado] = useState("");
  const [quickMotivo, setQuickMotivo] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  async function handleQuickAprovar() {
    if (!quickAction?.proposal || !quickValorAprovado) return;
    setQuickSaving(true);
    const parsed = parseFloat(quickValorAprovado.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, ""));
    try {
      const res = await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quickAction.proposal.id, status: "APPROVED", approved_value: parsed, stage: "FINALIZADO" }),
      });
      if (res.ok) {
        setProposals(prev => prev.map(p => p.id === quickAction.proposal.id ? { ...p, status: "APPROVED", stage: "FINALIZADO", approved_value: parsed } : p));
        if (quickAction.proposal.partner_id) {
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: quickAction.proposal.partner_id,
              title: `✅ Proposta ${quickAction.proposal.code} Aprovada`,
              message: `Sua proposta para ${quickAction.proposal.client_name} foi aprovada no valor de ${parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
              type: "proposal",
              action_url: "/minhas-operacoes",
            }),
          }).catch(() => {});
        }
        setQuickAction(null); setQuickValorAprovado("");
      }
    } finally { setQuickSaving(false); }
  }

  async function handleQuickReprovar() {
    if (!quickAction?.proposal || !quickMotivo.trim()) return;
    setQuickSaving(true);
    try {
      const meta = { ...(quickAction.proposal.metadata ?? {}), motivo_reprovacao: quickMotivo };
      const res = await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quickAction.proposal.id, status: "REJECTED", metadata: meta }),
      });
      if (res.ok) {
        setProposals(prev => prev.map(p => p.id === quickAction.proposal.id ? { ...p, status: "REJECTED", metadata: meta } : p));
        if (quickAction.proposal.partner_id) {
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: quickAction.proposal.partner_id,
              title: `❌ Proposta ${quickAction.proposal.code} Reprovada`,
              message: `Sua proposta para ${quickAction.proposal.client_name} foi reprovada. Motivo: ${quickMotivo}`,
              type: "proposal",
              action_url: "/minhas-operacoes",
            }),
          }).catch(() => {});
        }
        setQuickAction(null); setQuickMotivo("");
      }
    } finally { setQuickSaving(false); }
  }

  // ─── Painel de Contratos ─────────────────────────────────────────────────
  type ContratoItem = {
    id: string; token: string; status: string; proposal_code: string | null;
    client_name: string; client_email: string; credit_line: string | null;
    deal_value: number | null; commission_perc: number; expires_at: string;
    created_at: string; signed_at: string | null; v3_signed_at: string | null;
    v3_signer_name: string | null; testemunha_nome: string | null;
    testemunha_signed_at: string | null; testemunha2_nome: string | null;
    testemunha2_signed_at: string | null; contrato_url: string | null;
  };
  const [contratos, setContratos] = useState<ContratoItem[]>([]);
  const [contratosLoading, setContratosLoading] = useState(false);
  const [contratosSearch, setContratosSearch] = useState("");
  const [contratosFiltroStatus, setContratosFiltroStatus] = useState("TODOS");
  const [contratosAcao, setContratosAcao] = useState<Record<string, string>>({});

  function fetchContratos() {
    setContratosLoading(true);
    fetch(`/api/contratos/list?status=${contratosFiltroStatus}&q=${encodeURIComponent(contratosSearch)}`)
      .then(r => r.json())
      .then(({ contratos: data }) => setContratos(data ?? []))
      .catch(() => {})
      .finally(() => setContratosLoading(false));
  }

  useEffect(() => {
    if (view === "contratos") fetchContratos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, contratosFiltroStatus]);

  async function handleContratosReenviar(id: string, proposalCode: string) {
    setContratosAcao(prev => ({ ...prev, [id]: "reenviando" }));
    try {
      const res = await fetch("/api/contratos/reenviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contrato_id: id }),
      });
      const json = await res.json();
      setContratosAcao(prev => ({ ...prev, [id]: json.ok ? "reenviado" : "erro" }));
      setTimeout(() => setContratosAcao(prev => { const n = { ...prev }; delete n[id]; return n; }), 3000);
    } catch {
      setContratosAcao(prev => ({ ...prev, [id]: "erro" }));
    }
  }

  async function handleContratosCancelar(id: string) {
    if (!confirm("Cancelar este contrato?")) return;
    setContratosAcao(prev => ({ ...prev, [id]: "cancelando" }));
    try {
      const res = await fetch("/api/contratos/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contrato_id: id }),
      });
      const json = await res.json();
      if (json.ok) {
        setContratos(prev => prev.map(c => c.id === id ? { ...c, status: "CANCELADO" } : c));
      }
      setContratosAcao(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch {
      setContratosAcao(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  const CONTRATO_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
    PENDENTE:               { label: "Aguardando Cliente",     color: "text-blue-400",    bg: "bg-blue-500/10" },
    AGUARDANDO_V3:          { label: "Aguardando V3",          color: "text-amber-400",   bg: "bg-amber-500/10" },
    AGUARDANDO_TESTEMUNHA:  { label: "Aguardando Parceiro",    color: "text-purple-400",  bg: "bg-purple-500/10" },
    AGUARDANDO_TESTEMUNHA2: { label: "Aguardando Aline",       color: "text-orange-400",  bg: "bg-orange-500/10" },
    ASSINADO:               { label: "Assinado",               color: "text-emerald-400", bg: "bg-emerald-500/10" },
    CANCELADO:              { label: "Cancelado",              color: "text-red-400",     bg: "bg-red-500/10" },
    EXPIRADO:               { label: "Expirado",               color: "text-gray-400",    bg: "bg-gray-500/10" },
  };

  const openCount = tickets.filter((t) => ["PENDING", "IN_REVIEW"].includes(t.status)).length;
  const urgentCount = tickets.filter((t) => t.priority === "URGENT").length;

  const filteredProposals = proposals.filter((p) => {
    const matchSearch = !search ||
      p.client_name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      (p.partner_name ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStage = !selectedStage || p.stage === selectedStage;
    return matchSearch && matchStage;
  });

  const handleProposalUpdate = useCallback((proposalId: string, updates: Partial<ProposalCard>) => {
    setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, ...updates } : p));
    if (detailProposal?.id === proposalId) setDetailProposal(prev => prev ? { ...prev, ...updates } : prev);
  }, [detailProposal]);

  const handleStageChange = useCallback((proposalId: string, newStage: string) => {
    setProposals((prev) => prev.map((p) => p.id === proposalId ? { ...p, stage: newStage } : p));
    if (detailProposal?.id === proposalId) {
      setDetailProposal((prev) => prev ? { ...prev, stage: newStage } : prev);
    }
    // Persiste no banco
    fetch("/api/credit-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposalId, stage: newStage }),
    }).catch(() => {});
  }, [detailProposal]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Mesa Operacional</h1>
            <p className="text-xs text-muted-foreground">Gestão de propostas e tickets de suporte</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button onClick={() => setView("kanban")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "kanban" ? "bg-[#C9A84C]/15 text-[#E8C97A]" : "text-muted-foreground hover:text-white hover:bg-secondary"}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button onClick={() => setView("tickets")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "tickets" ? "bg-[#C9A84C]/15 text-[#E8C97A]" : "text-muted-foreground hover:text-white hover:bg-secondary"}`}>
              <List className="w-3.5 h-3.5" /> Tickets
            </button>
            <button onClick={() => setView("contratos")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "contratos" ? "bg-[#C9A84C]/15 text-[#E8C97A]" : "text-muted-foreground hover:text-white hover:bg-secondary"}`}>
              <ScrollText className="w-3.5 h-3.5" /> Contratos
            </button>
          </div>
          <Button size="sm" onClick={() => setNovoTicket(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo Ticket
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Propostas Ativas", value: proposals.filter((p) => p.stage !== "FINALIZADO").length, color: "text-blue-400", icon: <FileText className="w-4 h-4" /> },
          { label: "Tickets Abertos", value: openCount, color: "text-amber-400", icon: <Clock className="w-4 h-4" /> },
          { label: "Urgentes", value: urgentCount, color: "text-red-400", icon: <AlertCircle className="w-4 h-4" /> },
          { label: "Finalizados", value: proposals.filter((p) => p.stage === "FINALIZADO").length, color: "text-emerald-400", icon: <CheckCircle2 className="w-4 h-4" /> },
        ].map((kpi) => (
          <Card key={kpi.label}><CardContent className="p-4 flex items-center gap-3">
            <div className={kpi.color}>{kpi.icon}</div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          </CardContent></Card>
        ))}
      </div>

      {/* ── VIEW: KANBAN ── */}
      {view === "kanban" && (
        <div className="space-y-4">
          {/* Search + stage filter */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por cliente, código, partner..."
                className="w-full h-9 pl-9 pr-4 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div className="flex gap-1 flex-wrap">
              {PIPELINE_STAGES.map((s) => (
                <button key={s.key} onClick={() => setSelectedStage(selectedStage === s.key ? null : s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    selectedStage === s.key ? `${s.bg} ${s.color} border-current/40` : "border-border text-muted-foreground hover:bg-secondary"
                  }`}>
                  {s.label}
                  <span className="ml-1 text-muted-foreground">
                    ({proposals.filter((p) => p.stage === s.key || (!p.stage && s.key === "RECEBIDO")).length})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Kanban board */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {PIPELINE_STAGES.map((stage) => {
              const stageProposals = filteredProposals.filter(
                (p) => (p.stage === stage.key) || (!p.stage && stage.key === "RECEBIDO")
              );
              return (
                <div key={stage.key} className="flex flex-col gap-2">
                  {/* Column header */}
                  <div className={`px-3 py-2 rounded-lg ${stage.bg} border border-current/20 flex items-center justify-between`}>
                    <span className={`text-xs font-semibold ${stage.color}`}>{stage.label}</span>
                    <span className={`text-xs font-bold ${stage.color}`}>{stageProposals.length}</span>
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 min-h-24">
                    {stageProposals.map((p) => (
                      <div key={p.id}
                        className="relative w-full text-left p-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all group cursor-pointer"
                        onClick={() => setDetailProposal(p)}>
                        <div className="flex items-start justify-between gap-1 mb-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{p.code}</span>
                          <div className="flex items-center gap-1">
                            {currentUser?.role === "ADMIN" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!confirm(`Excluir proposta ${p.code} de ${p.client_name}? Esta ação não pode ser desfeita.`)) return;
                                  fetch(`/api/credit-proposals?id=${p.id}`, { method: "DELETE" })
                                    .then(() => setProposals(prev => prev.filter(x => x.id !== p.id)))
                                    .catch(() => alert("Erro ao excluir proposta."));
                                }}
                                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/15 transition-colors opacity-0 group-hover:opacity-100"
                                title="Excluir proposta"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-foreground leading-tight mb-1.5 line-clamp-2">{p.client_name}</p>
                        <div className="flex items-center gap-1 mb-1.5">
                          {p.client_type === "PJ"
                            ? <Building2 className="w-3 h-3 text-muted-foreground" />
                            : <User className="w-3 h-3 text-muted-foreground" />}
                          <span className="text-[10px] text-muted-foreground">{p.client_type ?? "PF"}</span>
                        </div>
                        <Badge className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary border-primary/30">{p.credit_line}</Badge>
                        <p className="text-xs font-bold text-white mt-1.5">{formatCurrency(p.requested_value)}</p>
                        {p.partner_name && (
                          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Link2 className="w-2.5 h-2.5" />{p.partner_name}
                          </p>
                        )}
                        {typeof p.docs_uploaded === "number" && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <div className="flex-1 h-1 bg-secondary rounded-full">
                              <div className="h-1 bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, ((p.docs_uploaded ?? 0) / (p.docs_required || 1)) * 100)}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">{p.docs_uploaded}/{p.docs_required}</span>
                          </div>
                        )}
                        {(p.mesa_comments_count ?? 0) > 0 && (
                          <div className="mt-1 flex items-center gap-1">
                            <MessageSquare className="w-2.5 h-2.5 text-primary" />
                            <span className="text-[10px] text-primary font-semibold">{p.mesa_comments_count} msg</span>
                          </div>
                        )}
                        {/* Botões de aprovação rápida — apenas em "Em Aprovação" */}
                        {canChangeStage && p.stage === "APROVACAO" && p.status !== "APPROVED" && p.status !== "REJECTED" && (
                          <div className="mt-2 pt-2 border-t border-purple-500/20 flex gap-1.5" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => { setQuickAction({ type: "reprovar", proposal: p }); setQuickMotivo(""); }}
                              className="flex-1 py-1 rounded text-[10px] font-semibold bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors"
                            >✗ Reprovar</button>
                            <button
                              onClick={() => { setQuickAction({ type: "aprovar", proposal: p }); setQuickValorAprovado(""); }}
                              className="flex-1 py-1 rounded text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                            >✓ Aprovar</button>
                          </div>
                        )}
                        {p.instituicao_encaminhada && (() => {
                          let insts: string[] = [];
                          try { const a = JSON.parse(p.instituicao_encaminhada); insts = Array.isArray(a) ? a : [p.instituicao_encaminhada]; }
                          catch { insts = [p.instituicao_encaminhada]; }
                          return insts.length > 0 ? (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {insts.map((inst, i) => (
                                <span key={i} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/30 text-[#C9A84C] text-[9px] font-semibold">
                                  <Building2 className="w-2.5 h-2.5 flex-shrink-0" />{inst}
                                </span>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    ))}

                    {stageProposals.length === 0 && (
                      <div className="flex items-center justify-center h-16 rounded-xl border border-dashed border-border/50">
                        <span className="text-[10px] text-muted-foreground">Vazio</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── VIEW: TICKETS ── */}
      {view === "tickets" && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Todos os Tickets</CardTitle>
            <ExportButton opts={{
              titulo: "Tickets Operacionais",
              orientacao: "landscape",
              colunas: [
                { header: "Código", key: "code", width: 14 },
                { header: "Título", key: "title", width: 35 },
                { header: "Categoria", key: "category", width: 14 },
                { header: "Prioridade", key: "priority", width: 12 },
                { header: "Status", key: "status", width: 12 },
                { header: "Vencimento", key: "due_date", format: "date", width: 14 },
                { header: "Criado em", key: "created_at", format: "date", width: 14 },
              ],
              dados: tickets,
            }} />
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Código", "Título", "Categoria", "Prioridade", "Status", "Vencimento", "Ação"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="data-table-row">
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{ticket.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-52 truncate">{ticket.title}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{ticket.category}</td>
                      <td className="px-4 py-3">
                        <Badge className={PRIORITY_COLORS[ticket.priority as TicketPriority]}>{PRIORITY_LABELS[ticket.priority as TicketPriority]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[ticket.status as OperationStatus]}>{STATUS_LABELS[ticket.status as OperationStatus]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{ticket.due_date ? formatDateTime(ticket.due_date) : "—"}</td>
                      <td className="px-4 py-3 flex items-center gap-2">
                        {ticket.status !== "PENDING" && (
                          <button
                            onClick={async () => {
                              const newStatus = ticket.status === "COMPLETED" ? "IN_REVIEW" : "PENDING";
                              setTickets((prev) => prev.map((t) => t.id === ticket.id ? { ...t, status: newStatus } : t));
                              await fetch("/api/tickets", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: ticket.id, status: newStatus }),
                              }).catch(() => {});
                            }}
                            className="text-xs text-muted-foreground hover:text-white flex items-center gap-1"
                          >
                            <ArrowLeft className="w-3 h-3" />
                            {ticket.status === "COMPLETED" ? "Em Revisão" : "Pendente"}
                          </button>
                        )}
                        {ticket.status !== "COMPLETED" && (
                          <button
                            onClick={async () => {
                              const newStatus = ticket.status === "PENDING" ? "IN_REVIEW" : "COMPLETED";
                              setTickets((prev) => prev.map((t) => t.id === ticket.id ? { ...t, status: newStatus } : t));
                              await fetch("/api/tickets", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: ticket.id, status: newStatus }),
                              }).catch(() => {});
                            }}
                            className="text-xs text-primary hover:underline flex items-center gap-1"
                          >
                            {ticket.status === "PENDING" ? "Iniciar" : "Concluir"}
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                        {currentUser?.role === "ADMIN" && (
                          <button
                            onClick={async () => {
                              if (!confirm("Excluir este ticket permanentemente?")) return;
                              await fetch(`/api/tickets?id=${ticket.id}`, { method: "DELETE" });
                              setTickets(prev => prev.filter(t => t.id !== ticket.id));
                            }}
                            className="text-xs text-red-400 hover:text-red-300"
                          >
                            Excluir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}


      {/* ── VIEW: CONTRATOS ── */}
      {view === "contratos" && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={contratosSearch}
                onChange={(e) => setContratosSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchContratos()}
                placeholder="Buscar por cliente, código, e-mail..."
                className="w-full h-9 pl-9 pr-4 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-1 flex-wrap">
              {["TODOS", "PENDENTE", "AGUARDANDO_V3", "AGUARDANDO_TESTEMUNHA", "AGUARDANDO_TESTEMUNHA2", "ASSINADO", "CANCELADO", "EXPIRADO"].map((s) => {
                const cfg = CONTRATO_STATUS_CFG[s] ?? { label: "Todos", color: "text-white", bg: "bg-white/10" };
                return (
                  <button key={s} onClick={() => setContratosFiltroStatus(s)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border ${
                      contratosFiltroStatus === s
                        ? `${cfg.bg} ${cfg.color} border-current/30`
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}>
                    {s === "TODOS" ? "Todos" : cfg.label}
                  </button>
                );
              })}
            </div>
            <button onClick={fetchContratos} className="p-2 rounded-lg border border-border text-muted-foreground hover:text-white hover:bg-secondary transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Tabela */}
          <Card>
            <CardContent className="p-0">
              {contratosLoading ? (
                <div className="py-16 text-center text-muted-foreground text-sm">Carregando contratos…</div>
              ) : contratos.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-sm">Nenhum contrato encontrado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/50">
                        {["Proposta", "Cliente", "Linha", "Status", "Assinaturas", "Expira", "Ações"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contratos.map((c) => {
                        const cfg = CONTRATO_STATUS_CFG[c.status] ?? CONTRATO_STATUS_CFG["EXPIRADO"];
                        const acao = contratosAcao[c.id];
                        const podeAgir = !["ASSINADO", "CANCELADO"].includes(c.status);
                        const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
                        const signatarios = [
                          c.signed_at            && "Cliente",
                          c.v3_signed_at         && "V3",
                          c.testemunha_signed_at  && "Parceiro",
                          c.testemunha2_signed_at && "Aline",
                        ].filter(Boolean);

                        return (
                          <tr key={c.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-[#C9A84C] whitespace-nowrap">{c.proposal_code ?? "—"}</td>
                            <td className="px-4 py-3 max-w-[160px]">
                              <p className="font-medium text-foreground truncate text-xs">{c.client_name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{c.client_email}</p>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{c.credit_line ?? "—"}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color} border border-current/20`}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1 flex-wrap">
                                {signatarios.length === 0 ? (
                                  <span className="text-[10px] text-muted-foreground">Nenhuma</span>
                                ) : signatarios.map((s) => (
                                  <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{s}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmt(c.expires_at)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {c.status === "ASSINADO" && c.contrato_url && (
                                  <a href={c.contrato_url} target="_blank" rel="noopener noreferrer"
                                    className="p-1.5 rounded border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-colors" title="Baixar certificado">
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                {podeAgir && (
                                  <>
                                    <button
                                      onClick={() => handleContratosReenviar(c.id, c.proposal_code ?? "")}
                                      disabled={!!acao}
                                      className="p-1.5 rounded border border-border text-muted-foreground hover:text-[#C9A84C] hover:border-[#C9A84C]/40 disabled:opacity-40 transition-colors"
                                      title="Reenviar link"
                                    >
                                      {acao === "reenviando" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                      onClick={() => handleContratosCancelar(c.id)}
                                      disabled={!!acao}
                                      className="p-1.5 rounded border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30 disabled:opacity-40 transition-colors"
                                      title="Cancelar contrato"
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                {acao === "reenviado" && <span className="text-[9px] text-emerald-400">✅ Enviado</span>}
                                {acao === "erro"      && <span className="text-[9px] text-red-400">Erro</span>}
                                {!c.status.includes("ASSINADO") && (
                                  <a href={`/assinar/${c.token}`} target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] text-muted-foreground hover:text-white underline" title="Ver contrato">
                                    Ver
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modais */}
      <NovoTicketModal open={novoTicket} onClose={() => setNovoTicket(false)}
        onSubmit={async (t) => {
          // Salva no Supabase; fallback local em demo
          try {
            const res = await fetch("/api/tickets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: t.title, category: t.category, priority: t.priority, due_date: t.due_date }),
            });
            const json = await res.json();
            if (json.ticket) { setTickets(prev => [json.ticket, ...prev]); return; }
          } catch {}
          setTickets(prev => [t, ...prev]);
        }} />

      <PropostaDetailModal
        open={!!detailProposal}
        onClose={() => setDetailProposal(null)}
        proposal={detailProposal as ProposalFull | null}
        onStageChange={handleStageChange}
        onProposalUpdate={handleProposalUpdate as (id: string, updates: Partial<ProposalFull>) => void}
        canChangeStage={canChangeStage}
        canEditValorSolicitado={canChangeStage}
        canCompileDocuments={canChangeStage}
        canEditInstituicao={canChangeStage}
      />

      {/* ── Modal Rápido: Aprovar ── */}
      {quickAction?.type === "aprovar" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-emerald-500/30 rounded-2xl w-full max-w-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Aprovar Proposta</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">{quickAction.proposal.code} · {quickAction.proposal.client_name}</p>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Valor Aprovado *</label>
                <input
                  type="text"
                  value={quickValorAprovado}
                  onChange={e => {
                    const nums = e.target.value.replace(/\D/g, "");
                    const val = parseFloat(nums) / 100;
                    setQuickValorAprovado(isNaN(val) ? "" : val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
                  }}
                  placeholder="R$ 0,00"
                  className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setQuickAction(null); setQuickValorAprovado(""); }}>Cancelar</Button>
              <Button size="sm" onClick={handleQuickAprovar} disabled={!quickValorAprovado || quickSaving}
                className="bg-emerald-600 hover:bg-emerald-500 border-0 text-white gap-1.5">
                {quickSaving ? <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirmar Aprovação
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Rápido: Reprovar ── */}
      {quickAction?.type === "reprovar" && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-red-500/30 rounded-2xl w-full max-w-sm">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <XCircle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-bold text-white">Reprovar Proposta</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs text-muted-foreground">{quickAction.proposal.code} · {quickAction.proposal.client_name}</p>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Motivo *</label>
                <textarea
                  value={quickMotivo}
                  onChange={e => setQuickMotivo(e.target.value)}
                  placeholder="Ex: Score insuficiente, documentação incompleta..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-red-500/50 resize-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setQuickAction(null); setQuickMotivo(""); }}>Cancelar</Button>
              <Button size="sm" onClick={handleQuickReprovar} disabled={!quickMotivo.trim() || quickSaving}
                className="bg-red-600 hover:bg-red-500 border-0 text-white gap-1.5">
                {quickSaving ? <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Confirmar Reprovação
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
