"use client";

import React from "react";
import {
  X, User, Building2, CheckCircle2, Clock, ArrowRight,
  FileText, CreditCard, Banknote, Calendar, Link2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, type OperationStatus } from "@/lib/constants";

export const PIPELINE_STAGES = [
  { key: "RECEBIDO", label: "Recebido", color: "text-slate-400", bg: "bg-slate-500/20" },
  { key: "TRIAGEM", label: "Triagem", color: "text-blue-400", bg: "bg-blue-500/20" },
  { key: "ANALISE", label: "Análise de Crédito", color: "text-amber-400", bg: "bg-amber-500/20" },
  { key: "PENDENCIA", label: "Pendência de Docs", color: "text-orange-400", bg: "bg-orange-500/20" },
  { key: "APROVACAO", label: "Em Aprovação", color: "text-purple-400", bg: "bg-purple-500/20" },
  { key: "FINALIZADO", label: "Finalizado", color: "text-emerald-400", bg: "bg-emerald-500/20" },
];

export interface ProposalFull {
  id: string;
  code: string;
  title: string;
  client_name: string;
  client_type?: string;
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
  credit_line: string;
  requested_value: number;
  approved_value: number | null;
  prazo?: string;
  finalidade?: string;
  current_level: string;
  status: string;
  stage?: string;
  partner_id?: string;
  partner_name?: string;
  docs_uploaded?: number;
  docs_required?: number;
  created_at: string;
}

interface PropostaDetailModalProps {
  open: boolean;
  onClose: () => void;
  proposal: ProposalFull | null;
  onStageChange?: (proposalId: string, newStage: string) => void;
  canChangeStage?: boolean;
}

export function PropostaDetailModal({ open, onClose, proposal, onStageChange, canChangeStage }: PropostaDetailModalProps) {
  if (!open || !proposal) return null;

  const currentStageIdx = PIPELINE_STAGES.findIndex((s) => s.key === (proposal.stage ?? "RECEBIDO"));
  const activeIdx = currentStageIdx >= 0 ? currentStageIdx : 0;

  function advance() {
    if (!proposal || activeIdx >= PIPELINE_STAGES.length - 1) return;
    onStageChange?.(proposal.id, PIPELINE_STAGES[activeIdx + 1].key);
  }

  const isFinished = activeIdx === PIPELINE_STAGES.length - 1;
  const nextStage = !isFinished ? PIPELINE_STAGES[activeIdx + 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-muted-foreground">{proposal.code}</span>
              <Badge className={STATUS_COLORS[proposal.status as OperationStatus]}>
                {STATUS_LABELS[proposal.status as OperationStatus] ?? proposal.status}
              </Badge>
            </div>
            <h2 className="text-base font-bold text-white">{proposal.title}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors ml-4 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── Pipeline de Etapas ── */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Etapas da Proposta</p>
            <div className="flex items-center gap-0">
              {PIPELINE_STAGES.map((stage, idx) => (
                <React.Fragment key={stage.key}>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                      idx < activeIdx
                        ? "bg-emerald-500 border-emerald-500"
                        : idx === activeIdx
                        ? "border-primary bg-primary/20"
                        : "border-border bg-secondary/50"
                    }`}>
                      {idx < activeIdx ? (
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      ) : idx === activeIdx ? (
                        <Clock className="w-4 h-4 text-primary" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                      )}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight max-w-14 ${
                      idx === activeIdx ? "text-primary" : idx < activeIdx ? "text-emerald-400" : "text-muted-foreground"
                    }`}>
                      {stage.label}
                    </span>
                  </div>
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <div className={`flex-1 h-0.5 mb-4 ${idx < activeIdx ? "bg-emerald-500" : "bg-border"}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* ── Dados do Cliente ── */}
          <div className="grid grid-cols-2 gap-4">
            <InfoSection title="Cliente" icon={proposal.client_type === "PJ" ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}>
              <InfoRow label="Nome" value={proposal.client_name} />
              {proposal.cpf_cnpj && <InfoRow label={proposal.client_type === "PJ" ? "CNPJ" : "CPF"} value={proposal.cpf_cnpj} />}
              {proposal.email && <InfoRow label="E-mail" value={proposal.email} />}
              {proposal.telefone && <InfoRow label="Telefone" value={proposal.telefone} />}
              <InfoRow label="Tipo" value={proposal.client_type === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"} />
            </InfoSection>

            <InfoSection title="Operação" icon={<CreditCard className="w-4 h-4" />}>
              <InfoRow label="Linha" value={proposal.credit_line} highlight />
              <InfoRow label="Valor Solicitado" value={formatCurrency(proposal.requested_value)} />
              {proposal.approved_value && (
                <InfoRow label="Valor Aprovado" value={formatCurrency(proposal.approved_value)} success />
              )}
              {proposal.prazo && <InfoRow label="Prazo" value={proposal.prazo} />}
              {proposal.finalidade && <InfoRow label="Finalidade" value={proposal.finalidade} />}
            </InfoSection>
          </div>

          {/* Partner vinculado */}
          {proposal.partner_name && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
              <Link2 className="w-4 h-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-primary">Partner Responsável</p>
                <p className="text-sm font-medium text-white">{proposal.partner_name}</p>
                {proposal.partner_id && <p className="text-xs text-muted-foreground">ID: {proposal.partner_id}</p>}
              </div>
            </div>
          )}

          {/* Documentos */}
          {typeof proposal.docs_uploaded === "number" && (
            <div className="p-3 rounded-xl border border-border bg-secondary/30">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Documentos
                </p>
                <Badge className={proposal.docs_uploaded >= (proposal.docs_required ?? 0)
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-400 border-amber-500/30"}>
                  {proposal.docs_uploaded}/{proposal.docs_required ?? "?"} enviados
                </Badge>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, ((proposal.docs_uploaded ?? 0) / (proposal.docs_required || 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Datas */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            Criado em {formatDate(proposal.created_at)}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          {canChangeStage && !isFinished && nextStage && (
            <Button size="sm" onClick={advance} className="gap-2">
              Avançar para <span className={nextStage.color}>{nextStage.label}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
          {isFinished && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-3 py-1">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Proposta Finalizada
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function InfoSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">{icon}{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value, highlight, success }: { label: string; value: string; highlight?: boolean; success?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-xs text-muted-foreground flex-shrink-0">{label}</span>
      <span className={`text-xs font-medium text-right ${success ? "text-emerald-400" : highlight ? "text-primary" : "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}
