"use client";

import React, { useState, useEffect } from "react";
import {
  X, User, Building2, CheckCircle2, Clock, ArrowRight,
  FileText, CreditCard, Calendar, Link2, Pencil, Check,
  Percent, TrendingUp, BadgeDollarSign, Upload, Paperclip, Trash2, Home, ExternalLink,
  Package, Copy, CheckCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, type OperationStatus } from "@/lib/constants";
import { CHECKLISTS, DEFAULT_CHECKLIST } from "./nova-proposta-modal";

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
  // Campos de comissão (editáveis apenas por MESA_OPERACIONAL/ADMIN)
  valor_credito_atual?: number;
  comissao_mandato_perc?: number;
  comissao_instituicao_perc?: number;
  imovel_endereco?: string;
  imovel_valor_medio?: number;
  imovel_cidade?: string;
  imovel_estado?: string;
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
}

export function PropostaDetailModal({ open, onClose, proposal, onStageChange, onProposalUpdate, canChangeStage, canEditValorSolicitado, canCompileDocuments }: PropostaDetailModalProps) {
  // ── Checklist state ───────────────────────────────────────────────────────
  const IS_DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");
  const [checkedDocs, setCheckedDocs] = useState<Record<string, boolean>>({});
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({}); // docId → filename
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>({}); // docId → signed URL (20 dias)
  const [isUploading, setIsUploading] = useState<string | null>(null); // docId em upload
  const [showCompile, setShowCompile] = useState(false);
  const [compileLoading, setCompileLoading] = useState(false);
  const [compileDocs, setCompileDocs] = useState<CompiledDoc[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!proposal) return;
    setCheckedDocs({});
    setUploadedFiles({});
    setUploadedUrls({});
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
        .then(({ documents, checklist }) => {
          // Carrega checklist salvo (marcações sem arquivo)
          const savedChecks: Record<string, boolean> = (checklist && typeof checklist === "object") ? checklist : {};
          const files: Record<string, string>   = {};
          const urls: Record<string, string>    = {};
          // Documentos com arquivo sobrescrevem o checklist
          if (Array.isArray(documents)) {
            documents.forEach((d: { doc_id: string; file_name: string; url: string | null }) => {
              savedChecks[d.doc_id] = true;
              files[d.doc_id]  = d.file_name;
              if (d.url) urls[d.doc_id] = d.url;
            });
          }
          setCheckedDocs(savedChecks);
          setUploadedFiles(files);
          setUploadedUrls(urls);
        })
        .catch(() => {});
    }
  }, [proposal?.id, open]);

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
      const newFiles  = { ...uploadedFiles, [docId]: file.name };
      setCheckedDocs(newChecks);
      setUploadedFiles(newFiles);
      try {
        localStorage.setItem(`v3_docs_${proposal.id}`,  JSON.stringify(newChecks));
        localStorage.setItem(`v3_files_${proposal.id}`, JSON.stringify(newFiles));
      } catch {}
      return;
    }
    setIsUploading(docId);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("proposal_id", proposal.id);
      form.append("doc_id", docId);
      const res  = await fetch("/api/credit-proposals/documents", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) { alert(json.error ?? "Erro ao enviar arquivo"); return; }
      setCheckedDocs((prev) => ({ ...prev, [docId]: true }));
      setUploadedFiles((prev) => ({ ...prev, [docId]: file.name }));
      if (json.document?.url) setUploadedUrls((prev) => ({ ...prev, [docId]: json.document.url }));
    } finally {
      setIsUploading(null);
    }
  }

  function removeFile(docId: string) {
    if (!proposal) return;
    // Atualiza UI imediatamente (optimistic)
    const newFiles  = { ...uploadedFiles };
    const newUrls   = { ...uploadedUrls };
    delete newFiles[docId];
    delete newUrls[docId];
    setUploadedFiles(newFiles);
    setUploadedUrls(newUrls);
    setCheckedDocs((prev) => ({ ...prev, [docId]: false }));
    if (IS_DEMO) {
      try {
        localStorage.setItem(`v3_docs_${proposal.id}`,  JSON.stringify({ ...checkedDocs, [docId]: false }));
        localStorage.setItem(`v3_files_${proposal.id}`, JSON.stringify(newFiles));
      } catch {}
    } else {
      fetch(
        `/api/credit-proposals/documents?proposal_id=${proposal.id}&doc_id=${encodeURIComponent(docId)}`,
        { method: "DELETE" }
      ).catch(() => {});
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

  // Sync state when proposal changes
  useEffect(() => {
    if (!proposal) return;
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

  function salvarValorCredito() {
    const v = parseFloat(valorCreditoEdit.replace(",", "."));
    if (isNaN(v) || v <= 0) return;
    setValorCredito(v);
    setEditandoValor(false);
    onProposalUpdate?.(proposal!.id, { valor_credito_atual: v });
  }

  function salvarMandato() {
    const v = parseFloat(percMandatoEdit.replace(",", "."));
    if (isNaN(v) || v < 0) return;
    setPercMandato(v);
    setEditandoMandato(false);
    onProposalUpdate?.(proposal!.id, { comissao_mandato_perc: v });
  }

  function salvarInstituicao() {
    const v = parseFloat(percInstituicaoEdit.replace(",", "."));
    if (isNaN(v) || v < 0) return;
    setPercInstituicao(v);
    setEditandoInstituicao(false);
    onProposalUpdate?.(proposal!.id, { comissao_instituicao_perc: v });
  }

  function salvarValorSolicitado() {
    const v = parseFloat(valorSolicitadoEdit.replace(",", "."));
    if (isNaN(v) || v <= 0) return;
    setValorSolicitado(v);
    setEditandoValorSolicitado(false);
    onProposalUpdate?.(proposal!.id, { requested_value: v });
  }

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
              {/* Valor Solicitado editável */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs text-muted-foreground flex-shrink-0">Valor Solicitado</span>
                {(canChangeStage || canEditValorSolicitado) && editandoValorSolicitado ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <input
                      type="number"
                      value={valorSolicitadoEdit}
                      onChange={(e) => setValorSolicitadoEdit(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && salvarValorSolicitado()}
                      className="w-28 h-5 text-xs px-2 bg-secondary border border-primary/50 rounded text-white focus:outline-none"
                      autoFocus
                    />
                    <button onClick={salvarValorSolicitado} className="w-5 h-5 rounded flex items-center justify-center bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400">
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium text-foreground">{formatCurrency(valorSolicitado || proposal.requested_value)}</span>
                    {(canChangeStage || canEditValorSolicitado) && (
                      <button
                        onClick={() => { setValorSolicitadoEdit(String(valorSolicitado || proposal.requested_value)); setEditandoValorSolicitado(true); }}
                        className="w-4 h-4 rounded flex items-center justify-center hover:bg-secondary text-muted-foreground hover:text-white"
                        title="Editar valor solicitado"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {proposal.approved_value && (
                <InfoRow label="Valor Aprovado" value={formatCurrency(proposal.approved_value)} success />
              )}
              {proposal.prazo && <InfoRow label="Prazo" value={proposal.prazo} />}
              {proposal.finalidade && <InfoRow label="Finalidade" value={proposal.finalidade} />}
            </InfoSection>
          </div>

          {/* Card de Imóvel em Garantia */}
          {["HOME EQUITY","HE ESTRESSADO","HOMECASH","CGI","CRI","FUNDO CONSTRUÇÃO RESIDENCIAL","FUNDO CONSTRUÇÃO LOTEAMENTO","FUNDO CONSTRUÇÃO EMPREENDIMENTO"].includes(proposal.credit_line) &&
            (proposal.imovel_valor_medio || proposal.imovel_cidade) && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
              <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <Home className="w-3.5 h-3.5" /> Imóvel em Garantia
              </p>
              {proposal.imovel_endereco && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground flex-shrink-0">Endereço</span>
                  <span className="text-xs font-medium text-foreground text-right">{proposal.imovel_endereco}</span>
                </div>
              )}
              {(proposal.imovel_cidade || proposal.imovel_estado) && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground flex-shrink-0">Localização</span>
                  <span className="text-xs font-medium text-foreground text-right">
                    {[proposal.imovel_cidade, proposal.imovel_estado].filter(Boolean).join(" — ")}
                  </span>
                </div>
              )}
              {proposal.imovel_valor_medio && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs text-muted-foreground flex-shrink-0">Valor Médio de Avaliação</span>
                  <span className="text-xs font-bold text-amber-300">{formatCurrency(proposal.imovel_valor_medio)}</span>
                </div>
              )}
              {proposal.imovel_valor_medio && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-500/20">
                  <span className="text-muted-foreground">LTV estimado</span>
                  <span className={`font-bold ${
                    (proposal.requested_value / proposal.imovel_valor_medio) > 0.7 ? "text-red-400" : "text-emerald-400"
                  }`}>
                    {((proposal.requested_value / proposal.imovel_valor_medio) * 100).toFixed(1)}%
                    <span className="font-normal text-muted-foreground ml-1">(máx. 70%)</span>
                  </span>
                </div>
              )}
            </div>
          )}

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

          {/* ── Checklist de Documentos ── */}
          {(() => {
            const clientType = (proposal.client_type === "PJ" ? "PJ" : "PF") as "PF" | "PJ";
            const docs = CHECKLISTS[proposal.credit_line]?.[clientType] ?? DEFAULT_CHECKLIST[clientType];
            const checkedCount = docs.filter((d) => checkedDocs[d.id]).length;
            const allRequired = docs.filter((d) => d.required);
            const requiredChecked = allRequired.filter((d) => checkedDocs[d.id]).length;
            return (
              <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Checklist de Documentos
                  </p>
                  <Badge className={checkedCount === docs.length
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : requiredChecked === allRequired.length
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    : "bg-red-500/20 text-red-400 border-red-500/30"}>
                    {checkedCount}/{docs.length} enviados
                  </Badge>
                </div>
                <div className="w-full bg-secondary rounded-full h-1.5 mb-1">
                  <div className="bg-emerald-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (checkedCount / (docs.length || 1)) * 100)}%` }} />
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {docs.map((doc) => {
                    const isChecked = !!checkedDocs[doc.id];
                    const fileName  = uploadedFiles[doc.id];
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
                        </div>

                        {/* Row 2: upload area */}
                        {isUploading === doc.id ? (
                          <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-dashed border-primary/40 bg-primary/5">
                            <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                            <span className="text-[11px] text-muted-foreground">Enviando arquivo...</span>
                          </div>
                        ) : fileName ? (
                          <div className="flex items-center gap-2 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
                            <Paperclip className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                            <span className="text-[11px] text-emerald-400 flex-1 truncate">{fileName}</span>
                            {uploadedUrls[doc.id] && (
                              <a
                                href={uploadedUrls[doc.id]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
                                title="Abrir documento (válido por 20 dias)"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            <button
                              onClick={() => removeFile(doc.id)}
                              className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
                              title="Remover arquivo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-2 px-2 py-1.5 rounded border border-dashed border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-colors group">
                            <Upload className="w-3 h-3 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                            <span className="text-[11px] text-muted-foreground group-hover:text-primary">
                              Clique para anexar arquivo (PDF, JPG, PNG)
                            </span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) await handleFileUpload(doc.id, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
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
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            Criado em {formatDate(proposal.created_at)}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
            {canCompileDocuments && (
              <Button variant="outline" size="sm" onClick={compileDocuments} className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
                <Package className="w-3.5 h-3.5" />
                Compilar Documentos
              </Button>
            )}
          </div>
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
