"use client";

import React, { useState, useEffect } from "react";
import {
  X, User, Building2, CheckCircle2, Clock, ArrowRight,
  FileText, CreditCard, Calendar, Link2, Pencil, Check,
  Percent, TrendingUp, BadgeDollarSign, Upload, Paperclip, Trash2, Home, ExternalLink,
  Package, Copy, CheckCheck, MessageSquare, Send, Search, AlertTriangle, ShieldCheck,
  Phone, Mail, MapPin, Banknote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, type OperationStatus } from "@/lib/constants";
import { CHECKLISTS, DEFAULT_CHECKLIST } from "./nova-proposta-modal";

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
  mesa_comments?: MesaComment[];
  metadata?: ProposalMeta;
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
}

export function PropostaDetailModal({ open, onClose, proposal, onStageChange, onProposalUpdate, canChangeStage, canEditValorSolicitado, canCompileDocuments }: PropostaDetailModalProps) {
  // ── Checklist state ───────────────────────────────────────────────────────
  const IS_DEMO = false;
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
          if (Array.isArray(mesa_comments)) setMesaComments(mesa_comments);
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
  } | null>(null);

  useEffect(() => {
    if (!proposal?.id || !open) return;
    fetch(`/api/contratos/status?proposal_id=${proposal.id}`)
      .then(r => r.json())
      .then(({ contrato }) => setContratoInfo(contrato ?? null))
      .catch(() => {});
  }, [proposal?.id, open]);

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
    setEditCpfCnpj(proposal.cpf_cnpj ?? "");
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
                    {proposal.cpf_cnpj && <InfoRow label={clientType === "PJ" ? "CNPJ" : "CPF"} value={proposal.cpf_cnpj} />}
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
            const linhasComImovel = ["HOME EQUITY","HOME EQUITY ESTRESSADO","HOMECASH","CGI","CRI","FUNDO CONSTRUÇÃO RESIDENCIAL","FUNDO CONSTRUÇÃO LOTEAMENTO","FUNDO CONSTRUÇÃO EMPREENDIMENTO"];
            if (!linhasComImovel.includes(proposal.credit_line) || imoveis.length === 0) return null;
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

          {/* ── Documentos Enviados pelo Cliente (Captação) ── */}
          {(() => {
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

          {/* ── Mensagens da Mesa ── */}
          <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
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
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border space-y-2">
          {contratoStatus !== "idle" && (
            <div className={`text-xs px-3 py-2 rounded-lg ${contratoStatus === "sent" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              {contratoMsg}
            </div>
          )}
          {contratoInfo && (
            <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs ${
              contratoInfo.status === "ASSINADO" ? "bg-emerald-500/10 border border-emerald-500/30" :
              contratoInfo.status === "AGUARDANDO_V3" ? "bg-amber-500/10 border border-amber-500/30" :
              contratoInfo.status === "AGUARDANDO_TESTEMUNHA" ? "bg-purple-500/10 border border-purple-500/30" :
              "bg-blue-500/10 border border-blue-500/30"
            }`}>
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <span className={
                  contratoInfo.status === "ASSINADO" ? "text-emerald-400 font-semibold" :
                  contratoInfo.status === "AGUARDANDO_V3" ? "text-amber-400 font-semibold" :
                  contratoInfo.status === "AGUARDANDO_TESTEMUNHA" ? "text-purple-400 font-semibold" :
                  "text-blue-400 font-semibold"
                }>
                  {contratoInfo.status === "PENDENTE" && "Contrato enviado — aguardando cliente"}
                  {contratoInfo.status === "AGUARDANDO_V3" && `✅ Cliente assinou — aguarda V3 (${contratoInfo.signed_at ? new Date(contratoInfo.signed_at).toLocaleDateString("pt-BR") : ""})`}
                  {contratoInfo.status === "AGUARDANDO_TESTEMUNHA" && `✅ V3 assinou — aguardando testemunha (parceiro)`}
                  {contratoInfo.status === "ASSINADO" && `✅ Contrato finalizado — ${contratoInfo.v3_signer_name ?? ""}`}
                </span>
              </div>
              <a href={`/assinar/${contratoInfo.token}`} target="_blank" rel="noopener noreferrer"
                className="text-muted-foreground hover:text-white underline text-[10px]">
                Ver contrato
              </a>
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
