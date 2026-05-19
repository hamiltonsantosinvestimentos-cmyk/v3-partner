"use client";

import React, { useState, useEffect } from "react";
import {
  X, User, Building2, CheckCircle2, Clock, ArrowRight, ArrowLeft,
  FileText, CreditCard, Calendar, Link2, Pencil, Check, Edit2,
  Percent, TrendingUp, BadgeDollarSign, Upload, Paperclip, Trash2, Home, ExternalLink,
  Package, Copy, CheckCheck, MessageSquare, Send, Search, AlertTriangle, AlertCircle, ShieldCheck,
  Phone, Mail, MapPin, Banknote, Download, Loader2, Brain, RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, type OperationStatus } from "@/lib/constants";
import { CHECKLISTS, DEFAULT_CHECKLIST } from "./nova-proposta-modal";
import { RecomendacaoLinha } from "./recomendacao-linha";

export type MesaComment = {
  id: string;
  text: string;
  author: string;
  created_at: string;
};

// Taxa de impostos sobre comissões (ISS 2% + PIS 0,65% + COFINS 3%) — sincronizado com aba Financeiro
const TAXA_IMPOSTOS_COMISSAO = 5.65;

export const PIPELINE_STAGES = [
  { key: "RECEBIDO", label: "Recebido", color: "text-slate-400", bg: "bg-slate-500/20" },
  { key: "TRIAGEM", label: "Triagem", color: "text-blue-400", bg: "bg-blue-500/20" },
  { key: "ANALISE", label: "Análise de Crédito", color: "text-amber-400", bg: "bg-amber-500/20" },
  { key: "PENDENCIA", label: "Pendência de Docs", color: "text-orange-400", bg: "bg-orange-500/20" },
  { key: "APROVACAO", label: "Em Aprovação", color: "text-purple-400", bg: "bg-purple-500/20" },
  { key: "FINALIZADO", label: "Finalizado", color: "text-emerald-400", bg: "bg-emerald-500/20" },
];

export interface ImovelMeta {
  endereco?: string;
  cep?: string;
  valor_medio?: number;
  cidade?: string;
  estado?: string;
  zona?: string;
  padrao?: string;
  estilo?: string;
  area_rural?: string;
  proprietario?: string;
}

export interface ProposalMeta {
  client_type?: string;
  email?: string;
  telefone?: string;
  prazo?: string;
  finalidade?: string;
  restricao_cliente?: string;
  imoveis?: ImovelMeta[];
  endereco_cep?: string;
  // Dados PF
  rg?: string;
  nascimento?: string;
  estado_civil?: string;
  renda_mensal?: number;
  // Dados PJ
  razao_social?: string;
  nome_fantasia?: string;
  socio_responsavel?: string;
  faturamento_mensal?: number;
  // Endereço
  endereco_rua?: string;
  endereco_cidade?: string;
  endereco_uf?: string;
  observacoes?: string;
  // Documentos anexados pelo cliente via captação
  documentos?: Array<{ label: string; name: string; url: string }>;
  captacao_origin?: boolean;
  [key: string]: unknown;
}

export interface ProposalFull {
  id: string;
  code: string;
  title: string;
  client_name: string;
  client_cpf_cnpj?: string | null;
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
  level1_notes?: string | null;
  level2_notes?: string | null;
  level3_notes?: string | null;
  level1_at?: string | null;
  level2_at?: string | null;
  level3_at?: string | null;
  // Campos de comissão (editáveis apenas por MESA_OPERACIONAL/ADMIN)
  valor_credito_atual?: number;
  comissao_mandato_perc?: number;
  comissao_instituicao_perc?: number;
  imovel_endereco?: string;
  imovel_valor_medio?: number;
  imovel_cidade?: string;
  imovel_estado?: string;
  mesa_comments?: MesaComment[];
  metadata?: ProposalMeta;
  instituicao_encaminhada?: string | null;
  // Campos de pendência
  pending_reason?: string | null;
  pending_responsible?: string | null;
  pending_at?: string | null;
  pending_resolved_at?: string | null;
  pending_resolved_by?: string | null;
  reminder_sent_at?: string | null;
}

interface EscavadorProcesso {
  numero_cnj: string;
  polo_ativo: string | null;
  polo_passivo: string | null;
  data_inicio: string | null;
  data_ultima_movimentacao: string | null;
  estado: string | null;
  tribunal: string | null;
  grau: string | null;
  status: string | null;
  valor_causa: number | null;
}

interface EscavadorResult {
  total_processos: number;
  match_tipo: string | null;
  processos: EscavadorProcesso[];
  error?: string;
}

interface CompiledDoc {
  doc_id: string;
  file_name: string;
  url: string | null;
  uploaded_at: string;
}

interface PropostaDetailModalProps {
  open: boolean;
  onClose: () => void;
  proposal: ProposalFull | null;
  onStageChange?: (proposalId: string, newStage: string) => void;
  onProposalUpdate?: (proposalId: string, updates: Partial<ProposalFull>) => void;
  canChangeStage?: boolean;
  canEditValorSolicitado?: boolean;
  canCompileDocuments?: boolean;
  canEditInstituicao?: boolean;
}

// ── CopyClientLinkButton ── botão para copiar link de acompanhamento ──────────
function CopyClientLinkButton({ proposalId }: { proposalId: string }) {
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/acompanhar/${proposalId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar link de acompanhamento para o cliente"
      className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#243A66]/50 border border-[#243A66] text-[#7A8FA8] hover:bg-[#243A66] hover:text-[#F0ECE4] transition-colors text-xs font-semibold"
    >
      {copied ? (
        <>
          <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-emerald-400">Copiado!</span>
        </>
      ) : (
        <>
          <Link2 className="w-3.5 h-3.5" />
          Link Cliente
        </>
      )}
    </button>
  );
}

// ── PartnerDocUpload ── upload livre de documentos (partner e admin) ──────────
type FreeDoc = { doc_id: string; file_name: string; storage_path: string; uploaded_at: string; url: string | null };

function PartnerDocUpload({ proposalId }: { proposalId: string }) {
  const [docs, setDocs] = React.useState<FreeDoc[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/credit-proposals/documents?proposal_id=${proposalId}`);
      if (!res.ok) return;
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch {
      // silencioso
    }
  }, [proposalId]);

  React.useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("proposal_id", proposalId);
      // doc_id livre: prefixo + timestamp para não colidir com checklist
      form.append("doc_id", `anexo_${Date.now()}`);
      form.append("file", file);
      const res = await fetch("/api/credit-proposals/documents", { method: "POST", body: form });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Erro ao enviar documento.");
      } else {
        await load();
      }
    } catch {
      setError("Erro de conexão ao enviar documento.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (doc: FreeDoc) => {
    setDeleting(doc.storage_path);
    try {
      const params = new URLSearchParams({
        proposal_id: proposalId,
        doc_id: doc.doc_id,
        file_key: doc.storage_path,
      });
      const res = await fetch(`/api/credit-proposals/documents?${params}`, { method: "DELETE" });
      if (res.ok) setDocs(prev => prev.filter(d => d.storage_path !== doc.storage_path));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="rounded-xl border border-[#243A66] bg-[#111F35] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-[#C9A84C]" />
          <span className="text-sm font-semibold text-[#F0ECE4]">Documentos Anexados</span>
          {docs.length > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C] bg-[#C9A84C]/10 px-2 py-0.5 rounded-full">
              {docs.length}
            </span>
          )}
        </div>
        <Button
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold text-xs h-8 px-3"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
          {uploading ? "Enviando…" : "Anexar Documento"}
        </Button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept="*/*" />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
      )}

      {docs.length === 0 && !uploading && (
        <p className="text-xs text-[#7A8FA8] text-center py-4">
          Nenhum documento anexado. Clique em &quot;Anexar Documento&quot; para enviar arquivos.
        </p>
      )}

      {docs.length > 0 && (
        <ul className="space-y-2">
          {docs.map(doc => (
            <li key={doc.storage_path} className="flex items-center justify-between gap-3 rounded-lg bg-[#162744] px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-[#7A8FA8] shrink-0" />
                <span className="text-xs text-[#F0ECE4] truncate">{doc.file_name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded hover:bg-[#243A66] text-[#7A8FA8] hover:text-[#C9A84C] transition-colors"
                    title="Baixar"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                )}
                <button
                  onClick={() => handleDelete(doc)}
                  disabled={deleting === doc.storage_path}
                  className="p-1.5 rounded hover:bg-red-500/10 text-[#7A8FA8] hover:text-red-400 transition-colors disabled:opacity-50"
                  title="Remover"
                >
                  {deleting === doc.storage_path ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── CorrecaoFeitaBtn ── botão para partner marcar correção feita ──────────────
function CorrecaoFeitaBtn({
  proposalId,
  proposalCode,
  docKey,
  docLabel,
  onCorrigido,
  labelOverride,
}: {
  proposalId: string;
  proposalCode: string;
  docKey: string;
  docLabel: string;
  onCorrigido: (novoStage: string) => void;
  labelOverride?: string;
}) {
  const [enviando, setEnviando] = React.useState(false);
  const [enviado, setEnviado] = React.useState(false);

  async function handleClick() {
    setEnviando(true);
    try {
      const res = await fetch("/api/ocr-correcao-feita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposalId, proposal_code: proposalCode, doc_key: docKey }),
      });
      const json = await res.json();
      if (json.ok) {
        setEnviado(true);
        onCorrigido(json.novo_stage ?? "TRIAGEM");
      }
    } catch {
      // silently ignore
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-semibold">
        <CheckCircle2 className="w-3.5 h-3.5" /> Enviado!
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={enviando}
      className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold bg-[#C9A84C]/15 text-[#C9A84C] hover:bg-[#C9A84C]/25 border border-[#C9A84C]/30 disabled:opacity-50 transition-colors"
    >
      {enviando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
      {enviando ? "Enviando…" : (labelOverride ?? "Correção Feita")}
    </button>
  );
}

// ── Banner de Pendência com edição inline ─────────────────────────────────
function PendingBanner({ proposal, canChangeStage, onProposalUpdate, onStageChange }: {
  proposal: ProposalFull;
  canChangeStage: boolean;
  onProposalUpdate?: (id: string, updates: Partial<ProposalFull>) => void;
  onStageChange?: (id: string, stage: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [reason, setReason] = useState(proposal.pending_reason ?? "");
  const [responsible, setResponsible] = useState(proposal.pending_responsible ?? "");
  const [saving, setSaving] = useState(false);

  // Sincroniza se a proposta mudar por fora
  useEffect(() => {
    if (!editing) {
      setReason(proposal.pending_reason ?? "");
      setResponsible(proposal.pending_responsible ?? "");
    }
  }, [proposal.pending_reason, proposal.pending_responsible, editing]);

  async function handleSave() {
    setSaving(true);
    const updates = { pending_reason: reason.trim(), pending_responsible: responsible.trim() };
    await fetch("/api/credit-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposal.id, ...updates }),
    }).catch(() => {});
    onProposalUpdate?.(proposal.id, updates);
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,107,107,0.4)", background: "rgba(58,31,31,0.6)" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid rgba(255,107,107,0.2)" }}>
        <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#FF6B6B" }} />
        <p className="text-xs font-bold flex-1" style={{ color: "#FF6B6B" }}>Proposta em Pendência</p>
        {proposal.pending_at && !editing && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,107,107,0.15)", color: "#FF6B6B" }}>
            desde {new Date(proposal.pending_at).toLocaleDateString("pt-BR")}
          </span>
        )}
        {canChangeStage && !proposal.pending_resolved_at && (
          <button
            onClick={() => { setEditing(e => !e); setReason(proposal.pending_reason ?? ""); setResponsible(proposal.pending_responsible ?? ""); }}
            className="w-6 h-6 rounded flex items-center justify-center transition-colors ml-1"
            style={{ color: editing ? "#C9A84C" : "rgba(255,107,107,0.6)", background: editing ? "rgba(201,168,76,0.1)" : "transparent" }}
            title="Editar pendência"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="px-4 py-3 space-y-3">
        {editing ? (
          <>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#FF6B6B", opacity: 0.7 }}>Motivo da Pendência</p>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Descreva o motivo da pendência..."
                className="w-full px-3 py-2 rounded-lg text-sm resize-none outline-none"
                style={{ background: "#1A2A3A", border: "1px solid rgba(255,107,107,0.4)", color: "#F0ECE4" }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#FF6B6B", opacity: 0.7 }}>Responsável pela Resolução</p>
              <input
                type="text"
                value={responsible}
                onChange={e => setResponsible(e.target.value)}
                placeholder="Nome do responsável..."
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: "#1A2A3A", border: "1px solid rgba(255,107,107,0.4)", color: "#F0ECE4" }}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "rgba(255,255,255,0.05)", color: "#7A8FA8" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !reason.trim()}
                className="flex-1 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                style={{ background: "rgba(201,168,76,0.15)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}
              >
                {saving ? "Salvando..." : "✓ Salvar"}
              </button>
            </div>
          </>
        ) : (
          <>
            {proposal.pending_reason && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#FF6B6B", opacity: 0.7 }}>Motivo</p>
                <p className="text-sm italic" style={{ color: "#FF6B6B" }}>{proposal.pending_reason}</p>
              </div>
            )}
            {!proposal.pending_reason && (
              <p className="text-xs italic" style={{ color: "rgba(255,107,107,0.5)" }}>Nenhum motivo registrado. Clique em editar para adicionar.</p>
            )}
            {proposal.pending_responsible && (
              <p className="text-xs" style={{ color: "#FF6B6B", opacity: 0.8 }}>
                Responsável: <strong>{proposal.pending_responsible}</strong>
              </p>
            )}
            {proposal.pending_resolved_at && (
              <div className="pt-2" style={{ borderTop: "1px solid rgba(74,222,128,0.2)" }}>
                <p className="text-xs font-semibold" style={{ color: "#4ADE80" }}>
                  ✓ Resolvida em {new Date(proposal.pending_resolved_at).toLocaleDateString("pt-BR")}
                  {proposal.pending_resolved_by && ` por ${proposal.pending_resolved_by}`}
                </p>
              </div>
            )}
          </>
        )}
        {canChangeStage && !proposal.pending_resolved_at && !editing && (
          <div className="flex gap-2 pt-1" style={{ borderTop: "1px solid rgba(255,107,107,0.2)" }}>
            <button
              onClick={async () => {
                const now = new Date().toISOString();
                onStageChange?.(proposal.id, "ANALISE");
                onProposalUpdate?.(proposal.id, { stage: "ANALISE", pending_resolved_at: now });
                await fetch("/api/credit-proposals", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: proposal.id, stage: "ANALISE", pending_resolved_at: now }),
                }).catch(() => {});
              }}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={{ background: "rgba(74,222,128,0.15)", color: "#4ADE80", border: "1px solid rgba(74,222,128,0.3)" }}
            >
              ✓ Marcar como Resolvido
            </button>
            <button
              onClick={async () => {
                await fetch("/api/tickets/remind", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ proposal_id: proposal.id }),
                }).catch(() => {});
              }}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={{ background: "rgba(201,168,76,0.1)", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.3)" }}
            >
              🔔 Enviar Lembrete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function PropostaDetailModal({ open, onClose, proposal, onStageChange, onProposalUpdate, canChangeStage, canEditValorSolicitado, canCompileDocuments, canEditInstituicao }: PropostaDetailModalProps) {
  // ── Modal tab ─────────────────────────────────────────────────────────────
  type ModalTab = "detalhes" | "recomendacao" | "documentos" | "comentarios" | "analise_ia";
  const [modalTab, setModalTab] = useState<ModalTab>("detalhes");
  const bodyRef = React.useRef<HTMLDivElement>(null);

  // Volta ao topo e reseta aba ao abrir uma proposta
  useEffect(() => {
    if (open && proposal) {
      setModalTab("detalhes");
      setTimeout(() => { bodyRef.current?.scrollTo({ top: 0, behavior: "instant" }); }, 0);
    }
  }, [open, proposal?.id]);
  const [rulesKey] = useState(0);

  // ── Análise IA state ──────────────────────────────────────────────────────
  type AnaliseStatus = "idle" | "loading" | "done" | "error";
  interface AnaliseIA {
    resumo_executivo: string; parecer: string; score_risco: string;
    cinco_cs: { carater: string; capacidade: string; capital: string; colateral: string; condicoes: string };
    analise_financeira: string; capacidade_pagamento: string; comprometimento_renda: string; gap_analise: string;
    pontos_criticos: string[]; pontos_atencao: string[]; pontos_positivos: string[];
    analise_documentos: string; historico_operacao: string; parecer_final: string;
    generated_at?: string;
  }
  const [analiseStatus, setAnaliseStatus] = useState<AnaliseStatus>("idle");
  const [analiseData, setAnaliseData] = useState<AnaliseIA | null>(null);
  const [analisePdfB64, setAnalisePdfB64] = useState<string | null>(null);
  const [analiseErro, setAnaliseErro] = useState<string>("");

  // Carrega análise prévia do metadata ao abrir
  useEffect(() => {
    if (open && proposal) {
      const prev = (proposal.metadata as Record<string, unknown>)?.ai_analysis as AnaliseIA | undefined;
      if (prev) { setAnaliseData(prev); setAnaliseStatus("done"); }
      else { setAnaliseData(null); setAnaliseStatus("idle"); }
      setAnalisePdfB64(null);
    }
  }, [open, proposal?.id]);

  async function handleGerarAnalise() {
    if (!proposal) return;
    setAnaliseStatus("loading");
    setAnaliseData(null);
    setAnalisePdfB64(null);
    try {
      const res = await fetch("/api/credit-proposals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro desconhecido");
      setAnaliseData(json.analise);
      setAnalisePdfB64(json.pdf_base64 ?? null);
      setAnaliseStatus("done");
      onProposalUpdate?.(proposal.id, {
        metadata: { ...(proposal.metadata ?? {}), ai_analysis: json.analise } as typeof proposal.metadata,
      });
    } catch (e) {
      console.error("[AnaliseIA]", e);
      setAnaliseStatus("error");
      setAnaliseErro(String(e));
    }
  }

  function downloadPdf() {
    if (!analisePdfB64 || !proposal) return;
    const bytes = Uint8Array.from(atob(analisePdfB64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-comite-${proposal.code}.pdf`; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Checklist state ───────────────────────────────────────────────────────
  const IS_DEMO = false;
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});
  const [portfolioDocs, setPortfolioDocs] = useState<Record<string, { PF: { id: string; label: string; required: boolean; hint?: string }[]; PJ: { id: string; label: string; required: boolean; hint?: string }[] }>>({});
  // docId → array de { name, url, key }
  interface DocFile { name: string; url: string | null; key: string; }
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, DocFile[]>>({});
  const [isUploading, setIsUploading] = useState<string | null>(null); // docId em upload

  // ── OCR state ─────────────────────────────────────────────────────────────
  type OcrStatus = "idle" | "loading" | "done" | "error";
  interface OcrField { campo: string; extraido: string | null; esperado: string | null; status: "ok" | "divergente" | "ausente" | "info"; mensagem: string; }
  interface OcrResultado { doc_id: string; tipo_documento: string; campos: OcrField[]; resumo: "aprovado" | "atencao" | "reprovado"; observacoes: string; }

  // Carrega resultados OCR já salvos no metadata ao abrir o modal
  const savedOcrResultados = (proposal?.metadata?.ocr_resultados ?? {}) as Record<string, OcrResultado>;
  const savedOcrStatus: Record<string, OcrStatus> = {};
  Object.keys(savedOcrResultados).forEach(k => { savedOcrStatus[k] = "done"; });

  const [ocrStatus, setOcrStatus] = useState<Record<string, OcrStatus>>(savedOcrStatus);
  const [ocrResultados, setOcrResultados] = useState<Record<string, OcrResultado>>(savedOcrResultados);
  const [ocrErros, setOcrErros] = useState<Record<string, string>>({});
  const [ocrValidandoTodos, setOcrValidandoTodos] = useState(false);
  const [ocrBatchLoading, setOcrBatchLoading] = useState(false);
  const [ocrBatchProgress, setOcrBatchProgress] = useState<string>("");

  // ── Workflow de aprovação ─────────────────────────────────────────────────
  const [showAprovar, setShowAprovar] = useState(false);
  const [showReprovar, setShowReprovar] = useState(false);
  const [showEscalar, setShowEscalar] = useState(false);
  const [valorAprovado, setValorAprovado] = useState("");
  const [motivoReprovacao, setMotivoReprovacao] = useState("");
  const [nivelEscalar, setNivelEscalar] = useState("");
  const [savingAprovacao, setSavingAprovacao] = useState(false);

  async function handleAprovar() {
    if (!proposal || !valorAprovado) return;
    setSavingAprovacao(true);
    try {
      const val = parseFloat(valorAprovado.replace(/\D/g, "")) / 100;
      await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, status: "APPROVED", approved_value: val, stage: "FINALIZADO" }),
      });
      onProposalUpdate?.(proposal.id, { status: "APPROVED", approved_value: val, stage: "FINALIZADO" });
      onStageChange?.(proposal.id, "FINALIZADO");
      // Notifica o partner
      if (proposal.partner_id) {
        fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: proposal.partner_id,
            title: `✅ Proposta ${proposal.code} Aprovada`,
            message: `Sua proposta de crédito para ${proposal.client_name} foi aprovada no valor de ${val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
            type: "proposal",
            action_url: "/minhas-operacoes",
          }),
        }).catch(() => {});
      }
      setShowAprovar(false);
      setValorAprovado("");
    } finally { setSavingAprovacao(false); }
  }

  async function handleReprovar() {
    if (!proposal || !motivoReprovacao.trim()) return;
    setSavingAprovacao(true);
    try {
      const newMeta = { ...(proposal.metadata ?? {}), motivo_reprovacao: motivoReprovacao };
      await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, status: "REJECTED", metadata: newMeta }),
      });
      onProposalUpdate?.(proposal.id, { status: "REJECTED", metadata: newMeta as typeof proposal.metadata });
      // Notifica o partner
      if (proposal.partner_id) {
        fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: proposal.partner_id,
            title: `❌ Proposta ${proposal.code} Reprovada`,
            message: `Sua proposta de crédito para ${proposal.client_name} foi reprovada. Motivo: ${motivoReprovacao}`,
            type: "proposal",
            action_url: "/minhas-operacoes",
          }),
        }).catch(() => {});
      }
      setShowReprovar(false);
      setMotivoReprovacao("");
    } finally { setSavingAprovacao(false); }
  }

  async function handleEscalar() {
    if (!proposal || !nivelEscalar) return;
    setSavingAprovacao(true);
    try {
      await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, current_level: nivelEscalar, stage: "TRIAGEM", status: "PENDING" }),
      });
      onProposalUpdate?.(proposal.id, { current_level: nivelEscalar, stage: "TRIAGEM", status: "PENDING" });
      onStageChange?.(proposal.id, "TRIAGEM");
      setShowEscalar(false);
      setNivelEscalar("");
    } finally { setSavingAprovacao(false); }
  }

  const isEmAprovacao = proposal?.stage === "APROVACAO";
  const nivelAtual = proposal?.current_level ?? "NIVEL_1";
  const proximosNiveis = nivelAtual === "NIVEL_1"
    ? [{ key: "NIVEL_2", label: "N2 — Estruturado" }, { key: "NIVEL_3", label: "N3 — High Ticket" }]
    : nivelAtual === "NIVEL_2"
    ? [{ key: "NIVEL_3", label: "N3 — High Ticket" }]
    : [];

  // ── Solicitar correção state ──────────────────────────────────────────────
  const [solicitarDoc, setSolicitarDoc] = useState<{ docId: string; docLabel: string; motivo: string } | null>(null);
  const [solicitandoCorrecao, setSolicitandoCorrecao] = useState(false);
  const [correcaoEnviada, setCorrecaoEnviada] = useState<string | null>(null);
  const [showCompile, setShowCompile] = useState(false);
  const [compileLoading, setCompileLoading] = useState(false);
  const [compileDocs, setCompileDocs] = useState<CompiledDoc[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Instituição encaminhada (apenas mesa/admin) — suporta múltiplas
  const INSTITUICOES = [
    "BTG Pactual","Itaú BBA","Bradesco BBI","Santander","Caixa Econômica Federal",
    "Banco do Brasil","Daycoval","Mercantil do Brasil","Omni","Creditas",
    "BV Financeira","Safra","ABC Brasil","Fibra","Outra",
  ];
  const [instituicoesList, setInstituicoesList] = useState<string[]>([]);
  const [addingInst, setAddingInst] = useState<string>("");
  const [addingInstCustom, setAddingInstCustom] = useState<string>("");
  const [savingInstituicao, setSavingInstituicao] = useState(false);
  const [instituicaoSaved, setInstituicaoSaved] = useState(false);
  const [instituicaoError, setInstituicaoError] = useState<string | null>(null);

  function handleAddInstituicao() {
    const nome = addingInst === "Outra" ? addingInstCustom.trim() : addingInst;
    if (!nome || instituicoesList.includes(nome)) return;
    setInstituicoesList(prev => [...prev, nome]);
    setAddingInst("");
    setAddingInstCustom("");
  }

  async function handleSaveInstituicao() {
    if (!proposal) return;
    setSavingInstituicao(true);
    setInstituicaoError(null);
    try {
      const valor = JSON.stringify(instituicoesList);
      const res = await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, instituicao_encaminhada: valor }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error ?? `Erro ${res.status}`;
        setInstituicaoError(typeof msg === "string" ? msg : JSON.stringify(msg));
        return;
      }
      onProposalUpdate?.(proposal.id, { instituicao_encaminhada: valor });
      setInstituicaoSaved(true);
      setTimeout(() => setInstituicaoSaved(false), 2500);
    } catch (err) {
      setInstituicaoError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSavingInstituicao(false);
    }
  }

  useEffect(() => {
    if (!proposal) return;
    setCheckedDocs({});
    setUploadedFiles({});
    const instRaw = proposal.instituicao_encaminhada ?? "";
    let parsedInsts: string[] = [];
    if (instRaw) {
      try {
        const arr = JSON.parse(instRaw);
        parsedInsts = Array.isArray(arr) ? arr : [instRaw];
      } catch {
        parsedInsts = [instRaw];
      }
    }
    setInstituicoesList(parsedInsts);
    setAddingInst("");
    setAddingInstCustom("");
    setMesaComments(Array.isArray(proposal.mesa_comments) ? proposal.mesa_comments : []);
    setNewComment("");
    if (IS_DEMO) {
      try {
        const savedChecks = JSON.parse(localStorage.getItem(`v3_docs_${proposal.id}`) ?? "{}");
        const savedFiles  = JSON.parse(localStorage.getItem(`v3_files_${proposal.id}`) ?? "{}");
        setCheckedDocs(savedChecks);
        setUploadedFiles(savedFiles);
      } catch { /* ignore */ }
    } else {
      fetch(`/api/credit-proposals/documents?proposal_id=${proposal.id}`)
        .then((r) => r.json())
        .then(({ documents, checklist, mesa_comments }) => {
          const savedChecks: Record<string, boolean> = (checklist && typeof checklist === "object") ? checklist : {};
          const files: Record<string, { name: string; url: string | null; key: string }[]> = {};
          if (Array.isArray(documents)) {
            documents.forEach((d: { doc_id: string; file_name: string; url: string | null; file_key?: string }) => {
              savedChecks[d.doc_id] = true;
              if (!files[d.doc_id]) files[d.doc_id] = [];
              files[d.doc_id].push({ name: d.file_name, url: d.url ?? null, key: d.file_key ?? d.file_name });
            });
          }
          setCheckedDocs(savedChecks);
          setUploadedFiles(files);
          if (Array.isArray(mesa_comments)) setMesaComments(mesa_comments);
        })
        .catch(() => {});
    }
  }, [proposal?.id, open]);

  // Busca documentos do portfólio para checklist dinâmico
  useEffect(() => {
    if (!open) return;
    fetch("/api/portfolio")
      .then(r => r.json())
      .then(({ linhas }) => {
        if (!Array.isArray(linhas)) return;
        const map: Record<string, { PF: { id: string; label: string; required: boolean; hint?: string }[]; PJ: { id: string; label: string; required: boolean; hint?: string }[] }> = {};
        for (const linha of linhas) {
          const toItems = (arr: { id: string; nome: string; obrigatorio: boolean }[]) =>
            arr.map(d => ({ id: d.id, label: d.nome, required: d.obrigatorio }));
          const pf = Array.isArray(linha.documentos_pf) && linha.documentos_pf.length > 0 ? toItems(linha.documentos_pf) : null;
          const pj = Array.isArray(linha.documentos_pj) && linha.documentos_pj.length > 0 ? toItems(linha.documentos_pj) : null;
          if (pf || pj) {
            map[linha.nome.toLowerCase()] = { PF: pf ?? [], PJ: pj ?? [] };
          }
        }
        setPortfolioDocs(map);
      })
      .catch(() => {});
  }, [open]);

  function toggleDoc(docId: string) {
    if (!proposal) return;
    const updated = { ...checkedDocs, [docId]: !checkedDocs[docId] };
    setCheckedDocs(updated);
    if (IS_DEMO) {
      try { localStorage.setItem(`v3_docs_${proposal.id}`, JSON.stringify(updated)); } catch {}
    } else {
      fetch("/api/credit-proposals/checklist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id, checklist: updated }),
      }).catch(() => {});
    }
  }

  async function handleFileUpload(docId: string, file: File) {
    if (!proposal) return;
    if (IS_DEMO) {
      const newChecks = { ...checkedDocs, [docId]: true };
      const prev = uploadedFiles[docId] ?? [];
      const newFiles = { ...uploadedFiles, [docId]: [...prev, { name: file.name, url: null, key: file.name }] };
      setCheckedDocs(newChecks);
      setUploadedFiles(newFiles);
      return;
    }
    setIsUploading(docId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("proposal_id", proposal.id);
      formData.append("doc_id", docId);
      const res  = await fetch("/api/credit-proposals/documents", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Erro ao enviar arquivo"); return; }
      setCheckedDocs((prev) => ({ ...prev, [docId]: true }));
      setUploadedFiles((prev) => ({
        ...prev,
        [docId]: [...(prev[docId] ?? []), {
          name: file.name,
          url: json.document?.url ?? null,
          key: json.document?.file_key ?? file.name,
        }],
      }));
    } finally {
      setIsUploading(null);
    }
  }

  function removeFile(docId: string, fileKey: string) {
    if (!proposal) return;
    const remaining = (uploadedFiles[docId] ?? []).filter(f => f.key !== fileKey);
    setUploadedFiles(prev => ({ ...prev, [docId]: remaining }));
    if (remaining.length === 0) {
      setCheckedDocs(prev => ({ ...prev, [docId]: false }));
      // Remove resultado OCR ao excluir o último arquivo do documento
      setOcrStatus(prev => { const n = { ...prev }; delete n[docId]; return n; });
      setOcrResultados(prev => { const n = { ...prev }; delete n[docId]; return n; });
      const newOcrResultados = { ...(proposal.metadata?.ocr_resultados as Record<string, unknown> ?? {}) };
      delete newOcrResultados[docId];
      const newMeta = { ...(proposal.metadata ?? {}), ocr_resultados: newOcrResultados };
      onProposalUpdate?.(proposal.id, { metadata: newMeta as typeof proposal.metadata });
      fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, metadata: newMeta }),
      }).catch(() => {});
    }
    if (!IS_DEMO) {
      fetch(
        `/api/credit-proposals/documents?proposal_id=${proposal.id}&doc_id=${encodeURIComponent(docId)}&file_key=${encodeURIComponent(fileKey)}`,
        { method: "DELETE" }
      ).catch(() => {});
    }
  }

  async function handleOcrValidar(docId: string, docLabel: string, fileUrl?: string, fileKey?: string) {
    if (!proposal) return;
    const url = fileUrl ?? (uploadedFiles[docId] ?? []).find(f => f.url)?.url;
    if (!url) return;
    // Chave composta para rastrear OCR por arquivo individual
    const ocrKey = fileKey ? `${docId}::${fileKey}` : docId;

    setOcrStatus(prev => ({ ...prev, [ocrKey]: "loading" }));
    setOcrErros(prev => { const n = { ...prev }; delete n[ocrKey]; return n; });

    // Monta contexto da proposta para comparação
    const meta = proposal.metadata ?? {};
    const ctx: Record<string, string> = {
      nome_cliente: proposal.client_name ?? "",
      cpf_cnpj: proposal.client_cpf_cnpj ?? proposal.cpf_cnpj ?? "",
      tipo_pessoa: (meta.client_type as string) ?? "PF",
      linha_credito: proposal.credit_line ?? "",
      valor_solicitado: `R$ ${(proposal.requested_value ?? 0).toLocaleString("pt-BR")}`,
    };
    if (meta.email) ctx.email = meta.email as string;
    if (meta.telefone) ctx.telefone = meta.telefone as string;
    if (meta.renda_mensal) ctx.renda_mensal = `R$ ${(meta.renda_mensal as number).toLocaleString("pt-BR")}`;
    if (meta.faturamento_mensal) ctx.faturamento_mensal = `R$ ${(meta.faturamento_mensal as number).toLocaleString("pt-BR")}`;
    if (meta.razao_social) ctx.razao_social = meta.razao_social as string;
    if (meta.endereco_rua) ctx.endereco = `${meta.endereco_rua}, ${meta.endereco_cidade ?? ""} - ${meta.endereco_uf ?? ""}`;
    if (proposal.imovel_endereco) ctx.imovel_endereco = proposal.imovel_endereco;
    if (proposal.imovel_valor_medio) ctx.imovel_valor_medio = `R$ ${proposal.imovel_valor_medio.toLocaleString("pt-BR")}`;

    try {
      const res = await fetch("/api/ocr-validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_id: ocrKey, doc_label: docLabel, doc_url: url, proposal_context: ctx }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao validar");
      setOcrResultados(prev => ({ ...prev, [ocrKey]: json.resultado }));
      setOcrStatus(prev => ({ ...prev, [ocrKey]: "done" }));
      // Persiste resultado no metadata para não perder ao recarregar
      const newMeta = { ...(proposal.metadata ?? {}), ocr_resultados: { ...(proposal.metadata?.ocr_resultados as Record<string, unknown> ?? {}), [ocrKey]: json.resultado } };
      onProposalUpdate?.(proposal.id, { metadata: newMeta as typeof proposal.metadata });
      fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, metadata: newMeta }),
      }).catch(() => {});
    } catch (e: unknown) {
      setOcrErros(prev => ({ ...prev, [ocrKey]: e instanceof Error ? e.message : "Erro desconhecido" }));
      setOcrStatus(prev => ({ ...prev, [ocrKey]: "error" }));
    }
  }

  async function handleOcrValidarTodos() {
    if (!proposal) return;
    const docsComArquivo = Object.entries(uploadedFiles).filter(([, files]) => files.some(f => f.url));
    if (docsComArquivo.length === 0) return;
    setOcrValidandoTodos(true);
    // Pega labels dos docs do checklist
    const meta = proposal.metadata ?? {};
    const clientType = ((meta.client_type ?? proposal.client_type) === "PJ" ? "PJ" : "PF") as "PF" | "PJ";
    const docs = portfolioDocs[proposal.credit_line?.toLowerCase()]?.[clientType] ?? CHECKLISTS[proposal.credit_line]?.[clientType] ?? DEFAULT_CHECKLIST[clientType];
    const labelMap: Record<string, string> = {};
    docs.forEach(d => { labelMap[d.id] = d.label; });
    // Processa TODOS os arquivos de cada documento (não apenas o primeiro)
    for (const [docId, files] of docsComArquivo) {
      const label = labelMap[docId] ?? docId;
      for (const file of files) {
        if (!file.url) continue;
        const ocrKey = `${docId}::${file.key}`;
        if (ocrStatus[ocrKey] === "done") continue; // já validado, pula
        await handleOcrValidar(docId, label, file.url, file.key);
      }
    }
    setOcrValidandoTodos(false);
  }

  async function handleOcrBatch() {
    if (!proposal) return;
    setOcrBatchLoading(true);
    setOcrBatchProgress("Iniciando análise OCR de todos os documentos...");
    try {
      const res = await fetch("/api/credit-proposals/ocr-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao processar OCR em lote");

      // Atualiza resultados OCR no estado local
      if (Array.isArray(json.ocr_results)) {
        const byDocId: Record<string, OcrResultado> = {};
        for (const r of json.ocr_results as OcrResultado[]) {
          byDocId[r.doc_id] = r;
          setOcrStatus(prev => ({ ...prev, [r.doc_id]: "done" }));
        }
        setOcrResultados(prev => ({ ...prev, ...byDocId }));
      }

      // Atualiza análise IA com o resultado automático
      if (json.ai_analysis) {
        setAnaliseData(json.ai_analysis);
        setAnalisePdfB64(null);
        setAnaliseStatus("done");
        onProposalUpdate?.(proposal.id, {
          metadata: { ...(proposal.metadata ?? {}), ai_analysis: json.ai_analysis, ocr_results: json.ocr_results } as typeof proposal.metadata,
        });
      } else {
        onProposalUpdate?.(proposal.id, {
          metadata: { ...(proposal.metadata ?? {}), ocr_results: json.ocr_results } as typeof proposal.metadata,
        });
      }

      setOcrBatchProgress("");
      // Navega automaticamente para aba de Análise IA
      setModalTab("analise_ia");
    } catch (e) {
      setOcrBatchProgress(`Erro: ${e instanceof Error ? e.message : "Falha ao processar"}`);
    } finally {
      setOcrBatchLoading(false);
    }
  }

  async function handleSolicitarCorrecao() {
    if (!proposal || !solicitarDoc) return;
    setSolicitandoCorrecao(true);
    try {
      const res = await fetch("/api/ocr-solicitar-correcao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal_id: proposal.id,
          proposal_code: proposal.code,
          proposal_title: proposal.title,
          partner_id: proposal.partner_id,
          doc_label: solicitarDoc.docLabel,
          motivo: solicitarDoc.motivo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao enviar");
      setCorrecaoEnviada(solicitarDoc.docId);
      setSolicitarDoc(null);
      // Atualiza stage localmente para PENDENCIA
      onProposalUpdate?.(proposal.id, { stage: "PENDENCIA" });
      setTimeout(() => setCorrecaoEnviada(null), 5000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erro ao solicitar correção");
    } finally {
      setSolicitandoCorrecao(false);
    }
  }

  async function compileDocuments() {
    if (!proposal) return;
    setCompileLoading(true);
    setShowCompile(true);
    try {
      const res = await fetch(`/api/credit-proposals/documents?proposal_id=${proposal.id}`);
      const { documents } = await res.json();
      setCompileDocs(Array.isArray(documents) ? documents : []);
    } catch {
      setCompileDocs([]);
    } finally {
      setCompileLoading(false);
    }
  }

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  function copyAllLinks() {
    const text = compileDocs
      .filter((d) => d.url)
      .map((d) => `${d.file_name}: ${d.url}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId("__all__");
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  // ── Mesa Comments state ───────────────────────────────────────────────────
  const [mesaComments, setMesaComments] = useState<MesaComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  // ── Edit proposal state ───────────────────────────────────────────────────
  const [showEdit, setShowEdit] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editClientType, setEditClientType] = useState<"PF"|"PJ">("PF");
  const [editNome, setEditNome] = useState("");
  const [editCpfCnpj, setEditCpfCnpj] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editRg, setEditRg] = useState("");
  const [editNascimento, setEditNascimento] = useState("");
  const [editEstadoCivil, setEditEstadoCivil] = useState("");
  const [editRenda, setEditRenda] = useState("");
  const [editRazaoSocial, setEditRazaoSocial] = useState("");
  const [editNomeFantasia, setEditNomeFantasia] = useState("");
  const [editSocioResp, setEditSocioResp] = useState("");
  const [editFaturamento, setEditFaturamento] = useState("");
  const [editEndRua, setEditEndRua] = useState("");
  const [editEndCidade, setEditEndCidade] = useState("");
  const [editEndUf, setEditEndUf] = useState("");
  const [editEndCep, setEditEndCep] = useState("");
  const [editRestricao, setEditRestricao] = useState<""|"SIM"|"NAO">("");
  const [editPrazo, setEditPrazo] = useState("");
  const [editFinalidade, setEditFinalidade] = useState("");
  const [editObservacoes, setEditObservacoes] = useState("");

  // ── Contrato ──────────────────────────────────────────────────────────────
  const [sendingContrato, setSendingContrato] = useState(false);
  const [contratoStatus, setContratoStatus] = useState<"idle" | "sent" | "error">("idle");
  const [contratoMsg, setContratoMsg] = useState("");
  const [contratoInfo, setContratoInfo] = useState<{
    status: string; token: string; signed_at?: string | null;
    v3_signed_at?: string | null; v3_signer_name?: string | null;
    contrato_url?: string | null;
  } | null>(null);
  const [reenviando, setReenviando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [contratoAcaoMsg, setContratoAcaoMsg] = useState("");

  useEffect(() => {
    if (!proposal?.id || !open) return;
    fetch(`/api/contratos/status?proposal_id=${proposal.id}`)
      .then(r => r.json())
      .then(({ contrato }) => setContratoInfo(contrato ?? null))
      .catch(() => {});
  }, [proposal?.id, open]);

  async function handleReenviarContrato() {
    if (!proposal) return;
    setReenviando(true);
    setContratoAcaoMsg("");
    try {
      const res = await fetch("/api/contratos/reenviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setContratoAcaoMsg(`Erro: ${json.error ?? "não foi possível reenviar"}`);
      } else {
        setContratoAcaoMsg(`✅ Link reenviado para ${json.reenviado_para ?? "o destinatário"}`);
      }
    } catch {
      setContratoAcaoMsg("Erro de conexão. Tente novamente.");
    } finally {
      setReenviando(false);
    }
  }

  async function handleCancelarContrato() {
    if (!proposal) return;
    if (!confirm("Cancelar este contrato? O link de assinatura deixará de funcionar.")) return;
    setCancelando(true);
    setContratoAcaoMsg("");
    try {
      const res = await fetch("/api/contratos/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setContratoAcaoMsg(`Erro: ${json.error ?? "não foi possível cancelar"}`);
      } else {
        setContratoAcaoMsg("Contrato cancelado.");
        setContratoInfo(prev => prev ? { ...prev, status: "CANCELADO" } : prev);
      }
    } catch {
      setContratoAcaoMsg("Erro de conexão. Tente novamente.");
    } finally {
      setCancelando(false);
    }
  }

  async function handleEnviarContrato() {
    if (!proposal) return;
    setSendingContrato(true);
    setContratoStatus("idle");
    setContratoMsg("");
    try {
      const res = await fetch("/api/contratos/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setContratoStatus("error");
        setContratoMsg(json.error ?? "Erro ao enviar contrato.");
      } else {
        setContratoStatus("sent");
        setContratoMsg(`Contrato enviado para ${proposal.email ?? "o cliente"}!`);
      }
    } catch {
      setContratoStatus("error");
      setContratoMsg("Erro de conexão. Tente novamente.");
    } finally {
      setSendingContrato(false);
    }
  }

  // ── Valor Médio inline edit ───────────────────────────────────────────────
  const [editingVmIdx, setEditingVmIdx] = useState<number | null>(null);
  const [vmEditValue, setVmEditValue] = useState("");
  const [vmSaving, setVmSaving] = useState(false);

  function applyBRLMask(raw: string): string {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return (parseInt(digits, 10) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function startEditVm(idx: number, current: number | undefined) {
    setVmEditValue(current ? current.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
    setEditingVmIdx(idx);
  }

  async function saveVm(idx: number) {
    if (!proposal) return;
    setVmSaving(true);
    const parsed = parseFloat(vmEditValue.replace(/\./g, "").replace(",", ".")) || 0;
    const meta = { ...(proposal.metadata ?? {}) };
    const imoveis: ImovelMeta[] = Array.isArray(meta.imoveis) ? meta.imoveis.map((im: ImovelMeta, i: number) =>
      i === idx ? { ...im, valor_medio: parsed || undefined } : im
    ) : [];
    meta.imoveis = imoveis;
    try {
      const res = await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, metadata: meta }),
      });
      if (res.ok) {
        setEditingVmIdx(null);
        onProposalUpdate?.(proposal.id, { metadata: meta as ProposalMeta });
      } else {
        alert("Erro ao salvar valor médio.");
      }
    } catch {
      alert("Erro de conexão.");
    } finally {
      setVmSaving(false);
    }
  }

  function startEdit() {
    if (!proposal) return;
    const meta = proposal.metadata ?? {};
    const ct = (meta.client_type ?? proposal.client_type ?? "PF") as "PF" | "PJ";
    setEditClientType(ct);
    setEditNome(proposal.client_name ?? "");
    setEditCpfCnpj(proposal.client_cpf_cnpj ?? proposal.cpf_cnpj ?? "");
    setEditEmail((meta.email ?? proposal.email ?? "") as string);
    setEditTelefone((meta.telefone ?? proposal.telefone ?? "") as string);
    setEditRg((meta.rg ?? "") as string);
    setEditNascimento((meta.nascimento ?? "") as string);
    setEditEstadoCivil((meta.estado_civil ?? meta.estadoCivil ?? "") as string);
    const rm = meta.renda_mensal ?? meta.renda;
    setEditRenda(rm ? String(rm) : "");
    setEditRazaoSocial((meta.razao_social ?? meta.razaoSocial ?? "") as string);
    setEditNomeFantasia((meta.nome_fantasia ?? meta.nomeFantasia ?? "") as string);
    setEditSocioResp((meta.socio_responsavel ?? meta.socioResponsavel ?? "") as string);
    const fm = meta.faturamento_mensal ?? meta.faturamento;
    setEditFaturamento(fm ? String(fm) : "");
    setEditEndRua((meta.endereco_rua ?? meta.enderecoRua ?? "") as string);
    setEditEndCidade((meta.endereco_cidade ?? meta.cidade ?? meta.city ?? "") as string);
    setEditEndUf((meta.endereco_uf ?? meta.estado ?? meta.state ?? "") as string);
    setEditEndCep((meta.endereco_cep ?? meta.cep ?? "") as string);
    setEditRestricao((meta.restricao_cliente ?? meta.restricao ?? "") as "" | "SIM" | "NAO");
    setEditPrazo((meta.prazo ?? proposal.prazo ?? "") as string);
    setEditFinalidade((meta.finalidade ?? proposal.finalidade ?? "") as string);
    setEditObservacoes((meta.observacoes ?? "") as string);
    setShowEdit(true);
  }

  async function handleSaveEdit() {
    if (!proposal) return;
    setEditSaving(true);
    const newMeta: Record<string, unknown> = {
      ...proposal.metadata,
      client_type: editClientType,
      email: editEmail || undefined,
      telefone: editTelefone || undefined,
      prazo: editPrazo || undefined,
      finalidade: editFinalidade || undefined,
      restricao_cliente: editRestricao || undefined,
      observacoes: editObservacoes || undefined,
      rg: editRg || undefined,
      nascimento: editNascimento || undefined,
      estado_civil: editEstadoCivil || undefined,
      renda_mensal: editRenda ? parseFloat(editRenda) || undefined : undefined,
      razao_social: editRazaoSocial || undefined,
      nome_fantasia: editNomeFantasia || undefined,
      socio_responsavel: editSocioResp || undefined,
      faturamento_mensal: editFaturamento ? parseFloat(editFaturamento) || undefined : undefined,
      endereco_rua: editEndRua || undefined,
      endereco_cidade: editEndCidade || undefined,
      endereco_uf: editEndUf || undefined,
      endereco_cep: editEndCep || undefined,
    };
    try {
      const clientName = editClientType === "PF" ? editNome : (editRazaoSocial || editNome);
      const res = await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: proposal.id,
          client_name: clientName || undefined,
          client_cpf_cnpj: editCpfCnpj || undefined,
          metadata: newMeta,
        }),
      });
      if (res.ok) {
        setShowEdit(false);
        onProposalUpdate?.(proposal.id, {
          client_name: clientName || proposal.client_name,
          cpf_cnpj: editCpfCnpj || proposal.cpf_cnpj,
          metadata: newMeta as ProposalMeta,
        });
      } else {
        const json = await res.json().catch(() => ({}));
        alert(typeof json.error === "string" ? json.error : "Erro ao salvar alterações.");
      }
    } catch {
      alert("Erro de conexão ao salvar alterações.");
    } finally {
      setEditSaving(false);
    }
  }

  // ── Commission state ──────────────────────────────────────────────────────
  const [valorCredito, setValorCredito] = useState(0);
  const [valorCreditoEdit, setValorCreditoEdit] = useState("");
  const [editandoValor, setEditandoValor] = useState(false);
  const [percMandato, setPercMandato] = useState(6);
  const [percMandatoEdit, setPercMandatoEdit] = useState("6");
  const [editandoMandato, setEditandoMandato] = useState(false);
  const [percInstituicao, setPercInstituicao] = useState(0);
  const [percInstituicaoEdit, setPercInstituicaoEdit] = useState("0");
  const [editandoInstituicao, setEditandoInstituicao] = useState(false);
  const [valorSolicitado, setValorSolicitado] = useState(0);
  const [valorSolicitadoEdit, setValorSolicitadoEdit] = useState("");
  const [editandoValorSolicitado, setEditandoValorSolicitado] = useState(false);

  // ── Escavador state ──────────────────────────────────────────────────────
  const [escavadorLoading, setEscavadorLoading] = useState(false);
  const [escavadorResult, setEscavadorResult] = useState<EscavadorResult | null>(null);
  const [showEscavador, setShowEscavador] = useState(false);

  async function consultarEscavador() {
    if (!proposal) return;
    const cpfCnpj = proposal.cpf_cnpj?.replace(/\D/g, "");
    const nome = proposal.client_name;
    const tipo = cpfCnpj ? (cpfCnpj.length === 11 ? "cpf" : "cnpj") : "nome";
    const valor = cpfCnpj || nome;
    setEscavadorLoading(true);
    setEscavadorResult(null);
    setShowEscavador(true);
    try {
      const res = await fetch("/api/kyc/escavador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, valor }),
      });
      const json = await res.json();
      setEscavadorResult(json);
    } catch {
      setEscavadorResult({ total_processos: 0, match_tipo: null, processos: [], error: "Erro de comunicação com Escavador." });
    } finally {
      setEscavadorLoading(false);
    }
  }

  // Sync state when proposal changes
  useEffect(() => {
    if (!proposal) return;
    setShowEdit(false);
    setEscavadorResult(null);
    setShowEscavador(false);
    const vc = proposal.valor_credito_atual ?? proposal.requested_value;
    setValorCredito(vc);
    setValorCreditoEdit(String(vc));
    const pm = proposal.comissao_mandato_perc ?? 6;
    setPercMandato(pm);
    setPercMandatoEdit(String(pm));
    const pi = proposal.comissao_instituicao_perc ?? 0;
    setPercInstituicao(pi);
    setPercInstituicaoEdit(String(pi));
    setEditandoValor(false);
    setEditandoMandato(false);
    setEditandoInstituicao(false);
    setValorSolicitado(proposal.requested_value ?? 0);
    setValorSolicitadoEdit(String(proposal.requested_value ?? 0));
    setEditandoValorSolicitado(false);
  }, [proposal?.id, open]);

  if (!open || !proposal) return null;

  // ── Calculations ──────────────────────────────────────────────────────────
  const comissaoMandato = valorCredito * (percMandato / 100);
  const comissaoInstituicao = valorCredito * (percInstituicao / 100);
  const totalComissao = comissaoMandato + comissaoInstituicao;
  const comissaoLicenciado = totalComissao * ((50 - TAXA_IMPOSTOS_COMISSAO) / 100);

  function persistPatch(updates: Record<string, unknown>) {
    fetch("/api/credit-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposal!.id, ...updates }),
    }).catch(() => {});
  }

  function salvarValorCredito() {
    const v = parseFloat(valorCreditoEdit.replace(",", "."));
    if (isNaN(v) || v <= 0) return;
    setValorCredito(v);
    setEditandoValor(false);
    onProposalUpdate?.(proposal!.id, { valor_credito_atual: v });
    persistPatch({ valor_credito_atual: v });
  }

  function salvarMandato() {
    const v = parseFloat(percMandatoEdit.replace(",", "."));
    if (isNaN(v) || v < 0) return;
    setPercMandato(v);
    setEditandoMandato(false);
    onProposalUpdate?.(proposal!.id, { comissao_mandato_perc: v });
    persistPatch({ comissao_mandato_perc: v });
  }

  function salvarInstituicao() {
    const v = parseFloat(percInstituicaoEdit.replace(",", "."));
    if (isNaN(v) || v < 0) return;
    setPercInstituicao(v);
    setEditandoInstituicao(false);
    onProposalUpdate?.(proposal!.id, { comissao_instituicao_perc: v });
    persistPatch({ comissao_instituicao_perc: v });
  }

  function salvarValorSolicitado() {
    const v = parseFloat(valorSolicitadoEdit.replace(",", "."));
    if (isNaN(v) || v <= 0) return;
    setValorSolicitado(v);
    setEditandoValorSolicitado(false);
    onProposalUpdate?.(proposal!.id, { requested_value: v });
    persistPatch({ requested_value: v });
  }

  async function handleAddComment() {
    if (!proposal || !newComment.trim() || savingComment) return;
    setSavingComment(true);
    try {
      const res = await fetch("/api/credit-proposals/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id, text: newComment.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.comment) {
        setMesaComments((prev) => [...prev, json.comment]);
        setNewComment("");
      }
    } finally {
      setSavingComment(false);
    }
  }

  const currentStageIdx = PIPELINE_STAGES.findIndex((s) => s.key === (proposal.stage ?? "RECEBIDO"));
  const activeIdx = currentStageIdx >= 0 ? currentStageIdx : 0;

  function handleExportPDF() {
    if (!proposal) return;
    const meta = proposal.metadata ?? {};
    const clientType = (meta.client_type ?? meta.personType ?? proposal.client_type ?? "PF") as string;
    const email     = (meta.email ?? proposal.email ?? "") as string;
    const telefone  = (meta.telefone ?? meta.phone ?? proposal.telefone ?? "") as string;
    const stageName = PIPELINE_STAGES.find(s => s.key === (proposal.stage ?? "RECEBIDO"))?.label ?? "Recebido";
    const cpfCnpj   = proposal.client_cpf_cnpj ?? (meta.cpf ?? meta.cnpj ?? "") as string;

    const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("pt-BR") : "-";
    const fmtNum  = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/\D/g, "")); return isNaN(n) || n === 0 ? "" : fmt(n); };

    const comments = (mesaComments.length > 0 ? mesaComments : (proposal.mesa_comments ?? []));

    // Instituições encaminhadas (parse JSON ou string legada)
    let instsList: string[] = [];
    const instRaw = proposal.instituicao_encaminhada ?? "";
    if (instRaw) {
      try { const arr = JSON.parse(instRaw); instsList = Array.isArray(arr) ? arr : [instRaw]; }
      catch { instsList = [instRaw]; }
    }

    const levelLabels: Record<string, string> = { NIVEL_1: "Nível 1 — Varejo", NIVEL_2: "Nível 2 — Estruturado", NIVEL_3: "Nível 3 — High Ticket" };
    const statusLabels: Record<string, string> = { PENDING: "Pendente", IN_REVIEW: "Em Análise", APPROVED: "Aprovado", REJECTED: "Reprovado", COMPLETED: "Concluído", CANCELLED: "Cancelado" };

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Proposta ${proposal.code}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a2e; background: #fff; }
  .header { background: linear-gradient(135deg, #09081A 0%, #111F35 100%); color: #F0ECE4; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 20px; font-weight: 700; color: #C9A84C; }
  .header .sub { font-size: 11px; color: #7A8FA8; margin-top: 2px; }
  .header .code { font-size: 13px; font-weight: 600; color: #E8C97A; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 10px; font-weight: 700; background: #C9A84C20; color: #C9A84C; border: 1px solid #C9A84C40; margin-left: 8px; }
  .content { padding: 24px 32px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #7A8FA8; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px 16px; }
  .field label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #9ca3af; display: block; }
  .field span { font-size: 12px; color: #1a1a2e; font-weight: 500; }
  .highlight { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; }
  .highlight label { color: #166534; }
  .highlight span { color: #15803d; font-size: 16px; font-weight: 700; }
  .pipeline { display: flex; align-items: center; gap: 0; margin: 8px 0; }
  .stage-item { text-align: center; flex: 1; }
  .stage-dot { width: 24px; height: 24px; border-radius: 50%; border: 2px solid #d1d5db; background: #f9fafb; margin: 0 auto 4px; display: flex; align-items: center; justify-content: center; font-size: 10px; }
  .stage-dot.done { background: #10b981; border-color: #10b981; color: white; }
  .stage-dot.active { background: #C9A84C20; border-color: #C9A84C; color: #C9A84C; font-weight: 700; }
  .stage-label { font-size: 9px; color: #6b7280; }
  .stage-label.active { color: #C9A84C; font-weight: 700; }
  .stage-label.done { color: #10b981; }
  .stage-line { flex: 1; height: 2px; background: #d1d5db; margin-bottom: 16px; }
  .stage-line.done { background: #10b981; }
  .comment { background: #f9fafb; border-left: 3px solid #C9A84C; padding: 8px 12px; margin-bottom: 8px; border-radius: 0 6px 6px 0; }
  .comment .author { font-size: 10px; font-weight: 700; color: #374151; }
  .comment .date { font-size: 9px; color: #9ca3af; margin-left: 6px; }
  .comment .text { font-size: 11px; color: #4b5563; margin-top: 4px; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 9px; color: #9ca3af; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="code">${proposal.code} <span class="badge">${stageName}</span></div>
    <h1>${proposal.title}</h1>
    <div class="sub">${proposal.credit_line} · Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;color:#7A8FA8;">V3 Partners</div>
    <div style="font-size:10px;color:#C9A84C;">Plataforma Institucional</div>
  </div>
</div>
<div class="content">

  <!-- Pipeline -->
  <div class="section">
    <div class="section-title">Etapas da Proposta</div>
    <div class="pipeline">
      ${PIPELINE_STAGES.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        const line = i < PIPELINE_STAGES.length - 1;
        return `<div class="stage-item">
          <div class="stage-dot ${done ? "done" : active ? "active" : ""}">${done ? "✓" : i + 1}</div>
          <div class="stage-label ${done ? "done" : active ? "active" : ""}">${s.label}</div>
        </div>${line ? `<div class="stage-line ${done ? "done" : ""}"></div>` : ""}`;
      }).join("")}
    </div>
  </div>

  <!-- Dados Financeiros -->
  <div class="section">
    <div class="section-title">Dados Financeiros</div>
    <div class="grid-3">
      <div class="field highlight">
        <label>Valor Solicitado</label>
        <span>${fmt(valorSolicitado)}</span>
      </div>
      <div class="field">
        <label>Valor de Crédito</label>
        <span>${fmt(valorCredito)}</span>
      </div>
      <div class="field">
        <label>Linha de Crédito</label>
        <span>${proposal.credit_line}</span>
      </div>
      ${proposal.prazo ? `<div class="field"><label>Prazo</label><span>${proposal.prazo}</span></div>` : ""}
      ${proposal.finalidade ? `<div class="field"><label>Finalidade</label><span>${proposal.finalidade}</span></div>` : ""}
      <div class="field"><label>Data de Criação</label><span>${fmtDate(proposal.created_at)}</span></div>
    </div>
  </div>

  <!-- Cliente -->
  <div class="section">
    <div class="section-title">Dados do Cliente (${clientType})</div>
    <div class="grid">
      <div class="field"><label>Nome / Razão Social</label><span>${proposal.client_name}</span></div>
      ${cpfCnpj ? `<div class="field"><label>${clientType === "PJ" ? "CNPJ" : "CPF"}</label><span>${cpfCnpj}</span></div>` : ""}
      ${email ? `<div class="field"><label>E-mail</label><span>${email}</span></div>` : ""}
      ${telefone ? `<div class="field"><label>Telefone</label><span>${telefone}</span></div>` : ""}
      ${fmtNum(meta.renda_mensal ?? meta.renda) ? `<div class="field"><label>Renda Mensal</label><span>${fmtNum(meta.renda_mensal ?? meta.renda)}</span></div>` : ""}
      ${fmtNum(meta.faturamento_mensal ?? meta.faturamento) ? `<div class="field"><label>Faturamento Mensal</label><span>${fmtNum(meta.faturamento_mensal ?? meta.faturamento)}</span></div>` : ""}
      ${meta.cep ? `<div class="field"><label>CEP</label><span>${meta.cep}</span></div>` : ""}
      ${meta.endereco ? `<div class="field"><label>Endereço</label><span>${meta.endereco}${meta.numero ? `, ${meta.numero}` : ""}${meta.complemento ? ` ${meta.complemento}` : ""}</span></div>` : ""}
      ${meta.bairro ? `<div class="field"><label>Bairro</label><span>${meta.bairro}</span></div>` : ""}
      ${(meta.cidade || meta.estado) ? `<div class="field"><label>Cidade / Estado</label><span>${[meta.cidade, meta.estado].filter(Boolean).join(" / ")}</span></div>` : ""}
    </div>
  </div>

  ${(proposal.imovel_endereco || proposal.imovel_valor_medio) ? `
  <!-- Imóvel -->
  <div class="section">
    <div class="section-title">Dados do Imóvel (Garantia)</div>
    <div class="grid">
      ${proposal.imovel_endereco ? `<div class="field"><label>Endereço</label><span>${proposal.imovel_endereco}</span></div>` : ""}
      ${(proposal.imovel_cidade || proposal.imovel_estado) ? `<div class="field"><label>Cidade / Estado</label><span>${[proposal.imovel_cidade, proposal.imovel_estado].filter(Boolean).join(" / ")}</span></div>` : ""}
      ${proposal.imovel_valor_medio ? `<div class="field"><label>Valor Estimado</label><span>${fmt(proposal.imovel_valor_medio)}</span></div>` : ""}
    </div>
  </div>` : ""}

  ${(meta.observacoes || meta.notes) ? `
  <!-- Observações -->
  <div class="section">
    <div class="section-title">Observações</div>
    <p style="font-size:12px;color:#374151;line-height:1.6;">${meta.observacoes ?? meta.notes}</p>
  </div>` : ""}

  ${proposal.partner_name ? `
  <!-- Parceiro -->
  <div class="section">
    <div class="section-title">Parceiro Responsável</div>
    <div class="field"><label>Nome</label><span>${proposal.partner_name}</span></div>
  </div>` : ""}

  <!-- Status e Nível -->
  <div class="section">
    <div class="section-title">Status da Proposta</div>
    <div class="grid-3">
      <div class="field"><label>Status</label><span>${statusLabels[proposal.status] ?? proposal.status}</span></div>
      <div class="field"><label>Nível</label><span>${levelLabels[proposal.current_level] ?? proposal.current_level}</span></div>
      <div class="field"><label>Etapa</label><span>${stageName}</span></div>
    </div>
  </div>

  ${(proposal.level1_notes || proposal.level2_notes || proposal.level3_notes) ? `
  <!-- Notas por Nível -->
  <div class="section">
    <div class="section-title">Análise por Nível</div>
    ${proposal.level1_notes ? `<div style="margin-bottom:8px;"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Nível 1${proposal.level1_at ? ` — ${fmtDate(proposal.level1_at)}` : ""}</div><p style="font-size:12px;color:#374151;">${proposal.level1_notes}</p></div>` : ""}
    ${proposal.level2_notes ? `<div style="margin-bottom:8px;"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Nível 2${proposal.level2_at ? ` — ${fmtDate(proposal.level2_at)}` : ""}</div><p style="font-size:12px;color:#374151;">${proposal.level2_notes}</p></div>` : ""}
    ${proposal.level3_notes ? `<div style="margin-bottom:8px;"><div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#9ca3af;margin-bottom:4px;">Nível 3${proposal.level3_at ? ` — ${fmtDate(proposal.level3_at)}` : ""}</div><p style="font-size:12px;color:#374151;">${proposal.level3_notes}</p></div>` : ""}
  </div>` : ""}

  ${instsList.length > 0 ? `
  <!-- Instituições Encaminhadas -->
  <div class="section">
    <div class="section-title">Instituições Encaminhadas</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${instsList.map(i => `<span style="display:inline-block;padding:4px 12px;border-radius:20px;background:#C9A84C20;border:1px solid #C9A84C40;color:#C9A84C;font-size:11px;font-weight:700;">${i}</span>`).join("")}
    </div>
  </div>` : ""}

  ${(percMandato > 0 || percInstituicao > 0) ? `
  <!-- Comissões -->
  <div class="section">
    <div class="section-title">Estrutura de Comissões</div>
    <div class="grid-3">
      <div class="field"><label>Comissão Mandato</label><span>${percMandato.toFixed(2)}% — ${fmt(comissaoMandato)}</span></div>
      <div class="field"><label>Comissão Instituição</label><span>${percInstituicao.toFixed(2)}% — ${fmt(comissaoInstituicao)}</span></div>
      <div class="field"><label>Total Comissão</label><span>${fmt(totalComissao)}</span></div>
    </div>
  </div>` : ""}

  ${comments.length > 0 ? `
  <!-- Comentários Mesa -->
  <div class="section">
    <div class="section-title">Notas da Mesa de Crédito</div>
    ${comments.map(c => `
    <div class="comment">
      <div><span class="author">${c.author}</span><span class="date">${fmtDate(c.created_at)}</span></div>
      <div class="text">${c.text}</div>
    </div>`).join("")}
  </div>` : ""}

</div>
<div class="footer">
  V3 Partners · CNPJ 14.219.287/0001-50 · v3partners.com.br · Documento gerado automaticamente pela plataforma institucional
</div>
<script>window.onload = () => window.print();</script>
</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  }

  function advance() {
    if (!proposal || activeIdx >= PIPELINE_STAGES.length - 1) return;
    onStageChange?.(proposal.id, PIPELINE_STAGES[activeIdx + 1].key);
  }

  function goBack() {
    if (!proposal || activeIdx <= 0) return;
    onStageChange?.(proposal.id, PIPELINE_STAGES[activeIdx - 1].key);
  }

  const isFinished = activeIdx === PIPELINE_STAGES.length - 1;
  const nextStage = !isFinished ? PIPELINE_STAGES[activeIdx + 1] : null;
  const prevStage = activeIdx > 0 ? PIPELINE_STAGES[activeIdx - 1] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fade-in">
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
          <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
            <button
              onClick={handleExportPDF}
              title="Exportar PDF"
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-colors text-xs font-semibold">
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
            <CopyClientLinkButton proposalId={proposal.id} />
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6 gap-1">
          {([
            { id: "detalhes",      label: "Detalhes" },
            { id: "recomendacao",  label: "✦ Recomendação" },
            { id: "documentos",    label: "Documentos" },
            { id: "comentarios",   label: "Comentários" },
            { id: "analise_ia",    label: "🧠 Análise IA" },
          ] as { id: ModalTab; label: string }[]).map(t => (
            <button key={t.id} onClick={() => setModalTab(t.id)}
              className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                modalTab === t.id
                  ? "border-[#C9A84C] text-[#C9A84C]"
                  : "border-transparent text-muted-foreground hover:text-white"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* ── Seção Detalhes e Recomendação ── */}
          <div className={modalTab === "documentos" || modalTab === "comentarios" || modalTab === "analise_ia" ? "hidden" : "contents"}>

          {/* ── Banner de Pendência de Stage ── visível quando stage = PENDENCIA */}
          {proposal.stage === "PENDENCIA" && (
            <PendingBanner
              proposal={proposal}
              canChangeStage={!!canChangeStage}
              onProposalUpdate={onProposalUpdate}
              onStageChange={onStageChange}
            />
          )}

          {/* ── Banner de Pendências OCR ── visível para todos */}
          {(() => {
            const pendencias = proposal.metadata?.pendencias_ocr as Record<string, { doc_label: string; motivo: string; status: string; created_at: string; corrigido_at: string | null }> | undefined;
            if (!pendencias) return null;
            const pendentes = Object.entries(pendencias).filter(([, p]) => p.status === "pendente");
            if (pendentes.length === 0) return null;
            return (
              <div className="rounded-xl border border-orange-500/40 bg-orange-500/8 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-orange-500/20">
                  <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  <p className="text-xs font-bold text-orange-400 flex-1">
                    {pendentes.length} documento(s) com pendência de correção
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400">PENDÊNCIA</span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {pendentes.map(([docKey, p]) => (
                    <div key={docKey} className="flex items-start gap-3 p-3 rounded-lg bg-[#09081A] border border-orange-500/20">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white mb-0.5">📎 {p.doc_label}</p>
                        <p className="text-[11px] text-orange-300/80 leading-relaxed">{p.motivo}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          Solicitado em {new Date(p.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      {/* Botão Correção Feita — partner */}
                      {!canChangeStage && (
                        <CorrecaoFeitaBtn
                          proposalId={proposal.id}
                          proposalCode={proposal.code}
                          docKey={docKey}
                          docLabel={p.doc_label}
                          onCorrigido={(novoStage) => {
                            const newMeta = { ...proposal.metadata };
                            const pends = { ...(newMeta.pendencias_ocr as Record<string, unknown> ?? {}) };
                            pends[docKey] = { ...p, status: "corrigido", corrigido_at: new Date().toISOString() };
                            newMeta.pendencias_ocr = pends;
                            onProposalUpdate?.(proposal.id, { metadata: newMeta as typeof proposal.metadata, stage: novoStage });
                          }}
                        />
                      )}
                      {/* Botão Pendência Resolvida — mesa operacional/admin */}
                      {canChangeStage && (
                        <CorrecaoFeitaBtn
                          proposalId={proposal.id}
                          proposalCode={proposal.code}
                          docKey={docKey}
                          docLabel={p.doc_label}
                          onCorrigido={(novoStage) => {
                            const newMeta = { ...proposal.metadata };
                            const pends = { ...(newMeta.pendencias_ocr as Record<string, unknown> ?? {}) };
                            pends[docKey] = { ...p, status: "corrigido", corrigido_at: new Date().toISOString() };
                            newMeta.pendencias_ocr = pends;
                            // Mesa não retrocede stage automaticamente — apenas marca como resolvido
                            onProposalUpdate?.(proposal.id, { metadata: newMeta as typeof proposal.metadata });
                          }}
                          labelOverride="Pendência Resolvida"
                        />
                      )}
                    </div>
                  ))}
                  {!canChangeStage && (
                    <p className="text-[10px] text-muted-foreground/60">
                      Após clicar em "Correção Feita", a mesa será notificada e a proposta voltará para Triagem automaticamente.
                    </p>
                  )}
                  {canChangeStage && (
                    <p className="text-[10px] text-muted-foreground/60">
                      Clique em "Pendência Resolvida" para marcar o documento como corrigido e liberar o andamento da proposta.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

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
          {(() => {
            const meta = proposal.metadata ?? {};
            // Normaliza campos — suporta tanto snake_case (entrada manual) quanto camelCase (captação)
            const clientType = (meta.client_type ?? meta.personType ?? proposal.client_type ?? "PF") as "PF" | "PJ";
            const email     = (meta.email ?? proposal.email ?? "") as string;
            const telefone  = (meta.telefone ?? meta.phone ?? proposal.telefone ?? "") as string;
            const restricao = (meta.restricao_cliente ?? meta.restricao ?? "") as string;
            // PF
            const nascimento   = (meta.nascimento ?? "") as string;
            const estadoCivil  = (meta.estado_civil ?? meta.estadoCivil ?? "") as string;
            const rg           = (meta.rg ?? "") as string;
            const rendaRaw     = meta.renda_mensal ?? meta.renda;
            const rendaMensal  = rendaRaw ? parseFloat(String(rendaRaw).replace(/\D/g, "")) || 0 : 0;
            // PJ
            const razaoSocial      = (meta.razao_social ?? meta.razaoSocial ?? "") as string;
            const nomeFantasia     = (meta.nome_fantasia ?? meta.nomeFantasia ?? "") as string;
            const socioResponsavel = (meta.socio_responsavel ?? meta.socioResponsavel ?? "") as string;
            const fatRaw           = meta.faturamento_mensal ?? meta.faturamento;
            const faturamentoMensal = fatRaw ? parseFloat(String(fatRaw).replace(/\D/g, "")) || 0 : 0;
            // Endereço
            const endRua    = (meta.endereco_rua  ?? meta.endereco    ?? meta.enderecoRua ?? "") as string;
            const endCidade = (meta.endereco_cidade ?? meta.cidade    ?? meta.city        ?? "") as string;
            const endUF     = (meta.endereco_uf   ?? meta.estado      ?? meta.state       ?? "") as string;
            const endCep    = (meta.endereco_cep  ?? meta.cep         ?? "") as string;
            const temEndereco = !!(endRua || endCidade || endCep);
            return (
              <div className="space-y-3">
                {/* Header with Escavador + Edit buttons */}
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    {clientType === "PJ" ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    Dados do Cliente
                  </p>
                  <div className="flex items-center gap-1.5">
                    {canEditValorSolicitado && (
                      <button
                        onClick={startEdit}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all"
                      >
                        <Pencil className="w-3 h-3" /> Editar Proposta
                      </button>
                    )}
                  <button
                    onClick={consultarEscavador}
                    disabled={escavadorLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {escavadorLoading
                      ? <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      : <Search className="w-3 h-3" />}
                    {escavadorLoading ? "Consultando..." : "Consultar Processos Judiciais"}
                  </button>
                  </div>
                </div>

                {/* Client info card */}
                <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-2">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <InfoRow label="Nome" value={proposal.client_name} />
                    <InfoRow label="Tipo" value={clientType === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"} />
                    {(proposal.client_cpf_cnpj ?? proposal.cpf_cnpj) && <InfoRow label={clientType === "PJ" ? "CNPJ" : "CPF"} value={(proposal.client_cpf_cnpj ?? proposal.cpf_cnpj)!} />}
                    {email && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1"><Mail className="w-3 h-3" /> E-mail</span>
                        <span className="text-xs font-medium text-foreground text-right break-all">{email}</span>
                      </div>
                    )}
                    {telefone && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone</span>
                        <span className="text-xs font-medium text-foreground text-right">{telefone}</span>
                      </div>
                    )}
                    {/* Dados PF */}
                    {clientType === "PF" && nascimento    && <InfoRow label="Nascimento"  value={nascimento} />}
                    {clientType === "PF" && estadoCivil   && <InfoRow label="Estado Civil" value={estadoCivil} />}
                    {clientType === "PF" && rg            && <InfoRow label="RG"          value={rg} />}
                    {clientType === "PF" && rendaMensal > 0 && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1"><Banknote className="w-3 h-3" /> Renda Mensal</span>
                        <span className="text-xs font-semibold text-emerald-400">{formatCurrency(rendaMensal)}</span>
                      </div>
                    )}
                    {/* Dados PJ */}
                    {clientType === "PJ" && razaoSocial      && <InfoRow label="Razão Social"       value={razaoSocial} />}
                    {clientType === "PJ" && nomeFantasia     && <InfoRow label="Nome Fantasia"      value={nomeFantasia} />}
                    {clientType === "PJ" && socioResponsavel && <InfoRow label="Sócio Responsável"  value={socioResponsavel} />}
                    {clientType === "PJ" && faturamentoMensal > 0 && (
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1"><Banknote className="w-3 h-3" /> Faturamento Mensal</span>
                        <span className="text-xs font-semibold text-emerald-400">{formatCurrency(faturamentoMensal)}</span>
                      </div>
                    )}
                    {/* Endereço */}
                    {temEndereco && (
                      <div className="col-span-2 flex items-start gap-1.5 pt-1 border-t border-border/50">
                        <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-foreground">
                          {[endRua, endCidade, endUF].filter(Boolean).join(", ")}
                          {endCep && <span className="ml-1 text-muted-foreground">— CEP: {endCep}</span>}
                        </span>
                      </div>
                    )}
                    {restricao && (
                      <div className="col-span-2 flex items-center justify-between gap-2 pt-1 border-t border-border/50">
                        <span className="text-xs text-muted-foreground">Restrição cadastral</span>
                        <span className={`text-xs font-semibold ${restricao === "SIM" ? "text-red-400" : "text-emerald-400"}`}>
                          {restricao === "SIM" ? "Possui restrições" : "Sem restrições"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operação */}
                <div className="p-4 rounded-xl border border-border bg-secondary/20 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <CreditCard className="w-3.5 h-3.5" /> Operação
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <InfoRow label="Linha de Crédito" value={proposal.credit_line} highlight />
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-muted-foreground flex-shrink-0">Valor Solicitado</span>
                      {(canChangeStage || canEditValorSolicitado) && editandoValorSolicitado ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">R$</span>
                          <input type="number" value={valorSolicitadoEdit}
                            onChange={(e) => setValorSolicitadoEdit(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && salvarValorSolicitado()}
                            className="w-28 h-5 text-xs px-2 bg-secondary border border-primary/50 rounded text-white focus:outline-none" autoFocus />
                          <button onClick={salvarValorSolicitado} className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400">
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-medium text-foreground">{formatCurrency(valorSolicitado || proposal.requested_value)}</span>
                          {(canChangeStage || canEditValorSolicitado) && (
                            <button onClick={() => { setValorSolicitadoEdit(String(valorSolicitado || proposal.requested_value)); setEditandoValorSolicitado(true); }}
                              className="w-4 h-4 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-white" title="Editar">
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {proposal.approved_value && <InfoRow label="Valor Aprovado" value={formatCurrency(proposal.approved_value)} success />}
                    {(meta.prazo ?? proposal.prazo) && <InfoRow label="Prazo" value={(meta.prazo ?? proposal.prazo ?? "") as string} />}
                    {(meta.finalidade ?? proposal.finalidade) && <InfoRow label="Finalidade" value={(meta.finalidade ?? proposal.finalidade ?? "") as string} />}
                    {(meta.observacoes) && <InfoRow label="Observações" value={meta.observacoes as string} />}
                  </div>
                </div>

                {/* Instituições encaminhadas — apenas mesa/admin */}
                {canEditInstituicao && (
                  <div className="p-4 rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5 space-y-3">
                    <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5" /> Instituições Encaminhadas
                    </p>

                    {/* Chips das instituições já adicionadas */}
                    {instituicoesList.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {instituicoesList.map((inst, i) => (
                          <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#C9A84C]/15 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold">
                            <Building2 className="w-3 h-3 flex-shrink-0" />
                            {inst}
                            <button
                              onClick={() => setInstituicoesList(prev => prev.filter((_, j) => j !== i))}
                              className="ml-0.5 hover:text-red-400 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Adicionar nova instituição — selecionar já adiciona à lista */}
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val || val === "Outra") { setAddingInst(val); return; }
                        if (!instituicoesList.includes(val)) setInstituicoesList(prev => [...prev, val]);
                        setAddingInst("");
                      }}
                      className="w-full h-8 px-3 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                    >
                      <option value="">+ Selecionar instituição...</option>
                      {INSTITUICOES.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                    {addingInst === "Outra" && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={addingInstCustom}
                          onChange={(e) => setAddingInstCustom(e.target.value)}
                          placeholder="Nome da instituição"
                          className="flex-1 h-8 px-3 text-xs bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                        />
                        <button
                          onClick={handleAddInstituicao}
                          disabled={!addingInstCustom.trim()}
                          className="h-8 px-3 rounded-lg bg-[#C9A84C]/15 hover:bg-[#C9A84C]/25 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-bold disabled:opacity-50 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handleSaveInstituicao}
                      disabled={savingInstituicao || instituicoesList.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C]/15 hover:bg-[#C9A84C]/25 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      {savingInstituicao ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      {instituicaoSaved ? "Salvo!" : "Salvar"}
                    </button>
                    {instituicaoError && (
                      <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{instituicaoError}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Escavador Results ── */}
          {showEscavador && (
            <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" /> Processos Judiciais — Escavador
                </p>
                <button onClick={() => setShowEscavador(false)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>

              {escavadorLoading ? (
                <div className="flex items-center gap-2 py-3">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-muted-foreground">Consultando base de processos judiciais...</span>
                </div>
              ) : escavadorResult?.error ? (
                <div className="flex items-center gap-2 py-2 text-red-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs">{escavadorResult.error}</span>
                </div>
              ) : escavadorResult ? (
                <div className="space-y-3">
                  {/* Summary badge */}
                  <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                    escavadorResult.total_processos === 0
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : escavadorResult.total_processos <= 3
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}>
                    {escavadorResult.total_processos === 0
                      ? <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />}
                    <div>
                      <p className={`text-xs font-semibold ${
                        escavadorResult.total_processos === 0 ? "text-emerald-400"
                        : escavadorResult.total_processos <= 3 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {escavadorResult.total_processos === 0
                          ? "Nenhum processo judicial encontrado"
                          : `${escavadorResult.total_processos} processo(s) judicial(is) encontrado(s)`}
                      </p>
                      {escavadorResult.match_tipo && (
                        <p className="text-[10px] text-muted-foreground">Busca por: {escavadorResult.match_tipo}</p>
                      )}
                    </div>
                  </div>

                  {/* Process list */}
                  {escavadorResult.processos.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {escavadorResult.processos.map((p, i) => (
                        <div key={i} className="p-3 rounded-lg bg-secondary/40 border border-border space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-[10px] text-blue-400 font-semibold">{p.numero_cnj}</span>
                            {p.valor_causa && (
                              <span className="text-[10px] font-bold text-amber-300 flex-shrink-0">{formatCurrency(p.valor_causa)}</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                            {p.polo_ativo && <span>Ativo: <span className="text-foreground">{p.polo_ativo}</span></span>}
                            {p.polo_passivo && <span>Passivo: <span className="text-foreground">{p.polo_passivo}</span></span>}
                            {p.tribunal && <span>Tribunal: <span className="text-foreground">{p.tribunal}</span>{p.grau ? ` (${p.grau}º)` : ""}</span>}
                            {p.estado && <span>Estado: <span className="text-foreground">{p.estado}</span></span>}
                            {p.data_inicio && <span>Início: <span className="text-foreground">{new Date(p.data_inicio).toLocaleDateString("pt-BR")}</span></span>}
                            {p.data_ultima_movimentacao && <span>Última mov: <span className="text-foreground">{new Date(p.data_ultima_movimentacao).toLocaleDateString("pt-BR")}</span></span>}
                          </div>
                          {p.status && (
                            <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground uppercase tracking-wider">
                              {p.status}
                            </span>
                          )}
                        </div>
                      ))}
                      {escavadorResult.total_processos > escavadorResult.processos.length && (
                        <p className="text-[10px] text-muted-foreground text-center py-1">
                          Exibindo {escavadorResult.processos.length} de {escavadorResult.total_processos} processos
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* ── Imóveis em Garantia ── */}
          {(() => {
            const meta = proposal.metadata ?? {};
            const imoveis: ImovelMeta[] = (meta.imoveis && meta.imoveis.length > 0)
              ? meta.imoveis
              : (proposal.imovel_cidade || proposal.imovel_endereco)
                ? [{ endereco: proposal.imovel_endereco, valor_medio: proposal.imovel_valor_medio, cidade: proposal.imovel_cidade, estado: proposal.imovel_estado }]
                : [];
            const linhasComImovelKeywords = ["home equity","homecash","cgi","cri","fundo construção","fundo incorpor"];
            const creditLineLower = (proposal.credit_line ?? "").toLowerCase();
            const linhaTemImovel = linhasComImovelKeywords.some(kw => creditLineLower.includes(kw));
            if (!linhaTemImovel || imoveis.length === 0) return null;
            return (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5" /> Imóveis em Garantia ({imoveis.length})
                </p>
                {imoveis.map((im, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Imóvel {imoveis.length > 1 ? `#${idx + 1}` : ""}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                      {(im.endereco || im.cep) && (
                        <div className="col-span-2 flex items-start gap-1.5">
                          <MapPin className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                          <span className="text-xs text-foreground">
                            {im.endereco}
                            {im.cep && <span className="ml-1 text-muted-foreground">— CEP: {im.cep}</span>}
                          </span>
                        </div>
                      )}
                      {(im.cidade || im.estado) && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Cidade/UF</span>
                          <span className="text-xs font-medium text-foreground">{[im.cidade, im.estado].filter(Boolean).join(" — ")}</span>
                        </div>
                      )}
                      {im.zona && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Zona</span>
                          <span className="text-xs font-medium text-foreground">{im.zona}</span>
                        </div>
                      )}
                      {im.padrao && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Padrão</span>
                          <span className="text-xs font-medium text-foreground">{im.padrao}</span>
                        </div>
                      )}
                      {im.estilo && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Estilo</span>
                          <span className="text-xs font-medium text-foreground">{im.estilo}</span>
                        </div>
                      )}
                      {im.proprietario && (
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs text-muted-foreground">Proprietário</span>
                          <span className="text-xs font-medium text-foreground">
                            {im.proprietario === "MESMO_TITULAR" ? "Mesmo Titular" : im.proprietario}
                          </span>
                        </div>
                      )}
                      <div className="col-span-2 pt-1.5 border-t border-amber-500/20">
                        {editingVmIdx === idx ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"><Banknote className="w-3 h-3" /> Valor Médio</span>
                            <div className="flex-1 flex items-center gap-1.5">
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                                <input
                                  type="text" inputMode="numeric"
                                  value={vmEditValue}
                                  onChange={e => setVmEditValue(applyBRLMask(e.target.value))}
                                  className="w-full h-7 pl-7 pr-2 text-xs bg-secondary border border-amber-500/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                  autoFocus
                                />
                              </div>
                              <button
                                onClick={() => saveVm(idx)}
                                disabled={vmSaving}
                                className="h-7 px-2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition-colors"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingVmIdx(null)}
                                className="h-7 px-2 rounded border border-border text-muted-foreground hover:text-white transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Banknote className="w-3 h-3" /> Valor Médio de Avaliação</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-amber-300">
                                {im.valor_medio ? formatCurrency(im.valor_medio) : <span className="text-muted-foreground italic">não informado</span>}
                              </span>
                              <button
                                onClick={() => startEditVm(idx, im.valor_medio)}
                                className="p-0.5 rounded hover:bg-amber-500/15 text-muted-foreground hover:text-amber-400 transition-colors"
                                title="Editar valor médio"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      {im.valor_medio && (
                        <div className="col-span-2 flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">LTV estimado</span>
                          <span className={`font-bold ${(proposal.requested_value / im.valor_medio) > 0.7 ? "text-red-400" : "text-emerald-400"}`}>
                            {((proposal.requested_value / im.valor_medio) * 100).toFixed(1)}%
                            <span className="font-normal text-muted-foreground ml-1">(máx. 70%)</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

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

          {/* ── Comissões da Operação ── */}
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3">
            <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Comissões da Operação
            </p>

            {/* Valor do Crédito (editável) */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <BadgeDollarSign className="w-3 h-3" /> Valor do Crédito
              </span>
              {canChangeStage && editandoValor ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <input
                    type="number"
                    value={valorCreditoEdit}
                    onChange={(e) => setValorCreditoEdit(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && salvarValorCredito()}
                    className="w-28 h-6 text-xs px-2 bg-secondary border border-primary/50 rounded text-white focus:outline-none"
                    autoFocus
                  />
                  <button onClick={salvarValorCredito} className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400">
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-white">{formatCurrency(valorCredito)}</span>
                  {canChangeStage && (
                    <button onClick={() => { setValorCreditoEdit(String(valorCredito)); setEditandoValor(true); }}
                      className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-white">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Campo 1 — Mandato */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Percent className="w-3 h-3" /> Mandato
              </span>
              <div className="flex items-center gap-2">
                {canChangeStage && editandoMandato ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={percMandatoEdit}
                      onChange={(e) => setPercMandatoEdit(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && salvarMandato()}
                      className="w-16 h-6 text-xs px-2 bg-secondary border border-primary/50 rounded text-white focus:outline-none"
                      autoFocus
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <button onClick={salvarMandato} className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400">
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-amber-300 font-medium">{percMandato}%</span>
                    {canChangeStage && (
                      <button onClick={() => { setPercMandatoEdit(String(percMandato)); setEditandoMandato(true); }}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-white">
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                <span className="text-xs font-semibold text-white w-24 text-right">{formatCurrency(comissaoMandato)}</span>
              </div>
            </div>

            {/* Campo 2 — Comissão Instituição */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Percent className="w-3 h-3" /> Comissão Instituição
              </span>
              <div className="flex items-center gap-2">
                {canChangeStage && editandoInstituicao ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={percInstituicaoEdit}
                      onChange={(e) => setPercInstituicaoEdit(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && salvarInstituicao()}
                      className="w-16 h-6 text-xs px-2 bg-secondary border border-primary/50 rounded text-white focus:outline-none"
                      autoFocus
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <button onClick={salvarInstituicao} className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400">
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-amber-300 font-medium">{percInstituicao}%</span>
                    {canChangeStage && (
                      <button onClick={() => { setPercInstituicaoEdit(String(percInstituicao)); setEditandoInstituicao(true); }}
                        className="w-5 h-5 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-white">
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
                <span className="text-xs font-semibold text-white w-24 text-right">{formatCurrency(comissaoInstituicao)}</span>
              </div>
            </div>

            {/* Separador */}
            <div className="border-t border-amber-500/20 pt-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Total Bruto (Mandato + Instituição)</span>
                <span className="font-semibold text-amber-300">{formatCurrency(totalComissao)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Impostos (ISS+PIS+COFINS {TAXA_IMPOSTOS_COMISSAO}%)</span>
                <span className="text-red-400">− {formatCurrency(totalComissao * TAXA_IMPOSTOS_COMISSAO / 100)}</span>
              </div>
            </div>

            {/* Campo 3 — Comissão Licenciado */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-xs font-semibold text-emerald-400">Comissão Licenciado (50% líquido)</span>
              <span className="text-sm font-bold text-emerald-400">{formatCurrency(comissaoLicenciado)}</span>
            </div>

            {!canChangeStage && (
              <p className="text-[10px] text-muted-foreground text-center italic">Somente analistas e administradores podem editar os campos de comissão.</p>
            )}
          </div>

          {/* ── Aba Recomendação ── */}
          {modalTab === "recomendacao" && (
            <div className="space-y-3">
              {canChangeStage && (
                <div className="flex justify-end">
                  <a
                    href="/configuracoes"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[11px] font-semibold text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
                    Editar Regras das Linhas
                  </a>
                </div>
              )}
              <div className="p-4 rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5">
                <RecomendacaoLinha proposal={proposal} rulesKey={rulesKey} />
              </div>
            </div>
          )}

          </div>{/* fim wrapper detalhes+recomendacao */}

          {/* ── Upload livre de documentos (partner e admin) ── */}
          {modalTab === "documentos" && (
            <PartnerDocUpload proposalId={proposal.id} />
          )}

          {/* ── Documentos Enviados pelo Cliente (Captação) ── */}
          {modalTab === "documentos" && (() => {
            const meta = proposal.metadata ?? {};
            const captDocs = (meta.documentos as Array<{ label: string; name: string; url: string }> | undefined) ?? [];
            if (captDocs.length === 0) return null;
            return (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
                <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" /> Documentos Enviados pelo Cliente ({captDocs.length})
                </p>
                <div className="space-y-2">
                  {captDocs.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-emerald-300 truncate">{doc.label}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{doc.name}</p>
                        </div>
                      </div>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/35 transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" /> Abrir
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Checklist de Documentos ── */}
          {modalTab === "documentos" && (() => {
            const meta = proposal.metadata ?? {};
            const clientType = ((meta.client_type ?? proposal.client_type) === "PJ" ? "PJ" : "PF") as "PF" | "PJ";
            const docs = portfolioDocs[proposal.credit_line?.toLowerCase()]?.[clientType] ?? CHECKLISTS[proposal.credit_line]?.[clientType] ?? DEFAULT_CHECKLIST[clientType];
            const checkedCount = docs.filter((d) => checkedDocs[d.id]).length;
            const allRequired = docs.filter((d) => d.required);
            const requiredChecked = allRequired.filter((d) => checkedDocs[d.id]).length;
            return (
              <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Checklist de Documentos
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {canChangeStage && Object.values(uploadedFiles).some(arr => arr.some(f => f.url)) && (
                      <button
                        onClick={handleOcrValidarTodos}
                        disabled={ocrValidandoTodos || ocrBatchLoading}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#C9A84C]/15 text-[#C9A84C] hover:bg-[#C9A84C]/25 border border-[#C9A84C]/30 disabled:opacity-50 transition-colors"
                        title="Validar todos os documentos anexados com OCR"
                      >
                        {ocrValidandoTodos ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        )}
                        {ocrValidandoTodos ? "Validando…" : "Validar Todos OCR"}
                      </button>
                    )}
                    {canChangeStage && (
                      <button
                        onClick={handleOcrBatch}
                        disabled={ocrBatchLoading || ocrValidandoTodos}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-[#C9A84C]/25 text-[#C9A84C] hover:bg-[#C9A84C]/35 border border-[#C9A84C]/50 disabled:opacity-50 transition-colors"
                        title="Analisar todos os documentos com OCR e gerar análise IA automaticamente"
                      >
                        {ocrBatchLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Brain className="w-3 h-3" />
                        )}
                        {ocrBatchLoading ? "Processando..." : "OCR + Análise IA"}
                      </button>
                    )}
                    <Badge className={checkedCount === docs.length
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      : requiredChecked === allRequired.length
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30"}>
                      {checkedCount}/{docs.length} enviados
                    </Badge>
                  </div>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 mb-1">
                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (checkedCount / (docs.length || 1)) * 100)}%` }} />
                </div>
                {(ocrBatchLoading || ocrBatchProgress) && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${ocrBatchProgress.startsWith("Erro") ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-[#C9A84C]/30 bg-[#C9A84C]/5 text-[#C9A84C]"}`}>
                    {ocrBatchLoading && <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" />}
                    <span>{ocrBatchProgress || "Processando OCR + Análise IA..."}</span>
                  </div>
                )}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {docs.map((doc) => {
                    const isChecked = !!checkedDocs[doc.id];
                    const docFiles  = uploadedFiles[doc.id] ?? [];
                    return (
                      <div key={doc.id} className="rounded-lg border border-border bg-secondary/20 p-2.5 space-y-1.5">
                        {/* Row 1: checkbox + label */}
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleDoc(doc.id)}
                            className="mt-0.5 w-3.5 h-3.5 accent-emerald-500 flex-shrink-0"
                          />
                          <span className={`text-xs leading-snug flex-1 ${isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {doc.label}
                            {doc.required && <span className="text-red-400 ml-0.5">*</span>}
                            {doc.hint && <span className="text-muted-foreground ml-1">— {doc.hint}</span>}
                          </span>
                          {/* Botão adicionar mais arquivos (sempre visível) */}
                          <label className="flex-shrink-0 cursor-pointer">
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              multiple
                              className="hidden"
                              onChange={async (e) => {
                                const files = Array.from(e.target.files ?? []);
                                for (const file of files) await handleFileUpload(doc.id, file);
                                e.target.value = "";
                              }}
                            />
                            <span className="flex items-center gap-1 px-2 py-1 rounded border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 text-[10px] text-muted-foreground hover:text-primary transition-colors">
                              <Upload className="w-3 h-3" />
                              {docFiles.length > 0 ? "+ Adicionar" : "Anexar"}
                            </span>
                          </label>
                        </div>

                        {/* Row 2: arquivos enviados */}
                        {isUploading === doc.id && (
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-dashed border-primary/40 bg-primary/5">
                            <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                            <span className="text-[11px] text-muted-foreground">Enviando arquivo...</span>
                          </div>
                        )}
                        {docFiles.length > 0 && (
                          <div className="space-y-1.5">
                            {docFiles.map((df, fi) => {
                              const ocrKey = `${doc.id}::${df.key}`;
                              const fileOcrStatus = ocrStatus[ocrKey];
                              const fileOcrResultado = ocrResultados[ocrKey];
                              const fileOcrErro = ocrErros[ocrKey];
                              return (
                              <div key={fi} className="space-y-1">
                              <div className="flex items-center gap-2 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
                                <Paperclip className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                <span className="text-[11px] text-emerald-400 flex-1 truncate">{df.name}</span>
                                {df.url && (
                                  <a
                                    href={df.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
                                    title="Abrir documento"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                                {/* Botão OCR — para todos os arquivos */}
                                {canChangeStage && df.url && (
                                  <button
                                    onClick={() => handleOcrValidar(doc.id, doc.label, df.url ?? undefined, df.key)}
                                    disabled={fileOcrStatus === "loading"}
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#C9A84C]/15 text-[#C9A84C] hover:bg-[#C9A84C]/25 border border-[#C9A84C]/30 disabled:opacity-50 transition-colors flex-shrink-0"
                                  >
                                    {fileOcrStatus === "loading" ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
                                    {fileOcrStatus === "loading" ? "Analisando…" : "OCR"}
                                  </button>
                                )}
                                <button
                                  onClick={() => removeFile(doc.id, df.key)}
                                  className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
                                  title="Remover arquivo"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Resultado OCR inline por arquivo */}
                              {fileOcrStatus === "error" && (
                                <div className="px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20">
                                  <p className="text-[10px] text-red-400">⚠ {fileOcrErro}</p>
                                </div>
                              )}
                              {fileOcrStatus === "done" && fileOcrResultado && (() => {
                                const r = fileOcrResultado;
                                const resumoCor = r.resumo === "aprovado" ? "emerald" : r.resumo === "atencao" ? "amber" : "red";
                                const resumoIcon = r.resumo === "aprovado" ? "✓" : r.resumo === "atencao" ? "⚠" : "✗";
                              return (
                                <div className={`rounded-lg border p-2.5 space-y-2 bg-${resumoCor}-500/5 border-${resumoCor}-500/20`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                      {r.tipo_documento}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-${resumoCor}-500/20 text-${resumoCor}-400`}>
                                      {resumoIcon} {r.resumo.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="space-y-1">
                                    {r.campos.map((campo, ci) => {
                                      const cor = campo.status === "ok" ? "text-emerald-400" : campo.status === "divergente" ? "text-red-400" : campo.status === "ausente" ? "text-amber-400" : "text-muted-foreground";
                                      const icon = campo.status === "ok" ? "✓" : campo.status === "divergente" ? "✗" : campo.status === "ausente" ? "?" : "·";
                                      return (
                                        <div key={ci} className="flex items-start gap-1.5">
                                          <span className={`text-[10px] font-bold flex-shrink-0 mt-0.5 ${cor}`}>{icon}</span>
                                          <div className="min-w-0">
                                            <span className="text-[10px] text-muted-foreground">{campo.campo}: </span>
                                            <span className={`text-[10px] font-medium ${cor}`}>{campo.extraido ?? "—"}</span>
                                            {campo.esperado && campo.status !== "ok" && (
                                              <span className="text-[9px] text-muted-foreground/60 ml-1">(esperado: {campo.esperado})</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {r.observacoes && (
                                    <p className="text-[10px] text-muted-foreground/80 italic border-t border-border pt-1.5">{r.observacoes}</p>
                                  )}
                                  {/* Botão solicitar correção — apenas quando reprovado */}
                                  {r.resumo === "reprovado" && proposal.partner_id && (
                                    <div className="border-t border-red-500/20 pt-2">
                                      {correcaoEnviada === doc.id ? (
                                        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                                          <CheckCircle2 className="w-3 h-3" /> Solicitação enviada ao partner. Proposta movida para Pendência.
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setSolicitarDoc({
                                            docId: doc.id,
                                            docLabel: doc.label,
                                            motivo: r.observacoes || r.campos.filter(c => c.status === "divergente" || c.status === "ausente").map(c => c.mensagem).join("; ") || "Documento reprovado na validação OCR",
                                          })}
                                          className="flex items-center gap-1.5 w-full justify-center px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-[11px] font-semibold text-red-400 hover:bg-red-500/25 transition-colors"
                                        >
                                          <Send className="w-3 h-3" /> Solicitar Correção ao Partner
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                              </div>
                            );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">* Obrigatório — anexe o arquivo e o documento será marcado automaticamente</p>
              </div>
            );
          })()}

          {/* Datas */}
          {modalTab === "documentos" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              Criado em {formatDate(proposal.created_at)}
            </div>
          )}

          {/* ── Mensagens da Mesa ── */}
          {modalTab === "comentarios" && <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Mensagens da Mesa
              {mesaComments.length > 0 && (
                <span className="ml-auto text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">
                  {mesaComments.length}
                </span>
              )}
            </p>

            {/* Lista de comentários */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {mesaComments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3 italic">
                  Nenhuma mensagem ainda.
                </p>
              ) : (
                mesaComments.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-lg bg-secondary/50 border border-border space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-primary">{c.author}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Campo de escrita — apenas para Mesa */}
            {canChangeStage && (
              <div className="flex gap-2 pt-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                  placeholder="Escreva uma mensagem para o partner..."
                  rows={2}
                  className="flex-1 text-xs px-3 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || savingComment}
                  className="w-9 h-9 rounded-lg bg-primary hover:bg-primary/80 flex items-center justify-center flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed transition-colors self-end"
                >
                  {savingComment
                    ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Send className="w-3.5 h-3.5 text-white" />}
                </button>
              </div>
            )}
            {!canChangeStage && (
              <p className="text-[10px] text-muted-foreground italic text-center">Somente a Mesa pode adicionar mensagens.</p>
            )}
          </div>}

          {/* ── Aba Análise IA ── */}
          {modalTab === "analise_ia" && (
            <div className="space-y-4">
              {/* Header com botão gerar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#C9A84C]" />
                  <p className="text-sm font-bold text-white">Análise de Inteligência de Crédito</p>
                  {analiseData?.generated_at && (
                    <span className="text-[10px] text-muted-foreground">
                      · Gerado em {new Date(analiseData.generated_at).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {analiseStatus === "done" && analisePdfB64 && (
                    <button
                      onClick={downloadPdf}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold hover:bg-[#C9A84C]/20 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Baixar PDF
                    </button>
                  )}
                  {canChangeStage && (
                    <button
                      onClick={handleGerarAnalise}
                      disabled={analiseStatus === "loading"}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/25 disabled:opacity-50 transition-colors"
                    >
                      {analiseStatus === "loading"
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analisando...</>
                        : <><RefreshCw className="w-3.5 h-3.5" /> {analiseData ? "Reanalisar" : "Gerar Análise"}</>}
                    </button>
                  )}
                </div>
              </div>

              {analiseStatus === "idle" && !analiseData && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Brain className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma análise gerada ainda.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Gerar Análise" para iniciar.</p>
                </div>
              )}

              {analiseStatus === "loading" && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                  <p className="text-sm text-white font-semibold">Analisando a proposta...</p>
                  <p className="text-xs text-muted-foreground mt-1">Consultando documentos, dados e histórico via IA</p>
                </div>
              )}

              {analiseStatus === "error" && (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10">
                  <p className="text-sm text-red-400 font-semibold mb-1">Erro ao gerar análise</p>
                  {analiseErro && <p className="text-xs text-muted-foreground font-mono break-all">{analiseErro}</p>}
                  <p className="text-xs text-muted-foreground mt-2">Tente novamente ou contate o suporte.</p>
                </div>
              )}

              {analiseStatus === "done" && analiseData && (
                <div className="space-y-4">
                  {/* Parecer + Risco */}
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                      analiseData.parecer === "FAVORÁVEL"
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                        : analiseData.parecer === "DESFAVORÁVEL"
                        ? "bg-red-500/15 border-red-500/40 text-red-400"
                        : "bg-amber-500/15 border-amber-500/40 text-amber-400"
                    }`}>PARECER: {analiseData.parecer}</span>
                    <span className={`px-3 py-1.5 rounded-lg border text-xs font-bold ${
                      analiseData.score_risco === "BAIXO"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : analiseData.score_risco === "ALTO"
                        ? "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    }`}>RISCO {analiseData.score_risco}</span>
                  </div>

                  {/* Resumo Executivo */}
                  <div className="p-4 rounded-xl border border-[#C9A84C]/20 bg-[#C9A84C]/5">
                    <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Resumo Executivo</p>
                    <p className="text-sm text-foreground leading-relaxed">{analiseData.resumo_executivo}</p>
                  </div>

                  {/* 5 C's */}
                  <div className="p-4 rounded-xl border border-border bg-secondary/30">
                    <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider mb-3">Os 5 C's do Crédito</p>
                    <div className="grid grid-cols-1 gap-2.5">
                      {([
                        { key: "carater",    label: "Caráter" },
                        { key: "capacidade", label: "Capacidade" },
                        { key: "capital",    label: "Capital" },
                        { key: "colateral",  label: "Colateral" },
                        { key: "condicoes",  label: "Condições" },
                      ] as { key: keyof typeof analiseData.cinco_cs; label: string }[]).map(({ key, label }) => (
                        <div key={key} className="p-3 rounded-lg bg-card border-l-2 border-l-[#C9A84C]/50 border border-border">
                          <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1">{label}</p>
                          <p className="text-xs text-foreground leading-relaxed">{analiseData.cinco_cs[key]}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Análise Financeira */}
                  <div className="p-4 rounded-xl border border-border bg-secondary/30">
                    <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Análise Financeira</p>
                    <p className="text-xs text-foreground leading-relaxed mb-3">{analiseData.analise_financeira}</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      <div className="flex items-center justify-between py-1.5 border-b border-border">
                        <span className="text-xs text-muted-foreground">Capacidade de Pagamento</span>
                        <span className="text-xs font-bold text-emerald-400">{analiseData.capacidade_pagamento}</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-border">
                        <span className="text-xs text-muted-foreground">Comprometimento de Renda</span>
                        <span className="text-xs font-bold text-foreground">{analiseData.comprometimento_renda}</span>
                      </div>
                      <div className="py-1.5">
                        <span className="text-xs text-amber-400">{analiseData.gap_analise}</span>
                      </div>
                    </div>
                  </div>

                  {/* Pontos */}
                  <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
                    <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider">Pontos da Operação</p>
                    {analiseData.pontos_criticos.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-red-400 uppercase mb-1.5">🔴 Críticos</p>
                        <ul className="space-y-1">{analiseData.pontos_criticos.map((p, i) => (
                          <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="text-red-400 flex-shrink-0">✕</span>{p}</li>
                        ))}</ul>
                      </div>
                    )}
                    {analiseData.pontos_atencao.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-amber-400 uppercase mb-1.5">🟡 Atenção</p>
                        <ul className="space-y-1">{analiseData.pontos_atencao.map((p, i) => (
                          <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="text-amber-400 flex-shrink-0">!</span>{p}</li>
                        ))}</ul>
                      </div>
                    )}
                    {analiseData.pontos_positivos.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1.5">🟢 Positivos</p>
                        <ul className="space-y-1">{analiseData.pontos_positivos.map((p, i) => (
                          <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="text-emerald-400 flex-shrink-0">✓</span>{p}</li>
                        ))}</ul>
                      </div>
                    )}
                  </div>

                  {/* Análise Documentos */}
                  <div className="p-4 rounded-xl border border-border bg-secondary/30">
                    <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Análise de Documentos</p>
                    <p className="text-xs text-foreground leading-relaxed">{analiseData.analise_documentos}</p>
                  </div>

                  {/* Histórico */}
                  {analiseData.historico_operacao && (
                    <div className="p-4 rounded-xl border border-border bg-secondary/30">
                      <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Histórico da Operação</p>
                      <p className="text-xs text-foreground leading-relaxed">{analiseData.historico_operacao}</p>
                    </div>
                  )}

                  {/* Parecer Final */}
                  <div className={`p-4 rounded-xl border ${
                    analiseData.parecer === "FAVORÁVEL" ? "border-emerald-500/30 bg-emerald-500/5" :
                    analiseData.parecer === "DESFAVORÁVEL" ? "border-red-500/30 bg-red-500/5" :
                    "border-amber-500/30 bg-amber-500/5"
                  }`}>
                    <p className="text-xs font-bold uppercase tracking-wider mb-2 text-muted-foreground">Parecer Final ao Comitê</p>
                    <p className="text-xs text-foreground leading-relaxed">{analiseData.parecer_final}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border space-y-2">
          {contratoStatus !== "idle" && (
            <div className={`text-xs px-3 py-2 rounded-lg ${contratoStatus === "sent" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              {contratoMsg}
            </div>
          )}
          {contratoInfo && (
            <div className="space-y-2">
              <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs ${
                contratoInfo.status === "ASSINADO"               ? "bg-emerald-500/10 border border-emerald-500/30" :
                contratoInfo.status === "AGUARDANDO_V3"          ? "bg-amber-500/10 border border-amber-500/30" :
                contratoInfo.status === "AGUARDANDO_TESTEMUNHA"  ? "bg-purple-500/10 border border-purple-500/30" :
                contratoInfo.status === "AGUARDANDO_TESTEMUNHA2" ? "bg-orange-500/10 border border-orange-500/30" :
                contratoInfo.status === "CANCELADO"              ? "bg-red-500/10 border border-red-500/30" :
                contratoInfo.status === "EXPIRADO"               ? "bg-gray-500/10 border border-gray-500/30" :
                "bg-blue-500/10 border border-blue-500/30"
              }`}>
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className={
                    contratoInfo.status === "ASSINADO"               ? "text-emerald-400 font-semibold" :
                    contratoInfo.status === "AGUARDANDO_V3"          ? "text-amber-400 font-semibold" :
                    contratoInfo.status === "AGUARDANDO_TESTEMUNHA"  ? "text-purple-400 font-semibold" :
                    contratoInfo.status === "AGUARDANDO_TESTEMUNHA2" ? "text-orange-400 font-semibold" :
                    contratoInfo.status === "CANCELADO"              ? "text-red-400 font-semibold" :
                    contratoInfo.status === "EXPIRADO"               ? "text-gray-400 font-semibold" :
                    "text-blue-400 font-semibold"
                  }>
                    {contratoInfo.status === "PENDENTE"               && "Contrato enviado — aguardando cliente"}
                    {contratoInfo.status === "AGUARDANDO_V3"          && `✅ Cliente assinou — aguarda V3 (${contratoInfo.signed_at ? new Date(contratoInfo.signed_at).toLocaleDateString("pt-BR") : ""})`}
                    {contratoInfo.status === "AGUARDANDO_TESTEMUNHA"  && "✅ V3 assinou — aguardando 1ª testemunha (parceiro)"}
                    {contratoInfo.status === "AGUARDANDO_TESTEMUNHA2" && "✅ Parceiro assinou — aguardando 2ª testemunha (Aline)"}
                    {contratoInfo.status === "ASSINADO"               && `✅ Contrato finalizado — ${contratoInfo.v3_signer_name ?? ""}`}
                    {contratoInfo.status === "CANCELADO"              && "⛔ Contrato cancelado"}
                    {contratoInfo.status === "EXPIRADO"               && "⌛ Contrato expirado — reenvie para reativar"}
                  </span>
                </div>
                {contratoInfo.status === "ASSINADO" && contratoInfo.contrato_url ? (
                  <a href={contratoInfo.contrato_url} target="_blank" rel="noopener noreferrer"
                    className="text-[#C9A84C] hover:text-[#E8C97A] underline text-[10px] font-semibold">
                    ⬇ Baixar Certificado
                  </a>
                ) : !["ASSINADO","CANCELADO"].includes(contratoInfo.status) ? (
                  <a href={`/assinar/${contratoInfo.token}`} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-white underline text-[10px]">
                    Ver contrato
                  </a>
                ) : null}
              </div>

              {/* Ações operacionais */}
              {!["ASSINADO","CANCELADO"].includes(contratoInfo.status) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleReenviarContrato}
                    disabled={reenviando}
                    className="text-[10px] px-2.5 py-1 rounded border border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 disabled:opacity-50 transition-colors"
                  >
                    {reenviando ? "Reenviando…" : "↺ Reenviar link"}
                  </button>
                  <button
                    onClick={handleCancelarContrato}
                    disabled={cancelando}
                    className="text-[10px] px-2.5 py-1 rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
                  >
                    {cancelando ? "Cancelando…" : "⛔ Cancelar contrato"}
                  </button>
                  {contratoAcaoMsg && (
                    <span className="text-[10px] text-muted-foreground">{contratoAcaoMsg}</span>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
            {canCompileDocuments && (
              <Button variant="outline" size="sm" onClick={compileDocuments} className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
                <Package className="w-3.5 h-3.5" />
                Compilar Documentos
              </Button>
            )}
            {canChangeStage && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnviarContrato}
                disabled={sendingContrato}
                className="gap-1.5 border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10"
              >
                {sendingContrato ? (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Enviar Contrato
              </Button>
            )}
          </div>
          {canChangeStage && activeIdx > 0 && prevStage && !isEmAprovacao && (
            <Button size="sm" variant="outline" onClick={goBack} className="gap-2 border-border text-muted-foreground hover:text-white">
              <ArrowLeft className="w-4 h-4" />
              Retroceder para <span className={prevStage.color}>{prevStage.label}</span>
            </Button>
          )}
          {canChangeStage && !isFinished && nextStage && !isEmAprovacao && (
            <Button size="sm" onClick={advance} className="gap-2">
              Avançar para <span className={nextStage.color}>{nextStage.label}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
          {/* ── Botões de aprovação — apenas em "Em Aprovação" ── */}
          {canChangeStage && isEmAprovacao && (
            <div className="flex items-center gap-2 flex-wrap">
              {proximosNiveis.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setShowEscalar(true)}
                  className="gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                  <ArrowRight className="w-3.5 h-3.5" /> Escalar Nível
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowReprovar(true)}
                className="gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10">
                <X className="w-3.5 h-3.5" /> Reprovar
              </Button>
              <Button size="sm" onClick={() => setShowAprovar(true)}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
              </Button>
            </div>
          )}
          {isFinished && proposal?.status === "APPROVED" && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-3 py-1">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovada — {proposal.approved_value ? formatCurrency(proposal.approved_value) : "Finalizada"}
            </Badge>
          )}
          {proposal?.status === "REJECTED" && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs px-3 py-1">
              ✗ Reprovada
            </Badge>
          )}
          {isFinished && proposal?.status !== "APPROVED" && proposal?.status !== "REJECTED" && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs px-3 py-1">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Proposta Finalizada
            </Badge>
          )}
          </div>
        </div>
      </div>

      {/* ── Modal: Aprovar ── */}
      {showAprovar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-emerald-500/30 rounded-2xl w-full max-w-sm animate-fade-in">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Aprovar Proposta</h3>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-muted-foreground">Informe o valor aprovado pela instituição financeira.</p>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Valor Aprovado *</label>
                <input
                  type="text"
                  value={valorAprovado}
                  onChange={e => {
                    const nums = e.target.value.replace(/\D/g, "");
                    const val = parseFloat(nums) / 100;
                    setValorAprovado(isNaN(val) ? "" : val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
                  }}
                  placeholder="R$ 0,00"
                  className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">O partner será notificado automaticamente e a proposta será finalizada.</p>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowAprovar(false); setValorAprovado(""); }}>Cancelar</Button>
              <Button size="sm" onClick={handleAprovar} disabled={!valorAprovado || savingAprovacao}
                className="bg-emerald-600 hover:bg-emerald-500 border-0 text-white gap-1.5">
                {savingAprovacao ? <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirmar Aprovação
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Reprovar ── */}
      {showReprovar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-red-500/30 rounded-2xl w-full max-w-sm animate-fade-in">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <X className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-bold text-white">Reprovar Proposta</h3>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-muted-foreground">Informe o motivo da reprovação. O partner será notificado.</p>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Motivo *</label>
                <textarea
                  value={motivoReprovacao}
                  onChange={e => setMotivoReprovacao(e.target.value)}
                  placeholder="Ex: Score insuficiente, documentação incompleta, restrições cadastrais..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-red-500/50 resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowReprovar(false); setMotivoReprovacao(""); }}>Cancelar</Button>
              <Button size="sm" onClick={handleReprovar} disabled={!motivoReprovacao.trim() || savingAprovacao}
                className="bg-red-600 hover:bg-red-500 border-0 text-white gap-1.5">
                {savingAprovacao ? <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Confirmar Reprovação
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Escalar Nível ── */}
      {showEscalar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-amber-500/30 rounded-2xl w-full max-w-sm animate-fade-in">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <ArrowRight className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Escalar Nível</h3>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-muted-foreground">Selecione o nível para onde a proposta será escalada. Ela voltará para Triagem no novo nível.</p>
              <div className="flex flex-col gap-2">
                {proximosNiveis.map(n => (
                  <button key={n.key} onClick={() => setNivelEscalar(n.key)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm font-medium ${
                      nivelEscalar === n.key
                        ? "border-amber-500/60 bg-amber-500/15 text-amber-400"
                        : "border-border text-muted-foreground hover:bg-secondary"
                    }`}>
                    {n.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowEscalar(false); setNivelEscalar(""); }}>Cancelar</Button>
              <Button size="sm" onClick={handleEscalar} disabled={!nivelEscalar || savingAprovacao}
                className="gap-1.5 border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20">
                {savingAprovacao ? <span className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                Confirmar Escalada
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Compilar Documentos ── */}
      {showCompile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  Documentos Compilados
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {proposal?.code} · Links válidos por 20 dias
                </p>
              </div>
              <button onClick={() => setShowCompile(false)} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-3 max-h-96 overflow-y-auto">
              {compileLoading ? (
                <div className="flex items-center justify-center py-8 gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm text-muted-foreground">Gerando links...</span>
                </div>
              ) : compileDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <FileText className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nenhum documento enviado ainda.</p>
                </div>
              ) : (
                compileDocs.map((doc) => (
                  <div key={doc.doc_id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border group">
                    <Paperclip className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Enviado em {new Date(doc.uploaded_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    {doc.url ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                          title="Abrir documento">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button onClick={() => copyLink(doc.url!, doc.doc_id)}
                          className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
                          title="Copiar link">
                          {copiedId === doc.doc_id
                            ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                            : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Link indisponível</span>
                    )}
                  </div>
                ))
              )}
            </div>

            {compileDocs.length > 0 && !compileLoading && (
              <div className="px-6 py-4 border-t border-border flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">{compileDocs.length} documento(s) · validade 20 dias</p>
                <Button size="sm" variant="outline" onClick={copyAllLinks} className="gap-1.5 text-xs">
                  {copiedId === "__all__"
                    ? <><CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Copiado!</>
                    : <><Copy className="w-3.5 h-3.5" /> Copiar todos os links</>}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Solicitar Correção ao Partner ── */}
      {solicitarDoc && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#243A66]">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-bold text-white">Solicitar Correção ao Partner</h3>
              </div>
              <button onClick={() => setSolicitarDoc(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#162744] text-muted-foreground hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-[11px] text-red-400 font-semibold mb-1">📎 {solicitarDoc.docLabel}</p>
                <p className="text-[11px] text-red-300/80">Documento reprovado na validação OCR</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Motivo da solicitação</label>
                <textarea
                  className="w-full bg-[#09081A] border border-[#243A66] rounded-lg px-3 py-2 text-[12px] text-white outline-none resize-none focus:border-[#C9A84C]/50"
                  rows={3}
                  value={solicitarDoc.motivo}
                  onChange={e => setSolicitarDoc(prev => prev ? { ...prev, motivo: e.target.value } : prev)}
                />
              </div>
              <div className="p-3 rounded-xl bg-[#162744] border border-[#243A66] space-y-1">
                <p className="text-[10px] text-muted-foreground">O partner receberá:</p>
                <p className="text-[11px] text-white">✓ Notificação interna na plataforma</p>
                <p className="text-[11px] text-white">✓ E-mail com o documento e motivo</p>
                <p className="text-[11px] text-white">✓ Proposta movida para <span className="text-orange-400 font-semibold">Pendência de Docs</span></p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={() => setSolicitarDoc(null)} className="flex-1">
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSolicitarCorrecao}
                  disabled={solicitandoCorrecao || !solicitarDoc.motivo.trim()}
                  className="flex-1 gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                >
                  {solicitandoCorrecao ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {solicitandoCorrecao ? "Enviando…" : "Enviar Solicitação"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Editar Proposta ── */}
      {showEdit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-primary" /> Editar Proposta
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{proposal?.code} — {proposal?.client_name}</p>
              </div>
              <button onClick={() => setShowEdit(false)} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* PF/PJ Toggle */}
            <div className="px-6 pt-4 flex gap-2">
              {(["PF","PJ"] as const).map((t) => (
                <button key={t} onClick={() => setEditClientType(t)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${editClientType === t ? "bg-primary/15 border-primary/40 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                  {t === "PF" ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                  {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Dados do Cliente */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Cliente</p>
              {editClientType === "PF" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <EField label="Nome completo *" value={editNome} onChange={setEditNome} placeholder="João da Silva" />
                    <EField label="CPF" value={editCpfCnpj} onChange={setEditCpfCnpj} placeholder="000.000.000-00" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EField label="E-mail" value={editEmail} onChange={setEditEmail} placeholder="joao@email.com" type="email" />
                    <EField label="Telefone" value={editTelefone} onChange={setEditTelefone} placeholder="(11) 99999-0000" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <EField label="RG" value={editRg} onChange={setEditRg} placeholder="00.000.000-0" />
                    <EField label="Data de Nascimento" value={editNascimento} onChange={setEditNascimento} type="date" />
                    <ESelectField label="Estado Civil" value={editEstadoCivil} onChange={setEditEstadoCivil}
                      options={["Solteiro(a)","Casado(a)","Divorciado(a)","Viúvo(a)","União Estável"]} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <EField label="Renda Mensal (R$)" value={editRenda} onChange={setEditRenda} placeholder="0,00" />
                    <EField label="Endereço" value={editEndRua} onChange={setEditEndRua} placeholder="Rua, número, bairro" />
                    <EField label="CEP" value={editEndCep} onChange={setEditEndCep} placeholder="00000-000" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EField label="Cidade" value={editEndCidade} onChange={setEditEndCidade} placeholder="São Paulo" />
                    <EField label="UF" value={editEndUf} onChange={setEditEndUf} placeholder="SP" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <EField label="Razão Social *" value={editRazaoSocial} onChange={setEditRazaoSocial} placeholder="Empresa Ltda" />
                    <EField label="CNPJ" value={editCpfCnpj} onChange={setEditCpfCnpj} placeholder="00.000.000/0001-00" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EField label="Nome Fantasia" value={editNomeFantasia} onChange={setEditNomeFantasia} placeholder="Nome fantasia" />
                    <EField label="Sócio Responsável" value={editSocioResp} onChange={setEditSocioResp} placeholder="Nome do sócio" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EField label="E-mail" value={editEmail} onChange={setEditEmail} placeholder="contato@empresa.com" type="email" />
                    <EField label="Telefone" value={editTelefone} onChange={setEditTelefone} placeholder="(11) 3000-0000" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <EField label="Faturamento Anual (R$)" value={editFaturamento} onChange={setEditFaturamento} placeholder="0,00" />
                    <EField label="Endereço" value={editEndRua} onChange={setEditEndRua} placeholder="Rua, número, bairro" />
                    <EField label="CEP" value={editEndCep} onChange={setEditEndCep} placeholder="00000-000" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <EField label="Cidade" value={editEndCidade} onChange={setEditEndCidade} placeholder="São Paulo" />
                    <EField label="UF" value={editEndUf} onChange={setEditEndUf} placeholder="SP" />
                  </div>
                </div>
              )}

              {/* Restrição */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Restrição cadastral / financeira</label>
                <div className="flex gap-2">
                  {[{ val: "NAO", label: "Sem restrição", color: "emerald" }, { val: "SIM", label: "Com restrição", color: "red" }].map(opt => (
                    <button key={opt.val} type="button" onClick={() => setEditRestricao(opt.val as "SIM"|"NAO")}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${
                        editRestricao === opt.val
                          ? opt.color === "emerald" ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-400" : "bg-red-500/15 border-red-500/50 text-red-400"
                          : "bg-transparent border-border text-muted-foreground hover:border-primary/40"
                      }`}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {/* Operação */}
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2 border-t border-border">Operação</p>
              <div className="grid grid-cols-2 gap-3">
                <ESelectField label="Prazo desejado" value={editPrazo} onChange={setEditPrazo}
                  options={["12 meses","24 meses","36 meses","48 meses","60 meses","84 meses","120 meses","180 meses","240 meses"]} />
                <ESelectField label="Finalidade" value={editFinalidade} onChange={setEditFinalidade}
                  options={["Capital de Giro","Investimento","Refinanciamento","Aquisição","Expansão","Outro"]} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Observações</label>
                <textarea value={editObservacoes} onChange={(e) => setEditObservacoes(e.target.value)} rows={3}
                  placeholder="Informações relevantes sobre a operação..."
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowEdit(false)} disabled={editSaving}>Cancelar</Button>
              <Button size="sm" onClick={handleSaveEdit} disabled={editSaving} className="gap-2 bg-emerald-600 hover:bg-emerald-500">
                {editSaving
                  ? <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Salvando...</>
                  : <><Check className="w-3.5 h-3.5" /> Salvar Alterações</>}
              </Button>
            </div>
          </div>
        </div>
      )}
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

function EField({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
    </div>
  );
}

function ESelectField({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
        <option value="">Selecione...</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
