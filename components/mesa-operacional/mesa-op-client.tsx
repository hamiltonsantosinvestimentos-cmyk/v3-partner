"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Headphones, Plus, ChevronRight, User, Building2,
  Clock, CheckCircle2, AlertCircle, Link2,
  LayoutGrid, List, Search, X, FileText, ArrowRight, ArrowLeft, MessageSquare, Trash2,
  ScrollText, RefreshCw, XCircle, Download, Edit2, Users, Filter, Settings, Bell, Mail, MessageCircle,
  BarChart2, TrendingUp, AlertTriangle, Timer, ClipboardCheck, Loader2,
} from "lucide-react";
import { ExportButton } from "@/components/financeiro/export-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS,
  CREDIT_DESK_LINES,
  type OperationStatus, type TicketPriority,
} from "@/lib/constants";
import { PropostaDetailModal, PIPELINE_STAGES, STAGE_REPROVADO, STAGE_DECLINADO, type ProposalFull, type MesaComment } from "@/components/mesa-credito/proposta-detail-modal";

// Colunas do kanban = fluxo linear + os 2 estágios terminais (fora do avançar/retroceder sequencial)
const KANBAN_COLUMNS = [...PIPELINE_STAGES, STAGE_REPROVADO, STAGE_DECLINADO];
// FINALIZADO é o rótulo legado (antes da separação Liberado/Reprovado/Declinado) — ainda conta como terminal
const TERMINAL_STAGES = ["LIBERADO", "REPROVADO", "DECLINADO", "FINALIZADO"] as const;
import { NovaPropostaModal } from "@/components/mesa-credito/nova-proposta-modal";

// ─── Tipos ─────────────────────────────────────────────────────────────────
interface Ticket {
  id: string; code: string; title: string; description?: string | null;
  category: string; priority: string; status: string;
  due_date: string | null; created_at: string;
  assigned_to?: string | null;
  resolution?: string | null;
  requester?: { id: string; full_name: string } | null;
  assignee?: { id: string; full_name: string } | null;
  // Campos de pendência
  pending_reason?: string | null;
  pending_responsible?: string | null;
  pending_at?: string | null;
  pending_resolved_at?: string | null;
  pending_resolved_by?: string | null;
  reminder_sent_at?: string | null;
}

interface TicketComment {
  id: string;
  content: string;
  created_at: string;
  author: { id: string; full_name: string } | null;
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
  instituicao_feedback?: { instituicao: string; status: string; observacao: string; updated_at: string }[] | null;
  // Campos de pendência
  pending_reason?: string | null;
  pending_responsible?: string | null;
  pending_at?: string | null;
  pending_resolved_at?: string | null;
  pending_resolved_by?: string | null;
  reminder_sent_at?: string | null;
}

interface MesaOpClientProps {
  tickets: Ticket[];
  proposals: ProposalCard[];
  currentUser?: { id: string; full_name: string; role: string };
}

// ─── Constantes ────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  compliance: "Compliance", tecnico: "Técnico", juridico: "Jurídico",
  onboarding: "Onboarding", operacional: "Operacional", financeiro: "Financeiro",
};

const TICKET_STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "PENDING", label: "Pendente" },
  { value: "IN_REVIEW", label: "Em Revisão" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "CANCELLED", label: "Cancelado" },
];

const TICKET_PRIORITY_OPTIONS = [
  { value: "", label: "Todas prioridades" },
  { value: "URGENT", label: "Urgente" },
  { value: "HIGH", label: "Alta" },
  { value: "MEDIUM", label: "Média" },
  { value: "LOW", label: "Baixa" },
];

// ─── SLA por Fase ──────────────────────────────────────────────────────────
const SLA_STAGES = ["RECEBIDO", "TRIAGEM", "ANALISE", "PENDENCIA", "AVALIACAO_IMOVEL", "APROVACAO", "CONTRATO_ASSINADO", "REGISTRO_IMOVEL", "LIBERADO"] as const;
type SlaStage = typeof SLA_STAGES[number];

type SlaConfig = Record<SlaStage, number>;

const SLA_STAGE_LABELS: Record<SlaStage, string> = {
  RECEBIDO: "Recebido",
  TRIAGEM: "Triagem",
  ANALISE: "Análise",
  PENDENCIA: "Pendência",
  AVALIACAO_IMOVEL: "Avaliação de Imóvel",
  APROVACAO: "Aprovação",
  CONTRATO_ASSINADO: "Contrato Assinado",
  REGISTRO_IMOVEL: "Registro de Imóveis",
  LIBERADO: "Recurso Liberado",
};

const DEFAULT_SLA: SlaConfig = {
  RECEBIDO: 1, TRIAGEM: 2, ANALISE: 5, PENDENCIA: 3,
  AVALIACAO_IMOVEL: 15, APROVACAO: 2, CONTRATO_ASSINADO: 5, REGISTRO_IMOVEL: 30, LIBERADO: 3,
};
const SLA_STORAGE_KEY = "v3_sla_config";

function loadSlaConfig(): SlaConfig {
  if (typeof window === "undefined") return DEFAULT_SLA;
  try {
    const raw = localStorage.getItem(SLA_STORAGE_KEY);
    if (!raw) return DEFAULT_SLA;
    const parsed = JSON.parse(raw) as Partial<SlaConfig>;
    return { ...DEFAULT_SLA, ...parsed };
  } catch { return DEFAULT_SLA; }
}

function saveSlaConfig(cfg: SlaConfig) {
  try { localStorage.setItem(SLA_STORAGE_KEY, JSON.stringify(cfg)); } catch {}
}

/** Retorna sla_override do deal: valores são ISO date strings (ex: "2026-05-25") */
function getDealSlaOverride(proposal: ProposalCard): Record<string, string> {
  try {
    const raw = proposal.metadata?.sla_override;
    if (raw && typeof raw === "object") return raw as Record<string, string>;
  } catch {}
  return {};
}

/** Mantém compatibilidade com código legado que usa getDealSla */
function getDealSla(proposal: ProposalCard): Partial<SlaConfig> {
  return getDealSlaOverride(proposal) as unknown as Partial<SlaConfig>;
}

interface SlaStatusResult {
  status: "ok" | "warning" | "danger";
  daysLeft: number;       // positivo = dias restantes, negativo = dias vencidos
  targetDate: string | null; // ISO date se definido por calendário
  // legado
  daysElapsed: number;
  slaLimit: number;
}

function getSlaStatus(proposal: ProposalCard, slaConfig: SlaConfig): SlaStatusResult | null {
  // Estágios terminais não têm "próxima etapa" para contar prazo até lá
  if (!proposal.stage || (TERMINAL_STAGES as readonly string[]).includes(proposal.stage)) return null;
  const stage = proposal.stage as SlaStage;
  if (!SLA_STAGES.includes(stage)) return null;

  const override = getDealSlaOverride(proposal);
  const targetDateStr = override[stage];

  if (targetDateStr && typeof targetDateStr === "string" && targetDateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    // SLA por calendário: compara data alvo vs hoje
    const target = parseLocalDate(targetDateStr);
    target.setHours(23, 59, 59, 999);
    const now = Date.now();
    const diffMs = target.getTime() - now;
    const daysLeft = Math.ceil(diffMs / 86400000);
    let status: "ok" | "warning" | "danger";
    if (daysLeft < 0) status = "danger";
    else if (daysLeft <= 1) status = "warning";
    else status = "ok";
    return { status, daysLeft, targetDate: targetDateStr, daysElapsed: -daysLeft, slaLimit: 0 };
  }

  // Fallback: SLA global em dias
  const stageChangedAt = proposal.metadata?.stage_changed_at as string | undefined;
  const referenceDate = stageChangedAt ?? proposal.created_at;
  if (!referenceDate) return null;
  const elapsed = (Date.now() - new Date(referenceDate).getTime()) / 86400000;
  const limit = slaConfig[stage] ?? DEFAULT_SLA[stage];
  const ratio = elapsed / limit;
  let status: "ok" | "warning" | "danger";
  if (ratio >= 1) status = "danger";
  else if (ratio >= 0.7) status = "warning";
  else status = "ok";
  return { status, daysLeft: Math.ceil(limit - elapsed), targetDate: null, daysElapsed: Math.floor(elapsed), slaLimit: limit };
}

// ─── SLA da Etapa Modal (automático ao mudar de stage) ────────────────────
/** Formata Date como YYYY-MM-DD no fuso local (evita UTC shift) */
function toLocalDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parseia "YYYY-MM-DD" como horário local (evita UTC shift) */
function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function StageSLAModal({ open, onClose, proposal, stage, globalSla, onConfirm }: {
  open: boolean; onClose: () => void;
  proposal: ProposalCard | null;
  stage: SlaStage | null;
  globalSla: SlaConfig;
  onConfirm: (proposalId: string, stage: SlaStage, date: string) => void;
}) {
  const override = proposal && stage ? getDealSlaOverride(proposal) : {};
  const existingDate = stage ? (override[stage] ?? null) : null;
  const globalDefaultDays = stage ? (globalSla[stage] ?? DEFAULT_SLA[stage]) : 3;

  function defaultDate() {
    const d = new Date();
    d.setDate(d.getDate() + globalDefaultDays);
    return toLocalDateString(d);
  }

  const [date, setDate] = useState<string>("");

  useEffect(() => {
    if (open) setDate(existingDate ?? defaultDate());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingDate]);

  if (!open || !proposal || !stage) return null;

  const today = toLocalDateString(new Date());
  const valid = date >= today;

  const daysUntil = date ? Math.ceil((parseLocalDate(date).setHours(23,59,59,999) - Date.now()) / 86400000) : 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-10" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-sm rounded-2xl" style={{ background: "#111F35", border: "1px solid rgba(201,168,76,0.2)" }}>
        <div className="px-5 py-4 space-y-1" style={{ borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" style={{ color: "#C9A84C" }} />
            <h3 className="text-sm font-bold text-white">SLA — {SLA_STAGE_LABELS[stage]}</h3>
          </div>
          <p className="text-[11px]" style={{ color: "#7A8FA8" }}>{proposal.client_name} · {proposal.code}</p>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-xs" style={{ color: "#7A8FA8" }}>
            Selecione a <strong style={{ color: "#F0ECE4" }}>data de retorno</strong> para a etapa{" "}
            <strong style={{ color: "#F0ECE4" }}>{SLA_STAGE_LABELS[stage]}</strong>:
          </p>
          <input
            type="date"
            autoFocus
            min={today}
            value={date}
            onChange={e => setDate(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && valid) { onConfirm(proposal.id, stage, date); onClose(); } }}
            className="w-full h-11 px-3 rounded-xl outline-none text-sm font-semibold"
            style={{
              background: "#162744",
              border: `1px solid ${valid ? "rgba(201,168,76,0.4)" : "rgba(255,107,107,0.4)"}`,
              color: "#F0ECE4",
              colorScheme: "dark",
            }}
          />
          {date && (
            <p className="text-[11px]" style={{ color: daysUntil > 1 ? "#4ADE80" : daysUntil === 1 ? "#F59E0B" : "#FF6B6B" }}>
              {daysUntil > 0
                ? `Retorno em ${daysUntil} dia${daysUntil !== 1 ? "s" : ""}`
                : daysUntil === 0 ? "Retorno hoje"
                : `Vencido há ${Math.abs(daysUntil)} dia${Math.abs(daysUntil) !== 1 ? "s" : ""}`}
            </p>
          )}
        </div>
        <div className="flex gap-2 px-5 py-4" style={{ borderTop: "1px solid rgba(201,168,76,0.1)" }}>
          <button
            onClick={() => { onConfirm(proposal.id, stage, defaultDate()); onClose(); }}
            className="px-3 py-2 rounded-xl text-xs font-medium"
            style={{ background: "#162744", color: "#7A8FA8" }}
          >
            Padrão (+{globalDefaultDays}d)
          </button>
          <button
            onClick={() => { if (valid) { onConfirm(proposal.id, stage, date); onClose(); } }}
            disabled={!valid}
            className="flex-1 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
            style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}
          >
            Confirmar Data
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SLA Config Modal ──────────────────────────────────────────────────────
function SLAConfigModal({ open, onClose, config, onSave }: {
  open: boolean; onClose: () => void;
  config: SlaConfig; onSave: (cfg: SlaConfig) => void;
}) {
  const [draft, setDraft] = useState<SlaConfig>(config);

  useEffect(() => { if (open) setDraft(config); }, [open, config]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#C9A84C]" />
            <h2 className="text-sm font-bold text-white">SLA por Fase</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-muted-foreground">Configure o prazo máximo (em dias) para cada fase do pipeline. O semáforo nos cards mostrará o status de cada proposta.</p>
          {SLA_STAGES.map((stage) => (
            <div key={stage} className="flex items-center gap-3">
              <span className="text-xs font-medium text-foreground w-24 flex-shrink-0">{SLA_STAGE_LABELS[stage]}</span>
              <input
                type="number" min={1} max={90}
                value={draft[stage]}
                onChange={(e) => setDraft(prev => ({ ...prev, [stage]: Math.max(1, parseInt(e.target.value) || 1) }))}
                className="w-20 h-8 px-2 text-sm text-center bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-border space-y-3">
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> OK</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Atenção (≥70%)</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Vencido</span>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={() => { onSave(draft); onClose(); }}>Salvar</Button>
          </div>
        </div>
      </div>
    </div>
  );
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

  async function submit() {
    if (!title.trim()) return;
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), category, priority, due_date: dueDate || null, description: descricao || null }),
      });
      const json = await res.json();
      if (json.ticket) {
        onSubmit(json.ticket);
        setTitle(""); setCategory("operacional"); setPriority("MEDIUM"); setDueDate(""); setDescricao("");
        onClose();
        return;
      }
    } catch {}
    // fallback local
    const t: Ticket = {
      id: `tick-${Date.now()}`, code: `TICK-26-${String(Date.now()).slice(-6)}`,
      title, category, priority, description: descricao || null,
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
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-black/60 backdrop-blur-sm">
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
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
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

// ─── Bloco de pendência no card com edição inline ─────────────────────────
function CardPendingBlock({ proposal, canChangeStage, currentUserName, onResolve, onReminder, onSaved }: {
  proposal: ProposalCard;
  canChangeStage: boolean;
  currentUserName?: string;
  onResolve: () => Promise<void>;
  onReminder: () => Promise<void>;
  onSaved: (updates: Partial<ProposalCard>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(proposal.pending_reason ?? "");
  const [responsible, setResponsible] = useState(proposal.pending_responsible ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updates = { pending_reason: reason.trim(), pending_responsible: responsible.trim() };
    await fetch("/api/credit-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposal.id, ...updates }),
    }).catch(() => {});
    onSaved(updates);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="mt-2 rounded-lg p-2 space-y-1.5" style={{ background: "#3A1F1F", border: "1px solid rgba(255,107,107,0.3)" }}
      onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-1">
        <AlertCircle className="w-3 h-3 flex-shrink-0" style={{ color: "#FF6B6B" }} />
        <span className="text-[10px] font-bold uppercase tracking-wide flex-1" style={{ color: "#FF6B6B" }}>Pendente</span>
        {proposal.pending_at && !editing && (
          <span className="text-[9px]" style={{ color: "#FF6B6B", opacity: 0.7 }}>
            {new Date(proposal.pending_at).toLocaleDateString("pt-BR")}
          </span>
        )}
        {canChangeStage && !editing && (
          <button
            onClick={() => { setEditing(true); setReason(proposal.pending_reason ?? ""); setResponsible(proposal.pending_responsible ?? ""); }}
            className="w-4 h-4 rounded flex items-center justify-center ml-1"
            style={{ color: "rgba(255,107,107,0.6)" }}
            title="Editar pendência"
          >
            <Edit2 className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Motivo da pendência..."
            className="w-full px-2 py-1.5 rounded text-[10px] resize-none outline-none"
            style={{ background: "#1A0E0E", border: "1px solid rgba(255,107,107,0.4)", color: "#F0ECE4" }}
          />
          <input
            type="text"
            value={responsible}
            onChange={e => setResponsible(e.target.value)}
            placeholder="Responsável..."
            className="w-full px-2 py-1 rounded text-[10px] outline-none"
            style={{ background: "#1A0E0E", border: "1px solid rgba(255,107,107,0.4)", color: "#F0ECE4" }}
          />
          <div className="flex gap-1">
            <button onClick={() => setEditing(false)} className="px-2 py-1 rounded text-[9px]" style={{ background: "rgba(255,255,255,0.05)", color: "#7A8FA8" }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || !reason.trim()} className="flex-1 py-1 rounded text-[9px] font-bold disabled:opacity-40" style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}>
              {saving ? "..." : "✓ Salvar"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {proposal.pending_reason ? (
            <p className="text-[10px] italic line-clamp-2" style={{ color: "#FF6B6B", opacity: 0.9 }} title={proposal.pending_reason}>
              {proposal.pending_reason}
            </p>
          ) : (
            <p className="text-[10px] italic" style={{ color: "rgba(255,107,107,0.4)" }}>Sem motivo registrado</p>
          )}
          {proposal.pending_responsible && (
            <p className="text-[9px]" style={{ color: "#FF6B6B", opacity: 0.7 }}>Resp.: {proposal.pending_responsible}</p>
          )}
          {canChangeStage && (
            <div className="flex gap-1 pt-0.5">
              <button onClick={onResolve} className="flex-1 py-1 rounded text-[9px] font-bold" style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}>✓ Resolvido</button>
              <button onClick={onReminder} className="flex-1 py-1 rounded text-[9px] font-bold" style={{ background: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}>
                <Bell className="w-2.5 h-2.5 inline mr-0.5" />Lembrete
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Formulário de Pendência para Proposta/Deal ────────────────────────────
function ProposalPendingForm({ proposal, onClose, onConfirm }: {
  proposal: ProposalCard;
  onClose: () => void;
  onConfirm: (proposal: ProposalCard, reason: string, responsible: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [responsible, setResponsible] = useState("Partner");
  const [loading, setLoading] = useState(false);
  const valid = reason.trim().length >= 10;

  async function submit() {
    if (!valid) return;
    setLoading(true);
    await onConfirm(proposal, reason.trim(), responsible);
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#7A8FA8" }}>
          Motivo da pendência *
        </label>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Descreva o motivo da pendência (mín. 10 caracteres)..."
          rows={3}
          className="w-full rounded-xl px-3 py-2 text-sm text-white resize-none outline-none focus:ring-1"
          style={{ background: "#162744", border: `1px solid ${!valid && reason.length > 0 ? "#FF6B6B" : "rgba(201,168,76,0.2)"}`, "--tw-ring-color": "#C9A84C" } as React.CSSProperties}
        />
        {!valid && reason.length > 0 && (
          <p className="text-[10px]" style={{ color: "#FF6B6B" }}>Mínimo 10 caracteres</p>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#7A8FA8" }}>
          Responsável pela resolução
        </label>
        <select
          value={responsible}
          onChange={e => setResponsible(e.target.value)}
          className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
          style={{ background: "#162744", border: "1px solid rgba(201,168,76,0.2)" }}
        >
          <option value="Partner">Partner</option>
          <option value="Mesa Operacional">Mesa Operacional</option>
          <option value="Financeiro">Financeiro</option>
          <option value="Jurídico">Jurídico</option>
          <option value="Externo">Externo</option>
        </select>
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-medium" style={{ background: "#162744", color: "#7A8FA8" }}>
          Cancelar
        </button>
        <button
          onClick={submit}
          disabled={!valid || loading}
          className="px-4 py-2 rounded-xl text-xs font-bold transition-opacity disabled:opacity-50"
          style={{ background: "rgba(255,107,107,0.2)", color: "#FF6B6B", border: "1px solid rgba(255,107,107,0.3)" }}
        >
          {loading ? "Salvando..." : "Confirmar Pendência"}
        </button>
      </div>
    </div>
  );
}

// ─── Modal de Pendência ────────────────────────────────────────────────────
function PendingModal({ open, onClose, ticket, onConfirm }: {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onConfirm: (reason: string, responsible: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [responsible, setResponsible] = useState("Partner");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (open) { setReason(""); setResponsible("Partner"); setError(""); } }, [open]);

  async function handleConfirm() {
    if (reason.trim().length < 10) { setError("Motivo deve ter ao menos 10 caracteres."); return; }
    setSaving(true);
    try {
      await onConfirm(reason.trim(), responsible);
    } finally {
      setSaving(false);
    }
  }

  if (!open || !ticket) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-[#FF6B6B]/30 rounded-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#FF6B6B]" />
            <h2 className="text-sm font-bold text-white">Registrar Pendência</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Ticket <span className="font-mono text-[#C9A84C]">{ticket.code}</span> — {ticket.title}
          </p>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Motivo da pendência <span className="text-[#FF6B6B]">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); setError(""); }}
              rows={4}
              placeholder="Descreva detalhadamente o motivo desta pendência..."
              className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#FF6B6B]/50 resize-none"
              autoFocus
            />
            {error && <p className="mt-1 text-[11px] text-[#FF6B6B]">{error}</p>}
            <p className="mt-1 text-[10px] text-muted-foreground">{reason.length} / mínimo 10 caracteres</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Responsável pela resolução</label>
            <select
              value={responsible}
              onChange={e => setResponsible(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              <option value="Partner">Partner</option>
              <option value="Mesa Operacional">Mesa Operacional</option>
              <option value="Financeiro">Financeiro</option>
              <option value="Jurídico">Jurídico</option>
              <option value="Externo">Externo</option>
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={saving || reason.trim().length < 10}
            className="gap-1.5"
            style={{ background: "#3A1F1F", color: "#FF6B6B", border: "1px solid rgba(255,107,107,0.3)" }}
          >
            {saving
              ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              : <AlertCircle className="w-3.5 h-3.5" />}
            Confirmar Pendência
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Resolução ────────────────────────────────────────────────────
function ResolveModal({ open, onClose, ticket, onConfirm }: {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  onConfirm: (obs: string) => Promise<void>;
}) {
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setObs(""); } }, [open]);

  async function handleConfirm() {
    setSaving(true);
    try {
      await onConfirm(obs.trim());
    } finally {
      setSaving(false);
    }
  }

  if (!open || !ticket) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-[#4ADE80]/30 rounded-2xl w-full max-w-sm animate-fade-in">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
          <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
          <h2 className="text-sm font-bold text-white">Confirmar Resolução</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-xs text-muted-foreground">
            Ticket <span className="font-mono text-[#C9A84C]">{ticket.code}</span> voltará para <strong className="text-white">Em Revisão</strong>.
          </p>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Observação de resolução (opcional)</label>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              rows={3}
              placeholder="Descreva como a pendência foi resolvida..."
              className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#4ADE80]/50 resize-none"
              autoFocus
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={saving}
            className="gap-1.5"
            style={{ background: "#1A3A2A", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
          >
            {saving
              ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
              : <CheckCircle2 className="w-3.5 h-3.5" />}
            Marcar como Resolvido
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper: formata "há X tempo" ─────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora mesmo";
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `há ${days}d`;
}

// ─── PendingBadge ──────────────────────────────────────────────────────────
function PendingBadge({ ticket }: { ticket: Ticket }) {
  const isPending = ticket.status === "PENDING";
  const isResolved = isPending && !!ticket.pending_resolved_at;

  if (!isPending && !ticket.pending_reason) return null;

  if (ticket.pending_resolved_at) {
    return (
      <div className="mt-2 rounded-lg p-2" style={{ background: "#1A3A2A", border: "1px solid rgba(74,222,128,0.3)" }}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#4ADE80" }}>RESOLVIDO</span>
          <span className="text-[9px]" style={{ color: "#4ADE80" }}>
            {new Date(ticket.pending_resolved_at).toLocaleDateString("pt-BR")}
          </span>
        </div>
        {ticket.pending_resolved_by && (
          <p className="text-[10px]" style={{ color: "#4ADE80", opacity: 0.8 }}>por {ticket.pending_resolved_by}</p>
        )}
      </div>
    );
  }

  if (!isPending) return null;

  return (
    <div className="mt-2 rounded-lg p-2" style={{ background: "#3A1F1F", border: "1px solid rgba(255,107,107,0.3)" }}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#FF6B6B" }}>PENDENTE</span>
        {ticket.pending_at && (
          <span className="text-[9px]" style={{ color: "#FF6B6B", opacity: 0.8 }}>
            desde {new Date(ticket.pending_at).toLocaleDateString("pt-BR")}
          </span>
        )}
      </div>
      {ticket.pending_reason && (
        <p className="text-[10px] italic line-clamp-2" style={{ color: "#FF6B6B", opacity: 0.9 }}
          title={ticket.pending_reason}>
          {ticket.pending_reason}
        </p>
      )}
      {ticket.pending_responsible && (
        <p className="text-[10px] mt-0.5" style={{ color: "#FF6B6B", opacity: 0.7 }}>
          Resp.: {ticket.pending_responsible}
        </p>
      )}
    </div>
  );
}

// ─── Ticket Detail Modal ───────────────────────────────────────────────────
function TicketDetailModal({ open, onClose, ticket, currentUser, onUpdated, onOpenPending, onOpenResolve, onSendReminder }: {
  open: boolean;
  onClose: () => void;
  ticket: Ticket | null;
  currentUser?: { id: string; full_name: string; role: string };
  onUpdated: (id: string, updates: Partial<Ticket>) => void;
  onOpenPending: () => void;
  onOpenResolve: () => void;
  onSendReminder: () => void;
}) {
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [partners, setPartners] = useState<{ id: string; full_name: string }[]>([]);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [ticketStatus, setTicketStatus] = useState("");
  const [resolution, setResolution] = useState("");
  const [saving, setSaving] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const isAdmin = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(currentUser?.role ?? "");

  useEffect(() => {
    if (!open || !ticket) return;
    setTicketStatus(ticket.status);
    setAssigneeId(ticket.assignee?.id ?? ticket.assigned_to ?? "");
    setResolution(ticket.resolution ?? "");
    setNewComment("");
    setComments([]);

    setCommentsLoading(true);
    fetch(`/api/tickets/comments?ticket_id=${ticket.id}`)
      .then(r => r.json())
      .then(d => setComments(d.comments ?? []))
      .catch(() => {})
      .finally(() => setCommentsLoading(false));

    if (isAdmin) {
      fetch("/api/partners")
        .then(r => r.json())
        .then(d => setPartners(d.partners ?? []))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ticket?.id]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function handleSave() {
    if (!ticket) return;

    // Se mudando para PENDING, abre o modal de pendência em vez de salvar direto
    if (ticketStatus === "PENDING" && ticket.status !== "PENDING") {
      onClose();
      onOpenPending();
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = { id: ticket.id };
      if (ticketStatus !== ticket.status) body.status = ticketStatus;
      const currentAssigneeId = ticket.assignee?.id ?? ticket.assigned_to ?? "";
      if (assigneeId !== currentAssigneeId) body.assigned_to = assigneeId || null;
      if (resolution !== (ticket.resolution ?? "")) body.resolution = resolution || null;

      const res = await fetch("/api/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const assignee = partners.find(p => p.id === assigneeId);
        onUpdated(ticket.id, {
          status: ticketStatus,
          assigned_to: assigneeId || null,
          assignee: assignee ? { id: assignee.id, full_name: assignee.full_name } : null,
          resolution: resolution || null,
        });
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment(opts?: { send_email?: boolean; send_chat?: boolean }) {
    if (!ticket || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch("/api/tickets/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticket.id,
          content: newComment.trim(),
          send_email: opts?.send_email ?? false,
          send_chat: opts?.send_chat ?? false,
        }),
      });
      const json = await res.json();
      if (json.comment) {
        setComments(prev => [...prev, json.comment]);
        setNewComment("");
      }
    } catch {}
    finally { setSubmittingComment(false); }
  }

  if (!open || !ticket) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-muted-foreground">{ticket.code}</span>
              <Badge className={PRIORITY_COLORS[ticket.priority as TicketPriority]}>{PRIORITY_LABELS[ticket.priority as TicketPriority]}</Badge>
              <Badge className={STATUS_COLORS[ticket.status as OperationStatus]}>{STATUS_LABELS[ticket.status as OperationStatus]}</Badge>
            </div>
            <h3 className="text-sm font-bold text-white">{ticket.title}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors flex-shrink-0 ml-4">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 pb-6">
          {/* Detalhes */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-secondary rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Categoria</p>
              <p className="text-xs text-foreground">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</p>
            </div>
            <div className="bg-secondary rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Prazo</p>
              <p className="text-xs text-foreground">{ticket.due_date ? formatDate(ticket.due_date) : "—"}</p>
            </div>
            {ticket.requester && (
              <div className="bg-secondary rounded-xl p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Solicitante</p>
                <p className="text-xs text-foreground">{ticket.requester.full_name}</p>
              </div>
            )}
            {ticket.assignee && (
              <div className="bg-secondary rounded-xl p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Responsável</p>
                <p className="text-xs text-foreground">{ticket.assignee.full_name}</p>
              </div>
            )}
            <div className="bg-secondary rounded-xl p-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Criado em</p>
              <p className="text-xs text-foreground">{formatDate(ticket.created_at)}</p>
            </div>
          </div>

          {/* Descrição */}
          {ticket.description && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Descrição</p>
              <p className="text-xs text-foreground bg-secondary rounded-xl p-3 whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}

          {/* Resolução existente (read-only para não-admin) */}
          {!isAdmin && ticket.resolution && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Resolução</p>
              <p className="text-xs text-foreground bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 whitespace-pre-wrap">{ticket.resolution}</p>
            </div>
          )}

          {/* ── Bloco de pendência ── */}
          {ticket.status === "PENDING" && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: "#3A1F1F", border: "1px solid rgba(255,107,107,0.3)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" style={{ color: "#FF6B6B" }} />
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#FF6B6B" }}>Ticket Pendente</span>
                  {ticket.pending_at && (
                    <span className="text-[10px]" style={{ color: "#FF6B6B", opacity: 0.7 }}>
                      desde {new Date(ticket.pending_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              </div>
              {ticket.pending_reason && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#FF6B6B", opacity: 0.7 }}>Motivo</p>
                  <p className="text-xs italic whitespace-pre-wrap" style={{ color: "#FF6B6B" }}>{ticket.pending_reason}</p>
                </div>
              )}
              {ticket.pending_responsible && (
                <p className="text-[10px]" style={{ color: "#FF6B6B", opacity: 0.8 }}>
                  Responsável pela resolução: <strong>{ticket.pending_responsible}</strong>
                </p>
              )}
              {isAdmin && (
                <div className="flex gap-2 pt-1 flex-wrap">
                  {/* Botão Marcar como Resolvido */}
                  <button
                    onClick={() => { onClose(); onOpenResolve(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: "#1A3A2A", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Marcar como Resolvido
                  </button>
                  {/* Botão Enviar Lembrete */}
                  <button
                    onClick={() => { onClose(); onSendReminder(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: "#1A2A3A", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    Enviar Lembrete
                  </button>
                </div>
              )}
              {ticket.reminder_sent_at && (
                <p className="text-[10px]" style={{ color: "#C9A84C", opacity: 0.8 }}>
                  Último lembrete enviado: {timeAgo(ticket.reminder_sent_at)}
                </p>
              )}
            </div>
          )}

          {/* ── Bloco de pendência resolvida ── */}
          {ticket.status !== "PENDING" && ticket.pending_resolved_at && (
            <div className="rounded-xl p-4 space-y-2" style={{ background: "#1A3A2A", border: "1px solid rgba(74,222,128,0.3)" }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" style={{ color: "#4ADE80" }} />
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#4ADE80" }}>Pendência Resolvida</span>
                <span className="text-[10px]" style={{ color: "#4ADE80", opacity: 0.7 }}>
                  em {new Date(ticket.pending_resolved_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              {ticket.pending_resolved_by && (
                <p className="text-[10px]" style={{ color: "#4ADE80", opacity: 0.8 }}>por {ticket.pending_resolved_by}</p>
              )}
            </div>
          )}

          {/* Controles admin */}
          {isAdmin && (
            <div className="space-y-3 border border-border rounded-xl p-4">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Controles Administrativos
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Status</label>
                  <select value={ticketStatus} onChange={e => setTicketStatus(e.target.value)}
                    className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                    {TICKET_STATUS_OPTIONS.filter(o => o.value).map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Responsável</label>
                  <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                    className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                    <option value="">— Sem responsável —</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Resolução / Observação interna</label>
                <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={2}
                  placeholder="Descreva a resolução ou observação..."
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" />
              </div>
            </div>
          )}

          {/* Comentários */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Comentários ({comments.length})
            </p>
            {commentsLoading ? (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4 bg-secondary/50 rounded-xl">Nenhum comentário ainda.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {comments.map(c => (
                  <div key={c.id} className="bg-secondary rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-foreground">{c.author?.full_name ?? "Usuário"}</span>
                      <span className="text-[10px] text-muted-foreground">{formatDateTime(c.created_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{c.content}</p>
                  </div>
                ))}
                <div ref={commentsEndRef} />
              </div>
            )}
            {/* Adicionar comentário */}
            <div className="space-y-2">
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddComment(); }}
                rows={2}
                placeholder="Adicionar comentário... (Ctrl+Enter para enviar)"
                className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleAddComment()}
                  disabled={!newComment.trim() || submittingComment}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                  style={{ background: "#C9A84C", color: "#09081A" }}
                >
                  {submittingComment
                    ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : <MessageSquare className="w-3.5 h-3.5" />}
                  Comentar
                </button>
                <button
                  onClick={() => handleAddComment({ send_email: true })}
                  disabled={!newComment.trim() || submittingComment}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                  style={{ background: "#162744", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.4)" }}
                >
                  <Mail className="w-3.5 h-3.5" />
                  + E-mail
                </button>
                <button
                  onClick={() => handleAddComment({ send_chat: true })}
                  disabled={!newComment.trim() || submittingComment}
                  className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                  style={{ background: "#162744", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.4)" }}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  + Chat
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-2 justify-end flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Fechar</Button>
          {isAdmin && (
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Salvar Alterações
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Editar Proposta Modal ────────────────────────────────────────────────
interface Partner { id: string; full_name: string }
type CreditLevel = "NIVEL_1" | "NIVEL_2" | "NIVEL_3";

function EditarPropostaModal({ open, onClose, proposal, onSaved }: {
  open: boolean;
  onClose: () => void;
  proposal: ProposalCard | null;
  onSaved: (id: string, updates: Partial<ProposalCard>) => void;
}) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [level, setLevel] = useState<CreditLevel>("NIVEL_1");
  const [creditLine, setCreditLine] = useState("");
  const [saving, setSaving] = useState(false);
  const [partnerSearch, setPartnerSearch] = useState("");
  const [portfolioByNivel, setPortfolioByNivel] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!open || !proposal) return;
    setPartnerId(proposal.partner_id ?? "");
    setLevel((proposal.current_level as CreditLevel) ?? "NIVEL_1");
    setCreditLine(proposal.credit_line ?? "");
    setPartnerSearch("");
    setPartnersLoading(true);
    Promise.all([
      fetch("/api/partners").then(r => r.json()),
      fetch("/api/portfolio").then(r => r.json()),
    ]).then(([partnersData, portfolioData]) => {
      setPartners(partnersData.partners ?? []);
      const map: Record<string, string[]> = {};
      for (const linha of (portfolioData.linhas ?? [])) {
        if (!linha.nivel) continue;
        if (!map[linha.nivel]) map[linha.nivel] = [];
        map[linha.nivel].push(linha.nome);
      }
      setPortfolioByNivel(map);
    }).catch(() => {}).finally(() => setPartnersLoading(false));
  }, [open, proposal]);

  const portfolioLines = portfolioByNivel[level] ?? [];
  const availableLines = portfolioLines.length > 0 ? portfolioLines : CREDIT_DESK_LINES[level];

  useEffect(() => {
    if (!availableLines.includes(creditLine)) setCreditLine(availableLines[0] ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, portfolioByNivel]);

  async function handleSave() {
    if (!proposal) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = { id: proposal.id };
      if (partnerId && partnerId !== proposal.partner_id) body.partner_id = partnerId;
      if (level !== proposal.current_level) body.current_level = level;
      if (creditLine && creditLine !== proposal.credit_line) body.credit_line = creditLine;

      const res = await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const partnerName = partners.find(p => p.id === partnerId)?.full_name ?? proposal.partner_name;
        onSaved(proposal.id, {
          partner_id: partnerId || proposal.partner_id,
          partner_name: partnerName,
          current_level: level,
          credit_line: creditLine,
        });
        if (partnerId && partnerId !== proposal.partner_id) {
          fetch("/api/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: partnerId,
              title: `Proposta ${proposal.code} atribuída a você`,
              message: `A proposta de ${proposal.client_name} foi atribuída ao seu perfil.`,
              type: "proposal",
              action_url: "/minhas-operacoes",
            }),
          }).catch(() => {});
        }
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open || !proposal) return null;

  const filteredPartners = partners.filter(p =>
    !partnerSearch || p.full_name.toLowerCase().includes(partnerSearch.toLowerCase())
  );

  const LEVEL_CONFIG = {
    NIVEL_1: { label: "Nível 1", sub: "Varejo", color: "border-blue-500/40 bg-blue-500/10 text-blue-400" },
    NIVEL_2: { label: "Nível 2", sub: "Estruturado", color: "border-amber-500/40 bg-amber-500/10 text-amber-400" },
    NIVEL_3: { label: "Nível 3", sub: "High Ticket", color: "border-purple-500/40 bg-purple-500/10 text-purple-400" },
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-white">Editar Proposta</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{proposal.code} · {proposal.client_name}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
              <Users className="w-3.5 h-3.5" /> Partner Responsável
            </label>
            <div className="relative mb-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                value={partnerSearch}
                onChange={e => setPartnerSearch(e.target.value)}
                placeholder={partners.find(p => p.id === partnerId)?.full_name || proposal.partner_name || "Buscar partner..."}
                className="w-full h-9 pl-9 pr-4 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            {partnersLoading ? (
              <p className="text-xs text-muted-foreground px-1">Carregando partners...</p>
            ) : (
              <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-secondary">
                {filteredPartners.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">Nenhum partner encontrado</p>
                ) : filteredPartners.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setPartnerId(p.id); setPartnerSearch(""); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-primary/10 hover:text-white flex items-center justify-between ${
                      partnerId === p.id ? "bg-primary/15 text-primary font-semibold" : "text-foreground"
                    }`}
                  >
                    {p.full_name}
                    {partnerId === p.id && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Transferir para Nível</label>
            <div className="grid grid-cols-3 gap-2">
              {(["NIVEL_1", "NIVEL_2", "NIVEL_3"] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setLevel(lvl)}
                  className={`py-2.5 px-2 rounded-xl border text-center transition-all ${
                    level === lvl ? LEVEL_CONFIG[lvl].color : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <p className="text-xs font-bold">{LEVEL_CONFIG[lvl].label}</p>
                  <p className="text-[10px] opacity-70">{LEVEL_CONFIG[lvl].sub}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Linha de Crédito</label>
            <select
              value={creditLine}
              onChange={e => setCreditLine(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {availableLines.map(line => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving
              ? <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <Edit2 className="w-3.5 h-3.5" />}
            Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export function MesaOpClient({ tickets: initialTickets, proposals: initialProposals, currentUser }: MesaOpClientProps) {
  const [view, setView] = useState<"kanban" | "tickets" | "contratos" | "dashboard">("kanban");
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [proposals, setProposals] = useState<ProposalCard[]>(initialProposals);

  // Busca dados frescos das propostas ao montar
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
            metadata: meta ?? undefined,
            instituicao_encaminhada: p.instituicao_encaminhada as string | null | undefined,
            instituicao_feedback: p.instituicao_feedback as { instituicao: string; status: string; observacao: string; updated_at: string }[] | null | undefined,
            pending_reason: p.pending_reason as string | null | undefined,
            pending_responsible: p.pending_responsible as string | null | undefined,
            pending_at: p.pending_at as string | null | undefined,
            pending_resolved_at: p.pending_resolved_at as string | null | undefined,
            pending_resolved_by: p.pending_resolved_by as string | null | undefined,
          };
        }));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-refresh a cada 60 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      fetch("/api/tickets")
        .then(r => r.json())
        .then(({ tickets: fresh }) => {
          if (Array.isArray(fresh)) setTickets(fresh);
        })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const [novoTicket, setNovoTicket] = useState(false);

  // ─── Lixeira (ADMIN) ─────────────────────────────────────────────────────
  const [showLixeira, setShowLixeira] = useState(false);
  const [lixeiraItems, setLixeiraItems] = useState<any[]>([]);
  const [lixeiraLoading, setLixeiraLoading] = useState(false);

  const loadLixeira = async () => {
    setLixeiraLoading(true);
    try {
      const res = await fetch("/api/credit-proposals/lixeira");
      const json = await res.json();
      setLixeiraItems(json.items ?? []);
    } catch { setLixeiraItems([]); }
    finally { setLixeiraLoading(false); }
  };

  const restoreFromLixeira = async (itemId: string) => {
    try {
      const res = await fetch("/api/credit-proposals/lixeira", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_type: "proposta", item_id: itemId }),
      });
      if (res.ok) {
        setLixeiraItems((prev) => prev.filter((i) => i.id !== itemId));
      } else {
        alert("Erro ao restaurar proposta");
      }
    } catch { alert("Erro de conexão"); }
  };

  // ─── Nova Proposta ───────────────────────────────────────────────────────
  const [npSelector, setNpSelector] = useState(false);
  const [npOpen, setNpOpen] = useState(false);
  const [npLevel, setNpLevel] = useState<"NIVEL_1" | "NIVEL_2" | "NIVEL_3">("NIVEL_1");
  const [npPartnerId, setNpPartnerId] = useState("");
  const [npPartnerName, setNpPartnerName] = useState("");
  const [npPartners, setNpPartners] = useState<{ id: string; full_name: string }[]>([]);
  const [npPartnersLoading, setNpPartnersLoading] = useState(false);
  const [npPartnerSearch, setNpPartnerSearch] = useState("");
  // ─── OCR automático (ao entrar em TRIAGEM) ───────────────────────────────
  const [ocrAutoRunning, setOcrAutoRunning] = useState<Record<string, boolean>>({});

  // ─── Estado de pendência ─────────────────────────────────────────────────
  const [pendingTarget, setPendingTarget] = useState<Ticket | null>(null);
  const [resolveTarget, setResolveTarget] = useState<Ticket | null>(null);
  // Pendência de deal/proposta
  const [pendingProposalTarget, setPendingProposalTarget] = useState<ProposalCard | null>(null);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setReminderToast(msg);
    setTimeout(() => setReminderToast(null), 4000);
  }

  async function handleConfirmPending(ticket: Ticket, reason: string, responsible: string) {
    const res = await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: ticket.id,
        status: "PENDING",
        pending_reason: reason,
        pending_responsible: responsible,
      }),
    });
    if (res.ok) {
      setTickets(prev => prev.map(t => t.id === ticket.id ? {
        ...t,
        status: "PENDING",
        pending_reason: reason,
        pending_responsible: responsible,
        pending_at: new Date().toISOString(),
      } : t));
      setPendingTarget(null);
      showToast("Pendência registrada com sucesso.");
    }
  }

  async function handleConfirmResolve(ticket: Ticket, obs: string) {
    const res = await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: ticket.id,
        status: "IN_REVIEW",
        pending_resolved_obs: obs || null,
      }),
    });
    if (res.ok) {
      const now = new Date().toISOString();
      setTickets(prev => prev.map(t => t.id === ticket.id ? {
        ...t,
        status: "IN_REVIEW",
        pending_resolved_at: now,
        pending_resolved_by: currentUser?.full_name ?? "Usuário",
      } : t));
      setResolveTarget(null);
      showToast("Pendência marcada como resolvida.");
    }
  }

  async function handleSendReminder(ticket: Ticket) {
    setReminderLoading(true);
    try {
      const res = await fetch("/api/tickets/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: ticket.id }),
      });
      const json = await res.json();
      if (json.ok) {
        setTickets(prev => prev.map(t => t.id === ticket.id ? { ...t, reminder_sent_at: new Date().toISOString() } : t));
        showToast("Lembrete enviado por email e chat.");
      } else {
        showToast("Erro ao enviar lembrete.");
      }
    } catch {
      showToast("Erro ao enviar lembrete.");
    } finally {
      setReminderLoading(false);
    }
  }
  async function handleConfirmProposalPending(proposal: ProposalCard, reason: string, responsible: string) {
    const now = new Date().toISOString();
    const updates = { stage: "PENDENCIA", pending_reason: reason, pending_responsible: responsible, pending_at: now };
    setProposals(prev => prev.map(p => p.id === proposal.id ? { ...p, ...updates } : p));
    // Atualiza também o detailProposal se estiver aberto
    if (detailProposal?.id === proposal.id) {
      setDetailProposal(prev => prev ? { ...prev, ...updates } : prev);
    }
    setPendingProposalTarget(null);
    showToast("Pendência registrada com sucesso.");
    await fetch("/api/credit-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposal.id, ...updates }),
    }).catch(() => {});
    // Auto-abre modal de SLA para PENDENCIA
    if (SLA_STAGES.includes("PENDENCIA" as SlaStage)) {
      const updated = { ...proposal, ...updates };
      setStageSlaTarget({ proposal: updated, stage: "PENDENCIA" as SlaStage });
    }
  }

  async function handleSendProposalReminder(proposal: ProposalCard) {
    setReminderLoading(true);
    try {
      const res = await fetch("/api/tickets/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id }),
      });
      if (res.ok) showToast("Lembrete enviado por email e chat.");
      else showToast("Erro ao enviar lembrete.");
    } catch {
      showToast("Erro ao enviar lembrete.");
    } finally {
      setReminderLoading(false);
    }
  }

  const [ticketDetail, setTicketDetail] = useState<Ticket | null>(null);
  const [detailProposal, setDetailProposal] = useState<ProposalCard | null>(null);
  const [editProposal, setEditProposal] = useState<ProposalCard | null>(null);
  const [stageSlaTarget, setStageSlaTarget] = useState<{ proposal: ProposalCard; stage: SlaStage } | null>(null);
  const [search, setSearch] = useState("");

  // Drag & drop
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Notas internas inline
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null);
  const [inlineNotes, setInlineNotes] = useState<Record<string, MesaComment[]>>({});
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  async function loadNotes(proposalId: string) {
    try {
      const res = await fetch(`/api/credit-proposals/comments?proposal_id=${proposalId}`);
      if (res.ok) {
        const { comments } = await res.json();
        setInlineNotes(prev => ({ ...prev, [proposalId]: Array.isArray(comments) ? comments : [] }));
      } else {
        setInlineNotes(prev => ({ ...prev, [proposalId]: [] }));
      }
    } catch {
      setInlineNotes(prev => ({ ...prev, [proposalId]: [] }));
    }
  }

  async function handleAddNote(proposalId: string) {
    if (!noteText.trim()) return;
    setNoteSaving(true);
    const res = await fetch("/api/credit-proposals/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposal_id: proposalId, text: noteText.trim() }),
    });
    if (res.ok) {
      const { comment } = await res.json();
      setInlineNotes(prev => ({ ...prev, [proposalId]: [...(prev[proposalId] ?? []), comment] }));
      setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, mesa_comments_count: (p.mesa_comments_count ?? 0) + 1 } : p));
      setNoteText("");
    }
    setNoteSaving(false);
  }

  async function handleConfirmStageSla(proposalId: string, stage: SlaStage, date: string) {
    const applyOverride = (p: ProposalCard) => {
      const existing = getDealSlaOverride(p);
      const newOverride = { ...existing, [stage]: date };
      return { ...p, metadata: { ...(p.metadata ?? {}), sla_override: newOverride } };
    };
    setProposals(prev => prev.map(p => p.id === proposalId ? applyOverride(p) : p));
    if (detailProposal?.id === proposalId) {
      setDetailProposal(prev => prev ? applyOverride(prev) : prev);
    }
    const proposal = proposals.find(p => p.id === proposalId);
    const existing = proposal ? getDealSlaOverride(proposal) : {};
    const newOverride = { ...existing, [stage]: date };
    // Merge com metadata completo para não sobrescrever dados do cliente no DB
    const fullMeta = { ...(proposal?.metadata ?? {}), sla_override: newOverride };
    await fetch("/api/credit-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposalId, metadata: fullMeta }),
    }).catch(() => {});
    const fmt = parseLocalDate(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    showToast(`Retorno SLA definido: ${fmt} — ${SLA_STAGE_LABELS[stage]}`);
  }
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  // SLA
  const [slaConfig, setSlaConfig] = useState<SlaConfig>(DEFAULT_SLA);
  const [slaModalOpen, setSlaModalOpen] = useState(false);
  useEffect(() => { setSlaConfig(loadSlaConfig()); }, []);

  // Filtros de tickets
  const [ticketSearch, setTicketSearch] = useState("");
  const [ticketStatusFilter, setTicketStatusFilter] = useState("");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState("");

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
      // Aprovar registra a decisão de crédito (status), mas não move a etapa —
      // "Contrato Assinado" só é marcado quando o contrato for realmente assinado.
      const res = await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: quickAction.proposal.id, status: "APPROVED", approved_value: parsed }),
      });
      if (res.ok) {
        setProposals(prev => prev.map(p => p.id === quickAction.proposal.id ? { ...p, status: "APPROVED", approved_value: parsed } : p));
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
        body: JSON.stringify({ id: quickAction.proposal.id, status: "REJECTED", stage: "REPROVADO", metadata: meta }),
      });
      if (res.ok) {
        setProposals(prev => prev.map(p => p.id === quickAction.proposal.id ? { ...p, status: "REJECTED", stage: "REPROVADO", metadata: meta } : p));
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
    void proposalCode;
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

  function openNpSelector() {
    setNpPartnerId(""); setNpPartnerName(""); setNpPartnerSearch(""); setNpLevel("NIVEL_1");
    setNpPartnersLoading(true);
    fetch("/api/partners")
      .then(r => r.json())
      .then(d => setNpPartners(d.partners ?? []))
      .catch(() => {})
      .finally(() => setNpPartnersLoading(false));
    setNpSelector(true);
  }

  const handleNewProposal = useCallback(async (proposal: Record<string, unknown>): Promise<string> => {
    const p = proposal as unknown as ProposalCard;
    const raw = proposal as Record<string, unknown>;
    const metadata = (raw.metadata as Record<string, unknown>) ?? {
      client_type: raw.client_type, email: raw.email, telefone: raw.telefone,
      prazo: raw.prazo, finalidade: raw.finalidade,
      restricao_cliente: raw.restricao_cliente, imoveis: raw.imoveis,
    };
    const res = await fetch("/api/credit-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: p.code, title: p.title, client_name: p.client_name,
        client_cpf_cnpj: (p as unknown as Record<string, unknown>).cpf_cnpj ?? null,
        credit_line: p.credit_line, requested_value: p.requested_value,
        current_level: npLevel,
        partner_id: npPartnerId || null,
        metadata,
      }),
    });
    const json = await res.json();
    if (json.ok && json.proposal) {
      setProposals(prev => [{
        ...p, id: json.proposal.id,
        partner_id: npPartnerId || json.proposal.partner_id,
        partner_name: npPartnerName || json.proposal.partner_name,
        current_level: npLevel,
        metadata: json.proposal.metadata ?? metadata,
      }, ...prev]);
      return json.proposal.id as string;
    }
    if (typeof json.error === "string") throw new Error(json.error);
    throw new Error("Erro ao salvar proposta. Tente novamente.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npLevel, npPartnerId, npPartnerName]);

  // ─── Métricas ─────────────────────────────────────────────────────────────
  const openCount = tickets.filter((t) => ["PENDING", "IN_REVIEW"].includes(t.status)).length;
  const urgentCount = tickets.filter((t) => t.priority === "URGENT").length;
  const pendingTickets = tickets.filter(t => t.status === "PENDING").length;
  const contratosPendentes = contratos.filter(c => !["ASSINADO", "CANCELADO", "EXPIRADO"].includes(c.status)).length;
  const slaVencidas = proposals.filter(p => {
    const s = getSlaStatus(p, slaConfig);
    return s?.status === "danger";
  }).length;

  // ─── Filtros de tickets ───────────────────────────────────────────────────
  const filteredTickets = tickets.filter(t => {
    const matchSearch = !ticketSearch ||
      t.title.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.code.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      (t.requester?.full_name ?? "").toLowerCase().includes(ticketSearch.toLowerCase()) ||
      (t.assignee?.full_name ?? "").toLowerCase().includes(ticketSearch.toLowerCase());
    const matchStatus = !ticketStatusFilter || t.status === ticketStatusFilter;
    const matchPriority = !ticketPriorityFilter || t.priority === ticketPriorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  // ─── Filtros de propostas ─────────────────────────────────────────────────
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
    // Se indo para PENDENCIA, abre modal de motivo primeiro
    if (newStage === "PENDENCIA") {
      const proposal = proposals.find(p => p.id === proposalId) ?? null;
      if (proposal) {
        setPendingProposalTarget(proposal);
        return;
      }
    }
    const now = new Date().toISOString();
    setProposals((prev) => prev.map((p) =>
      p.id === proposalId
        ? { ...p, stage: newStage, metadata: { ...(p.metadata ?? {}), stage_changed_at: now } }
        : p
    ));
    if (detailProposal?.id === proposalId) {
      setDetailProposal((prev) => prev ? { ...prev, stage: newStage, metadata: { ...(prev.metadata ?? {}), stage_changed_at: now } } : prev);
    }
    fetch("/api/credit-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposalId, stage: newStage }),
    }).catch(() => {});

    // Auto-dispara OCR quando proposta entra em TRIAGEM
    if (newStage === "TRIAGEM") {
      setOcrAutoRunning(prev => ({ ...prev, [proposalId]: true }));
      fetch("/api/credit-proposals/ocr-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposalId }),
      })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then((data) => {
          setOcrAutoRunning(prev => { const n = { ...prev }; delete n[proposalId]; return n; });
          if (data?.ocr_results) {
            setProposals(prev => prev.map(p => p.id === proposalId
              ? { ...p, metadata: { ...(p.metadata ?? {}), ocr_results: data.ocr_results, ocr_resumo_geral: data.resumo_geral, ocr_analyzed_at: new Date().toISOString() } }
              : p
            ));
          }
        })
        .catch(() => { setOcrAutoRunning(prev => { const n = { ...prev }; delete n[proposalId]; return n; }); });
    }

    // Auto-abre modal de SLA para a nova etapa (não faz sentido em estágios terminais)
    if (!(TERMINAL_STAGES as readonly string[]).includes(newStage) && SLA_STAGES.includes(newStage as SlaStage)) {
      const proposal = proposals.find(p => p.id === proposalId);
      if (proposal) {
        setStageSlaTarget({ proposal: { ...proposal, stage: newStage }, stage: newStage as SlaStage });
      }
    }
  }, [detailProposal, proposals]);

  const stageKeys = PIPELINE_STAGES.map(s => s.key);

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
            <button onClick={() => setView("dashboard")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "dashboard" ? "bg-[#C9A84C]/15 text-[#E8C97A]" : "text-muted-foreground hover:text-white hover:bg-secondary"}`}>
              <BarChart2 className="w-3.5 h-3.5" /> Dashboard
            </button>
            <button onClick={() => setView("kanban")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "kanban" ? "bg-[#C9A84C]/15 text-[#E8C97A]" : "text-muted-foreground hover:text-white hover:bg-secondary"}`}>
              <LayoutGrid className="w-3.5 h-3.5" /> Kanban
            </button>
            <button onClick={() => setView("tickets")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "tickets" ? "bg-[#C9A84C]/15 text-[#E8C97A]" : "text-muted-foreground hover:text-white hover:bg-secondary"}`}>
              <List className="w-3.5 h-3.5" /> Tickets
              {pendingTickets > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-[9px] font-bold text-black leading-none">
                  {pendingTickets}
                </span>
              )}
            </button>
            <button onClick={() => setView("contratos")}
              className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${view === "contratos" ? "bg-[#C9A84C]/15 text-[#E8C97A]" : "text-muted-foreground hover:text-white hover:bg-secondary"}`}>
              <ScrollText className="w-3.5 h-3.5" /> Contratos
            </button>
          </div>
          {canChangeStage && (
            <button
              onClick={() => setSlaModalOpen(true)}
              className="w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-[#C9A84C] hover:border-[#C9A84C]/40 hover:bg-[#C9A84C]/10 flex items-center justify-center transition-colors"
              title="Configurar SLA por fase"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <Button size="sm" variant="outline" onClick={openNpSelector}>
            <Plus className="w-4 h-4 mr-1.5" /> Nova Proposta
          </Button>
          <Button size="sm" onClick={() => setNovoTicket(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Novo Ticket
          </Button>
          {currentUser?.role === "ADMIN" && (
            <Button size="sm" variant="outline" onClick={() => { setShowLixeira(true); loadLixeira(); }}>
              <ClipboardCheck className="w-4 h-4 mr-1.5" /> Lixeira
            </Button>
          )}
        </div>
      </div>

      {/* Modal Lixeira — Propostas de Crédito */}
      {showLixeira && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => setShowLixeira(false)}>
          <div className="w-full max-w-lg max-h-[80vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div className="text-sm font-bold text-foreground">Lixeira · Propostas Excluídas (30 dias)</div>
              <button onClick={() => setShowLixeira(false)} className="text-muted-foreground hover:text-foreground text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {lixeiraLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#C9A84C]" /></div>
              ) : lixeiraItems.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-8">Lixeira vazia</div>
              ) : (
                lixeiraItems.map((item: any) => (
                  <div key={item.id} className="bg-secondary/40 border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-foreground">{item.client_name} <span className="text-muted-foreground font-normal">({item.code})</span></div>
                        <div className="text-[10px] text-muted-foreground">excluído por {item.profiles?.full_name ?? "N/D"}</div>
                        <div className="text-[10px] text-red-400 mt-1">{item.deletion_reason}</div>
                        <div className="text-[9px] text-muted-foreground/70 mt-1">{item.days_remaining} dias restantes na lixeira</div>
                      </div>
                      <button onClick={() => restoreFromLixeira(item.id)}
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "Propostas Ativas", value: proposals.filter((p) => !(TERMINAL_STAGES as readonly string[]).includes(p.stage ?? "")).length, color: "text-blue-400", icon: <FileText className="w-4 h-4" /> },
          { label: "Tickets Abertos", value: openCount, color: "text-amber-400", icon: <Clock className="w-4 h-4" /> },
          { label: "Urgentes", value: urgentCount, color: "text-red-400", icon: <AlertCircle className="w-4 h-4" /> },
          { label: "Liberados", value: proposals.filter((p) => p.stage === "LIBERADO" || (p.stage === "FINALIZADO" && p.status === "APPROVED")).length, color: "text-emerald-400", icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: "Contratos Pendentes", value: contratosPendentes > 0 ? contratosPendentes : "—", color: "text-purple-400", icon: <ScrollText className="w-4 h-4" /> },
          { label: "SLA Vencidas", value: slaVencidas > 0 ? slaVencidas : "—", color: slaVencidas > 0 ? "text-red-400" : "text-muted-foreground", icon: <Clock className="w-4 h-4" /> },
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
          <div className="flex gap-3 overflow-x-auto pb-2">
            {KANBAN_COLUMNS.map((stage) => {
              const stageProposals = filteredProposals.filter((p) => {
                if (!p.stage) return stage.key === "RECEBIDO";
                // FINALIZADO é rótulo legado (antes da separação Liberado/Reprovado/Declinado);
                // usa status pra decidir a qual dos três corresponde
                if (p.stage === "FINALIZADO") {
                  if (p.status === "REJECTED") return stage.key === "REPROVADO";
                  if (p.status === "CANCELLED") return stage.key === "DECLINADO";
                  return stage.key === "LIBERADO";
                }
                return p.stage === stage.key;
              });
              const totalValue = stageProposals.reduce((sum, p) => sum + (p.requested_value || 0), 0);
              return (
                <div key={stage.key} className="flex flex-col gap-2 w-[230px] flex-shrink-0"
                  onDragOver={(e) => { if (!canChangeStage) return; e.preventDefault(); setDragOverStage(stage.key); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("proposalId"); if (id && canChangeStage && id !== "") handleStageChange(id, stage.key); setDragOverStage(null); }}
                >
                  {/* Column header */}
                  <div className={`px-3 py-2 rounded-lg ${stage.bg} border transition-all ${dragOverStage === stage.key ? "border-[#C9A84C] ring-2 ring-[#C9A84C]/30 scale-[1.02]" : "border-current/20"}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${stage.color}`}>{stage.label}</span>
                      <span className={`text-xs font-bold ${stage.color}`}>{stageProposals.length}</span>
                    </div>
                    {totalValue > 0 && (
                      <p className={`text-[9px] mt-0.5 opacity-70 ${stage.color}`}>
                        {formatCurrency(totalValue)}
                      </p>
                    )}
                  </div>

                  {/* Cards */}
                  <div className="flex flex-col gap-2 min-h-24">
                    {stageProposals.map((p) => {
                      const cardIdx = stageKeys.indexOf(p.stage ?? "RECEBIDO");
                      // Reprovado/Declinado são terminais fora do fluxo linear — sem setas de avançar/retroceder
                      const hasPrev = canChangeStage && cardIdx > 0;
                      const hasNext = canChangeStage && cardIdx >= 0 && cardIdx < stageKeys.length - 1;
                      return (
                        <div key={p.id}
                          draggable={canChangeStage}
                          onDragStart={(e) => { e.dataTransfer.setData("proposalId", p.id); e.dataTransfer.effectAllowed = "move"; setDraggedId(p.id); }}
                          onDragEnd={() => { setDraggedId(null); setDragOverStage(null); }}
                          className={`relative w-full text-left p-3 rounded-xl bg-card border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all group cursor-pointer ${draggedId === p.id ? "opacity-40 scale-95 cursor-grabbing" : canChangeStage ? "cursor-grab active:cursor-grabbing" : ""}`}
                          onClick={() => setDetailProposal(p)}>
                          {(() => {
                            const sla = getSlaStatus(p, slaConfig);
                            if (!sla) return null;
                            const colors = { ok: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-red-500" };
                            const fmtDate = sla.targetDate
                              ? parseLocalDate(sla.targetDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                              : null;
                            const label = sla.targetDate
                              ? (sla.daysLeft < 0 ? `venceu ${fmtDate}` : sla.daysLeft === 0 ? `hoje ${fmtDate}` : `retorno ${fmtDate}`)
                              : (sla.daysLeft < 0 ? `+${Math.abs(sla.daysLeft)}d vencido` : `${sla.daysLeft}d restantes`);
                            const title = sla.targetDate ? `Retorno: ${parseLocalDate(sla.targetDate).toLocaleDateString("pt-BR")}` : `${sla.daysElapsed}d / ${sla.slaLimit}d`;
                            return (
                              <div className="flex items-center gap-1 mb-1.5" title={title}>
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${colors[sla.status]}`} />
                                <span className={`text-[9px] font-semibold ${sla.status === "danger" ? "text-red-400" : sla.status === "warning" ? "text-amber-400" : "text-emerald-400"}`}>{label}</span>
                              </div>
                            );
                          })()}
                          <div className="flex items-start justify-between gap-1 mb-2">
                            <span className="font-mono text-[10px] text-muted-foreground">{p.code}</span>
                            <div className="flex items-center gap-1">
                              {canChangeStage && SLA_STAGES.includes((p.stage ?? "") as SlaStage) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setStageSlaTarget({ proposal: p, stage: p.stage as SlaStage }); }}
                                  className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                                  style={{ color: getDealSlaOverride(p)[p.stage ?? ""] ? "#C9A84C" : "rgba(201,168,76,0.35)" }}
                                  title={getDealSlaOverride(p)[p.stage ?? ""] ? "Editar data de retorno SLA" : "Definir data de retorno SLA"}
                                >
                                  <Clock className="w-3 h-3" />
                                </button>
                              )}
                              {canChangeStage && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditProposal(p); }}
                                  className="w-5 h-5 rounded flex items-center justify-center text-[#C9A84C]/60 hover:text-[#C9A84C] hover:bg-[#C9A84C]/15 transition-colors"
                                  title="Editar partner / transferir nível"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                              {["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(currentUser?.role ?? "") && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const reason = window.prompt(
                                      currentUser?.role === "ADMIN"
                                        ? `Motivo da exclusão de ${p.code} (obrigatório):`
                                        : `Motivo da solicitação de exclusão de ${p.code} (obrigatório, será enviado por email à governança):`
                                    );
                                    if (!reason || reason.trim().length < 5) {
                                      if (reason !== null) alert("Motivo obrigatório: mínimo 5 caracteres");
                                      return;
                                    }
                                    fetch(`/api/credit-proposals/${p.id}/delete`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ reason: reason.trim() }),
                                    })
                                      .then(async (res) => {
                                        const json = await res.json();
                                        if (!res.ok) { alert(json.error ?? "Erro ao excluir proposta."); return; }
                                        if (json.mode === "deleted") {
                                          alert("Proposta excluída. Disponível na Lixeira por 30 dias.");
                                          setProposals(prev => prev.filter(x => x.id !== p.id));
                                        } else {
                                          alert("Solicitação enviada por email à governança. A proposta continua ativa até a decisão do ADMIN.");
                                        }
                                      })
                                      .catch(() => alert("Erro de conexão."));
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

                          {/* Notas internas */}
                          {canChangeStage && (
                            <div className="mt-1.5" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  if (notesOpenId === p.id) { setNotesOpenId(null); return; }
                                  setNotesOpenId(p.id);
                                  setNoteText("");
                                  if (!inlineNotes[p.id]) loadNotes(p.id);
                                }}
                                className="flex items-center gap-1 text-[10px] font-medium transition-colors"
                                style={{ color: notesOpenId === p.id ? "#C9A84C" : (p.mesa_comments_count ?? 0) > 0 ? "#C9A84C" : "rgba(122,143,168,0.7)" }}
                              >
                                <MessageSquare className="w-3 h-3" />
                                {(p.mesa_comments_count ?? 0) > 0 ? `${p.mesa_comments_count} nota${(p.mesa_comments_count ?? 0) !== 1 ? "s" : ""}` : "Notas internas"}
                              </button>
                              {notesOpenId === p.id && (
                                <div className="mt-1.5 rounded-lg p-2 space-y-2" style={{ background: "#0F1C2E", border: "1px solid rgba(201,168,76,0.15)" }}>
                                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                    {!inlineNotes[p.id] && <p className="text-[10px] text-center py-1" style={{ color: "#7A8FA8" }}>Carregando...</p>}
                                    {inlineNotes[p.id]?.length === 0 && <p className="text-[10px] text-center py-1 italic" style={{ color: "#7A8FA8" }}>Sem notas ainda</p>}
                                    {inlineNotes[p.id]?.map((c) => (
                                      <div key={c.id} className="rounded p-1.5 space-y-0.5" style={{ background: "rgba(201,168,76,0.06)" }}>
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="text-[9px] font-semibold" style={{ color: "#C9A84C" }}>{c.author}</span>
                                          <span className="text-[9px]" style={{ color: "#7A8FA8" }}>{new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
                                        </div>
                                        <p className="text-[10px] leading-snug" style={{ color: "#F0ECE4" }}>{c.text}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex gap-1">
                                    <input
                                      type="text"
                                      value={noteText}
                                      onChange={e => setNoteText(e.target.value)}
                                      onKeyDown={e => { if (e.key === "Enter" && noteText.trim()) handleAddNote(p.id); }}
                                      placeholder="Adicionar nota..."
                                      className="flex-1 px-2 py-1 rounded text-[10px] outline-none"
                                      style={{ background: "#162744", border: "1px solid rgba(201,168,76,0.2)", color: "#F0ECE4" }}
                                    />
                                    <button
                                      onClick={() => handleAddNote(p.id)}
                                      disabled={noteSaving || !noteText.trim()}
                                      className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-40"
                                      style={{ background: "rgba(201,168,76,0.2)", color: "#C9A84C" }}
                                    >
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Badge OCR automático — validação de documentos */}
                          {ocrAutoRunning[p.id] ? (
                            <div className="mt-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30">
                              <svg className="w-3 h-3 text-[#C9A84C] animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                              <span className="text-[10px] font-semibold text-[#C9A84C]">Validando documentos...</span>
                            </div>
                          ) : (() => {
                            const ocrResults = p.metadata?.ocr_results as Array<{ resumo: string }> | undefined;
                            const resumoGeral = (p.metadata?.ocr_resumo_geral as string) ??
                              (ocrResults?.length
                                ? (ocrResults.some(r => r.resumo === "reprovado") ? "reprovado"
                                  : ocrResults.some(r => r.resumo === "atencao") ? "atencao" : "aprovado")
                                : null);
                            if (!resumoGeral) return null;
                            const cfg = {
                              aprovado: { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400", icon: "✓", label: "Docs OK" },
                              atencao:  { bg: "bg-amber-500/15",  border: "border-amber-500/30",  text: "text-amber-400",  icon: "⚠", label: "Atenção" },
                              reprovado:{ bg: "bg-red-500/15",    border: "border-red-500/30",    text: "text-red-400",    icon: "✗", label: "Doc errado" },
                            }[resumoGeral] ?? null;
                            if (!cfg) return null;
                            return (
                              <div className={`mt-1.5 flex items-center gap-1 px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.border}`}
                                title={`Validação OCR: ${resumoGeral}`}>
                                <span className={`text-[10px] font-bold ${cfg.text}`}>{cfg.icon} {cfg.label}</span>
                              </div>
                            );
                          })()}

                          {/* Bloco de pendência — exibido quando stage = PENDENCIA */}
                          {p.stage === "PENDENCIA" && (
                            <CardPendingBlock
                              proposal={p}
                              canChangeStage={canChangeStage}
                              currentUserName={currentUser?.full_name}
                              onResolve={async () => {
                                const now = new Date().toISOString();
                                setProposals(prev => prev.map(x => x.id === p.id ? { ...x, stage: "ANALISE", pending_resolved_at: now, pending_resolved_by: currentUser?.full_name ?? "Usuário" } : x));
                                await fetch("/api/credit-proposals", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, stage: "ANALISE", pending_resolved_at: now, pending_resolved_by: currentUser?.full_name ?? "Usuário" }) }).catch(() => {});
                                showToast("Pendência resolvida.");
                              }}
                              onReminder={async () => { await handleSendProposalReminder(p); }}
                              onSaved={(updates) => {
                                setProposals(prev => prev.map(x => x.id === p.id ? { ...x, ...updates } : x));
                                if (detailProposal?.id === p.id) setDetailProposal(prev => prev ? { ...prev, ...updates } : prev);
                              }}
                            />
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

                          {/* Navegação rápida de stage */}
                          {(hasPrev || hasNext) && (
                            <div className="mt-2 pt-2 border-t border-border/30 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                              {hasPrev && (
                                <button
                                  onClick={() => handleStageChange(p.id, stageKeys[cardIdx - 1])}
                                  className="flex-1 py-0.5 rounded text-[9px] font-medium text-muted-foreground hover:text-white hover:bg-secondary border border-border/40 flex items-center justify-center gap-0.5 transition-colors"
                                  title={PIPELINE_STAGES[cardIdx - 1]?.label}
                                >
                                  <ArrowLeft className="w-2.5 h-2.5" />
                                  <span className="truncate">{PIPELINE_STAGES[cardIdx - 1]?.label}</span>
                                </button>
                              )}
                              {hasNext && (
                                <button
                                  onClick={() => handleStageChange(p.id, stageKeys[cardIdx + 1])}
                                  className="flex-1 py-0.5 rounded text-[9px] font-medium text-muted-foreground hover:text-white hover:bg-secondary border border-border/40 flex items-center justify-center gap-0.5 transition-colors"
                                  title={PIPELINE_STAGES[cardIdx + 1]?.label}
                                >
                                  <span className="truncate">{PIPELINE_STAGES[cardIdx + 1]?.label}</span>
                                  <ArrowRight className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

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
        <div className="space-y-3">
          {/* Barra de filtros */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={ticketSearch}
                onChange={(e) => setTicketSearch(e.target.value)}
                placeholder="Buscar por título, código, solicitante..."
                className="w-full h-9 pl-9 pr-4 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <select value={ticketStatusFilter} onChange={e => setTicketStatusFilter(e.target.value)}
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                {TICKET_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={ticketPriorityFilter} onChange={e => setTicketPriorityFilter(e.target.value)}
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                {TICKET_PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {(ticketSearch || ticketStatusFilter || ticketPriorityFilter) && (
                <button onClick={() => { setTicketSearch(""); setTicketStatusFilter(""); setTicketPriorityFilter(""); }}
                  className="h-9 px-2 rounded-lg border border-border text-muted-foreground hover:text-white hover:bg-secondary transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                Tickets ({filteredTickets.length})
              </CardTitle>
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
                dados: filteredTickets,
              }} />
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      {["Código", "Título", "Categoria", "Prioridade", "Status", "Responsável", "Vencimento", "Ação"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTickets.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-xs text-muted-foreground">Nenhum ticket encontrado.</td></tr>
                    ) : filteredTickets.map((ticket) => (
                      <tr key={ticket.id}
                        className="data-table-row cursor-pointer hover:bg-secondary/30 transition-colors"
                        onClick={() => setTicketDetail(ticket)}>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{ticket.code}</td>
                        <td className="px-4 py-3 max-w-52">
                          <p className="font-medium text-foreground truncate">{ticket.title}</p>
                          {ticket.description && (
                            <p className="text-[10px] text-muted-foreground truncate">{ticket.description}</p>
                          )}
                          {/* Badge pendência inline na tabela */}
                          {ticket.status === "PENDING" && ticket.pending_reason && (
                            <p className="text-[10px] italic truncate mt-0.5" style={{ color: "#FF6B6B" }}
                              title={ticket.pending_reason}>
                              {ticket.pending_reason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{CATEGORY_LABELS[ticket.category] ?? ticket.category}</td>
                        <td className="px-4 py-3">
                          <Badge className={PRIORITY_COLORS[ticket.priority as TicketPriority]}>{PRIORITY_LABELS[ticket.priority as TicketPriority]}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {ticket.status === "PENDING" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                              style={{ background: "#3A1F1F", color: "#FF6B6B", border: "1px solid rgba(255,107,107,0.3)" }}>
                              PENDENTE
                            </span>
                          ) : (
                            <Badge className={STATUS_COLORS[ticket.status as OperationStatus]}>{STATUS_LABELS[ticket.status as OperationStatus]}</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {ticket.assignee?.full_name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{ticket.due_date ? formatDateTime(ticket.due_date) : "—"}</td>
                        <td className="px-4 py-3 flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
                          {/* Botões especiais de pendência */}
                          {ticket.status === "PENDING" && ["ADMIN","GESTAO","MESA_OPERACIONAL"].includes(currentUser?.role ?? "") && (
                            <>
                              <button
                                onClick={() => setResolveTarget(ticket)}
                                className="text-xs flex items-center gap-0.5 font-semibold"
                                style={{ color: "#4ADE80" }}
                              >
                                <CheckCircle2 className="w-3 h-3" /> Resolver
                              </button>
                              <button
                                onClick={() => handleSendReminder(ticket)}
                                className="text-xs flex items-center gap-0.5 font-semibold"
                                style={{ color: "#C9A84C" }}
                                title={ticket.reminder_sent_at ? `Último lembrete: ${timeAgo(ticket.reminder_sent_at)}` : "Enviar lembrete"}
                              >
                                <Bell className="w-3 h-3" />
                                {ticket.reminder_sent_at ? timeAgo(ticket.reminder_sent_at) : "Lembrar"}
                              </button>
                            </>
                          )}
                          {ticket.status !== "PENDING" && (
                            <button
                              onClick={async () => {
                                const newStatus = ticket.status === "COMPLETED" ? "IN_REVIEW" : "PENDING";
                                if (newStatus === "PENDING") {
                                  setPendingTarget(ticket);
                                  return;
                                }
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
                          {ticket.status !== "COMPLETED" && ticket.status !== "PENDING" && (
                            <button
                              onClick={async () => {
                                const newStatus = "COMPLETED";
                                setTickets((prev) => prev.map((t) => t.id === ticket.id ? { ...t, status: newStatus } : t));
                                await fetch("/api/tickets", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: ticket.id, status: newStatus }),
                                }).catch(() => {});
                              }}
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              Concluir
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
        </div>
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
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Contratos ({contratos.length})</CardTitle>
              <ExportButton opts={{
                titulo: "Contratos",
                orientacao: "landscape",
                colunas: [
                  { header: "Proposta", key: "proposal_code", width: 14 },
                  { header: "Cliente", key: "client_name", width: 28 },
                  { header: "E-mail", key: "client_email", width: 28 },
                  { header: "Linha", key: "credit_line", width: 20 },
                  { header: "Status", key: "status", width: 22 },
                  { header: "Expira", key: "expires_at", format: "date", width: 14 },
                ],
                dados: contratos,
              }} />
            </CardHeader>
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
      <SLAConfigModal
        open={slaModalOpen}
        onClose={() => setSlaModalOpen(false)}
        config={slaConfig}
        onSave={(cfg) => { setSlaConfig(cfg); saveSlaConfig(cfg); }}
      />

      <StageSLAModal
        open={!!stageSlaTarget}
        onClose={() => setStageSlaTarget(null)}
        proposal={stageSlaTarget?.proposal ?? null}
        stage={stageSlaTarget?.stage ?? null}
        globalSla={slaConfig}
        onConfirm={handleConfirmStageSla}
      />

      <NovoTicketModal open={novoTicket} onClose={() => setNovoTicket(false)}
        onSubmit={(t) => setTickets(prev => [t, ...prev])} />

      <TicketDetailModal
        open={!!ticketDetail}
        onClose={() => setTicketDetail(null)}
        ticket={ticketDetail}
        currentUser={currentUser}
        onUpdated={(id, updates) => {
          setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
          setTicketDetail(null);
        }}
        onOpenPending={() => { setPendingTarget(ticketDetail); setTicketDetail(null); }}
        onOpenResolve={() => { setResolveTarget(ticketDetail); setTicketDetail(null); }}
        onSendReminder={() => { if (ticketDetail) handleSendReminder(ticketDetail); }}
      />

      <EditarPropostaModal
        open={!!editProposal}
        onClose={() => setEditProposal(null)}
        proposal={editProposal}
        onSaved={(id, updates) => {
          handleProposalUpdate(id, updates);
          setEditProposal(null);
        }}
      />

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

      {/* ── Modal de Pendência ── */}
      <PendingModal
        open={!!pendingTarget}
        onClose={() => setPendingTarget(null)}
        ticket={pendingTarget}
        onConfirm={async (reason, responsible) => {
          if (pendingTarget) await handleConfirmPending(pendingTarget, reason, responsible);
        }}
      />

      {/* ── Modal de Resolução ── */}
      <ResolveModal
        open={!!resolveTarget}
        onClose={() => setResolveTarget(null)}
        ticket={resolveTarget}
        onConfirm={async (obs) => {
          if (resolveTarget) await handleConfirmResolve(resolveTarget, obs);
        }}
      />

      {/* ── Modal de Pendência — Deal/Proposta ── */}
      {pendingProposalTarget && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 pt-10" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "#111F35", border: "1px solid rgba(201,168,76,0.2)" }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,107,107,0.15)" }}>
                <AlertCircle className="w-5 h-5" style={{ color: "#FF6B6B" }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Registrar Pendência</h3>
                <p className="text-[11px]" style={{ color: "#7A8FA8" }}>{pendingProposalTarget.client_name} · {pendingProposalTarget.code}</p>
              </div>
            </div>
            <ProposalPendingForm
              proposal={pendingProposalTarget}
              onClose={() => setPendingProposalTarget(null)}
              onConfirm={handleConfirmProposalPending}
            />
          </div>
        </div>
      )}

      {/* ── Toast de feedback ── */}
      {reminderToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-xl text-sm font-medium text-white shadow-xl animate-fade-in"
          style={{ background: "#162744", border: "1px solid #C9A84C50" }}>
          {reminderToast}
        </div>
      )}

      {/* ── Overlay de loading do lembrete ── */}
      {reminderLoading && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/40">
          <div className="px-6 py-4 rounded-xl text-sm text-white flex items-center gap-3" style={{ background: "#162744", border: "1px solid #C9A84C50" }}>
            <span className="w-4 h-4 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
            Enviando lembrete...
          </div>
        </div>
      )}

      {/* ── Modal Rápido: Aprovar ── */}
      {quickAction?.type === "aprovar" && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
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

      {/* ── Seletor Nova Proposta ── */}
      {npSelector && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-sm font-bold text-white">Nova Proposta</h3>
              </div>
              <button onClick={() => setNpSelector(false)} className="w-7 h-7 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Nível</label>
                <div className="flex gap-2">
                  {(["NIVEL_1", "NIVEL_2", "NIVEL_3"] as const).map((l) => (
                    <button key={l} onClick={() => setNpLevel(l)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors border ${npLevel === l ? "bg-[#C9A84C]/15 text-[#E8C97A] border-[#C9A84C]/40" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                      {l === "NIVEL_1" ? "Nível 1" : l === "NIVEL_2" ? "Nível 2" : "Nível 3"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Partner</label>
                <div className="relative mb-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    value={npPartnerSearch}
                    onChange={e => setNpPartnerSearch(e.target.value)}
                    placeholder={npPartnerName || "Buscar partner..."}
                    className="w-full h-8 pl-8 pr-3 text-xs bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                {npPartnersLoading ? (
                  <p className="text-xs text-muted-foreground px-1 py-2">Carregando...</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-secondary">
                    {npPartners
                      .filter(p => !npPartnerSearch || p.full_name.toLowerCase().includes(npPartnerSearch.toLowerCase()))
                      .map(p => (
                        <button key={p.id} onClick={() => { setNpPartnerId(p.id); setNpPartnerName(p.full_name); setNpPartnerSearch(""); }}
                          className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[#C9A84C]/10 ${npPartnerId === p.id ? "text-[#E8C97A] font-semibold" : "text-foreground"}`}>
                          {p.full_name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setNpSelector(false)}>Cancelar</Button>
              <Button size="sm" disabled={!npPartnerId} onClick={() => { setNpSelector(false); setNpOpen(true); }}>
                Continuar
              </Button>
            </div>
          </div>
        </div>
      )}

      <NovaPropostaModal
        open={npOpen}
        onClose={() => setNpOpen(false)}
        level={npLevel}
        partnerName={npPartnerName}
        partnerId={npPartnerId}
        onSubmit={handleNewProposal}
      />

      {/* ── Modal Rápido: Reprovar ── */}
      {quickAction?.type === "reprovar" && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
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

      {/* ── VIEW: DASHBOARD ── */}
      {view === "dashboard" && (() => {
        // ── Métricas de Tickets ──────────────────────────────────────────────
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const ticketsAbertos = tickets.filter(t => !["COMPLETED", "CANCELLED"].includes(t.status));
        const ticketsPendentes = tickets.filter(t => t.status === "PENDING");
        const ticketsResolvidosHoje = tickets.filter(t => {
          if (t.status !== "COMPLETED") return false;
          const updated = t.due_date ? new Date(t.due_date) : null;
          return updated && updated >= today;
        });

        const resolvedWithDuration = tickets
          .filter(t => t.status === "COMPLETED" && t.due_date)
          .map(t => (new Date(t.due_date!).getTime() - new Date(t.created_at).getTime()) / 86400000)
          .filter(d => d > 0);
        const tempoMedioTicket = resolvedWithDuration.length
          ? (resolvedWithDuration.reduce((a, b) => a + b, 0) / resolvedWithDuration.length).toFixed(1)
          : "—";

        // ── Métricas de Propostas ────────────────────────────────────────────
        const STAGES_ORDER = KANBAN_COLUMNS.map(s => s.key);
        const STAGE_LABELS_MAP: Record<string, string> = Object.fromEntries(KANBAN_COLUMNS.map(s => [s.key, s.label]));
        const STAGE_COLORS: Record<string, string> = {
          RECEBIDO: "#7A8FA8", TRIAGEM: "#60A5FA", ANALISE: "#A78BFA", PENDENCIA: "#F59E0B",
          AVALIACAO_IMOVEL: "#22D3EE", APROVACAO: "#34D399", CONTRATO_ASSINADO: "#818CF8",
          REGISTRO_IMOVEL: "#2DD4BF", LIBERADO: "#C9A84C", REPROVADO: "#F87171", DECLINADO: "#94A3B8",
        };

        // FINALIZADO (legado) conta pro estágio equivalente no funil, conforme o status
        const stageEquivalente = (p: ProposalCard) => {
          if (p.stage !== "FINALIZADO") return p.stage ?? "RECEBIDO";
          if (p.status === "REJECTED") return "REPROVADO";
          if (p.status === "CANCELLED") return "DECLINADO";
          return "LIBERADO";
        };

        const funilData = STAGES_ORDER.map(s => ({
          stage: s,
          label: STAGE_LABELS_MAP[s],
          count: proposals.filter(p => stageEquivalente(p) === s).length,
          color: STAGE_COLORS[s],
        }));
        const maxFunil = Math.max(...funilData.map(d => d.count), 1);

        // ── SLA em risco (propostas não finalizadas paradas há > 48h) ────────
        const slaEmRisco = proposals
          .filter(p => !(TERMINAL_STAGES as readonly string[]).includes(p.stage ?? ""))
          .map(p => {
            const ref = new Date(p.created_at).getTime();
            const hoursStuck = (Date.now() - ref) / 3600000;
            return { ...p, hoursStuck };
          })
          .filter(p => p.hoursStuck > 48)
          .sort((a, b) => b.hoursStuck - a.hoursStuck)
          .slice(0, 6);

        // ── Tickets por prioridade ───────────────────────────────────────────
        const prioData = [
          { key: "URGENT", label: "Urgente", color: "#FF6B6B", count: ticketsAbertos.filter(t => t.priority === "URGENT").length },
          { key: "HIGH", label: "Alta", color: "#F97316", count: ticketsAbertos.filter(t => t.priority === "HIGH").length },
          { key: "MEDIUM", label: "Média", color: "#F59E0B", count: ticketsAbertos.filter(t => t.priority === "MEDIUM").length },
          { key: "LOW", label: "Baixa", color: "#7A8FA8", count: ticketsAbertos.filter(t => t.priority === "LOW").length },
        ];
        const maxPrio = Math.max(...prioData.map(d => d.count), 1);

        // ── Volume por parceiro (top 5 propostas) ────────────────────────────
        const partnerMap: Record<string, { name: string; total: number; abertos: number }> = {};
        for (const p of proposals) {
          const pid = p.partner_id ?? "desconhecido";
          const pname = p.partner_name ?? "Desconhecido";
          if (!partnerMap[pid]) partnerMap[pid] = { name: pname, total: 0, abertos: 0 };
          partnerMap[pid].total++;
          if (!(TERMINAL_STAGES as readonly string[]).includes(p.stage ?? "")) partnerMap[pid].abertos++;
        }
        const topPartners = Object.values(partnerMap)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);

        return (
          <div className="space-y-6 animate-fade-in">
            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: "Propostas em Aberto",
                  value: proposals.filter(p => !(TERMINAL_STAGES as readonly string[]).includes(p.stage ?? "")).length,
                  icon: <TrendingUp className="w-5 h-5" style={{ color: "#60A5FA" }} />,
                  bg: "bg-blue-500/10",
                  sub: `${proposals.length} total`,
                },
                {
                  label: "Tickets Abertos",
                  value: ticketsAbertos.length,
                  icon: <AlertCircle className="w-5 h-5" style={{ color: "#F59E0B" }} />,
                  bg: "bg-amber-500/10",
                  sub: `${ticketsPendentes.length} em pendência`,
                },
                {
                  label: "Resolvidos Hoje",
                  value: ticketsResolvidosHoje.length,
                  icon: <CheckCircle2 className="w-5 h-5" style={{ color: "#34D399" }} />,
                  bg: "bg-emerald-500/10",
                  sub: "tickets concluídos",
                },
                {
                  label: "Tempo Médio (dias)",
                  value: tempoMedioTicket,
                  icon: <Timer className="w-5 h-5" style={{ color: "#C9A84C" }} />,
                  bg: "bg-[#C9A84C]/10",
                  sub: "por ticket resolvido",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl p-4 flex gap-3 items-center"
                  style={{ background: "#111F35", border: "1px solid rgba(201,168,76,0.12)" }}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${kpi.bg}`}>
                    {kpi.icon}
                  </div>
                  <div>
                    <p className="text-xl font-bold text-[#F0ECE4]">{kpi.value}</p>
                    <p className="text-xs font-medium text-[#F0ECE4]/80">{kpi.label}</p>
                    <p className="text-[10px] text-[#7A8FA8]">{kpi.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* ── Funil de Propostas ── */}
              <div className="rounded-xl p-5 space-y-3" style={{ background: "#111F35", border: "1px solid rgba(201,168,76,0.12)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 className="w-4 h-4" style={{ color: "#C9A84C" }} />
                  <h3 className="text-sm font-semibold text-[#F0ECE4]">Funil de Propostas</h3>
                </div>
                <div className="space-y-2">
                  {funilData.map(d => (
                    <div key={d.stage} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[#7A8FA8]">{d.label}</span>
                        <span className="text-xs font-bold" style={{ color: d.color }}>{d.count}</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: "#162744" }}>
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(d.count / maxFunil) * 100}%`, background: d.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Tickets por Prioridade ── */}
              <div className="rounded-xl p-5 space-y-3" style={{ background: "#111F35", border: "1px solid rgba(201,168,76,0.12)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4" style={{ color: "#C9A84C" }} />
                  <h3 className="text-sm font-semibold text-[#F0ECE4]">Tickets Abertos por Prioridade</h3>
                </div>
                <div className="space-y-2">
                  {prioData.map(d => (
                    <div key={d.key} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-[#7A8FA8]">{d.label}</span>
                        <span className="text-xs font-bold" style={{ color: d.color }}>{d.count}</span>
                      </div>
                      <div className="h-2 rounded-full" style={{ background: "#162744" }}>
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{ width: `${(d.count / maxPrio) * 100}%`, background: d.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {ticketsAbertos.length === 0 && (
                  <p className="text-xs text-[#7A8FA8] text-center py-2">Nenhum ticket em aberto</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* ── SLA em Risco ── */}
              <div className="rounded-xl p-5" style={{ background: "#111F35", border: "1px solid rgba(201,168,76,0.12)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-[#F0ECE4]">Alertas de SLA</h3>
                  {slaEmRisco.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                      {slaEmRisco.length}
                    </span>
                  )}
                </div>
                {slaEmRisco.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400/50" />
                    <p className="text-xs text-[#7A8FA8]">Nenhuma proposta em atraso</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {slaEmRisco.map(p => {
                      const days = Math.floor(p.hoursStuck / 24);
                      const isUrgent = days >= 5;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-[#162744]/80 transition-colors"
                          style={{ background: "#162744", border: `1px solid ${isUrgent ? "rgba(255,107,107,0.3)" : "rgba(245,158,11,0.2)"}` }}
                          onClick={() => setView("kanban")}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-[#F0ECE4] truncate">{p.client_name}</p>
                            <p className="text-[10px] text-[#7A8FA8]">{p.code} · {STAGE_LABELS_MAP[p.stage ?? "RECEBIDO"]}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            <Clock className="w-3 h-3" style={{ color: isUrgent ? "#FF6B6B" : "#F59E0B" }} />
                            <span className="text-[10px] font-bold" style={{ color: isUrgent ? "#FF6B6B" : "#F59E0B" }}>
                              {days}d parado
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Top Parceiros ── */}
              <div className="rounded-xl p-5" style={{ background: "#111F35", border: "1px solid rgba(201,168,76,0.12)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4" style={{ color: "#C9A84C" }} />
                  <h3 className="text-sm font-semibold text-[#F0ECE4]">Top Parceiros por Volume</h3>
                </div>
                {topPartners.length === 0 ? (
                  <p className="text-xs text-[#7A8FA8] py-6 text-center">Nenhuma proposta registrada</p>
                ) : (
                  <div className="space-y-2">
                    {topPartners.map((p, i) => (
                      <div key={p.name} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "#162744" }}>
                        <span className="text-xs font-bold w-4 text-center" style={{ color: i === 0 ? "#C9A84C" : "#7A8FA8" }}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#F0ECE4] truncate">{p.name}</p>
                          <p className="text-[10px] text-[#7A8FA8]">{p.abertos} em aberto</p>
                        </div>
                        <span className="text-xs font-bold text-[#E8C97A] flex-shrink-0">{p.total} prop.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
