"use client";

import React, { useState, useEffect } from "react";
import {
  X, User, Building2, CheckCircle2, Clock, ArrowRight, ArrowLeft,
  FileText, CreditCard, Calendar, Link2, Pencil, Check, Edit2,
  Percent, TrendingUp, BadgeDollarSign, Upload, Paperclip, Trash2, Home, ExternalLink,
  Package, Copy, CheckCheck, MessageSquare, Send, Search, AlertTriangle, AlertCircle, ShieldCheck,
  Phone, Mail, MapPin, Banknote, Download, Loader2, Brain, RefreshCw, MessageCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, PLAN_COMMISSION_PCT, ROLE_LABELS, type OperationStatus, type UserRole } from "@/lib/constants";
import { uploadCreditDocument } from "@/lib/credit-documents/upload";
import { CHECKLISTS, DEFAULT_CHECKLIST } from "./nova-proposta-modal";
import { RecomendacaoLinha } from "./recomendacao-linha";

export type MesaComment = {
  id: string;
  text: string;
  author: string;
  created_at: string;
};

// Alíquota de imposto sobre comissões usada como fallback enquanto a alíquota
// global (Configurações → Comissões) não carrega. ISS 2% + PIS 0,65% + COFINS 3%.
const TAXA_IMPOSTOS_COMISSAO_FALLBACK = 5.65;

export const PIPELINE_STAGES = [
  { key: "RECEBIDO", label: "Recebido", color: "text-slate-400", bg: "bg-slate-500/20" },
  { key: "TRIAGEM", label: "Triagem", color: "text-blue-400", bg: "bg-blue-500/20" },
  { key: "ANALISE", label: "Análise de Crédito", color: "text-amber-400", bg: "bg-amber-500/20" },
  { key: "PENDENCIA", label: "Pendência de Docs", color: "text-orange-400", bg: "bg-orange-500/20" },
  { key: "AVALIACAO_IMOVEL", label: "Avaliação de Imóvel", color: "text-cyan-400", bg: "bg-cyan-500/20" },
  { key: "APROVACAO", label: "Em Aprovação", color: "text-purple-400", bg: "bg-purple-500/20" },
  { key: "CONTRATO_ASSINADO", label: "Contrato Assinado", color: "text-indigo-400", bg: "bg-indigo-500/20" },
  { key: "REGISTRO_IMOVEL", label: "Registro de Imóveis", color: "text-teal-400", bg: "bg-teal-500/20" },
  { key: "LIBERADO", label: "Recurso Liberado", color: "text-emerald-400", bg: "bg-emerald-500/20" },
];

// Estágios terminais fora do fluxo linear principal (não fazem parte do
// "avançar/retroceder" sequencial, alcançados a qualquer momento pelos botões
// Reprovar / Declinar) — ainda assim aparecem como colunas próprias no kanban.
export const STAGE_REPROVADO = { key: "REPROVADO", label: "Reprovado", color: "text-red-400", bg: "bg-red-500/20" };
export const STAGE_DECLINADO = { key: "DECLINADO", label: "Declinado (sem aderência)", color: "text-slate-400", bg: "bg-slate-500/20" };

export interface ImovelComparavel {
  titulo: string;
  valor: number;
  area_m2: number;
  preco_m2: number;
  fonte_nome: string;
  fonte_url: string;
}

export interface PesquisaMercado {
  preco_m2_medio: number;
  valor_estimado: number;
  comparaveis: ImovelComparavel[];
  confianca: "ALTA" | "MEDIA" | "BAIXA";
  observacoes?: string;
  buscado_em: string;
}

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
  area_m2?: number;
  pesquisa_mercado?: PesquisaMercado;
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
  /** Plano/role do parceiro (STARTER/PARTNER/PARTNER_PRO/ENTERPRISE) — define o % da comissão do licenciado. */
  partner_role?: string;
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
  instituicao_feedback?: { instituicao: string; status: string; observacao: string; updated_at: string }[] | null;
  // Campos de pendência
  pending_reason?: string | null;
  pending_responsible?: string | null;
  pending_at?: string | null;
  pending_resolved_at?: string | null;
  pending_resolved_by?: string | null;
  reminder_sent_at?: string | null;
  credit_profile_id?: string | null;
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
  /** Proposta criada a partir de um lead de captação, ainda não conferida
   *  pelo partner — some da Mesa de Crédito até onConfirmSendToMesa rodar. */
  pendingCrmReview?: boolean;
  onConfirmSendToMesa?: () => Promise<void> | void;
  /** 14/08/2026: libera o painel "Gerar NDA / Vínculo pela Introdução"
   *  (contract_templates vertical='credito'). Mesmo gate de role do backend
   *  (/api/contracts/generate, /api/contracts/templates): ADMIN/GESTAO/MESA_OPERACIONAL. */
  canGenerateContract?: boolean;
  /** 26/08/2026: estritamente role === "ADMIN" (nunca GESTAO/MESA_OPERACIONAL)
   *  -- libera o botão "Autorizar avanço sem Análise" no gate de Análise de
   *  Crédito. Mesmo critério exigido pelo backend em /api/credit-proposals. */
  isAdmin?: boolean;
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

// ── GenerateUploadLinkButton ── gera link p/ cliente anexar docs do checklist ─
function GenerateUploadLinkButton({ proposalId }: { proposalId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/credit-proposals/upload-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposalId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar link");
      await navigator.clipboard.writeText(json.upload_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar link");
      setTimeout(() => setError(""), 4000);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Gerar link para o cliente anexar os documentos do checklist"
      className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#243A66]/50 border border-[#243A66] text-[#7A8FA8] hover:bg-[#243A66] hover:text-[#F0ECE4] transition-colors text-xs font-semibold disabled:opacity-50"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : copied ? (
        <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Upload className="w-3.5 h-3.5" />
      )}
      {error ? <span className="text-red-400">{error}</span> : copied ? <span className="text-emerald-400">Link copiado!</span> : "Link p/ Documentos"}
    </button>
  );
}

// ── AnaliseCreditoLinkButton ── link de venda da Análise de Crédito vinculado
// a esta proposta (?prop=<code>&ref=<partner> em /analise-v2#configurador).
// O pedido nasce vinculado à proposta assim que o checkout é criado (ver
// app/api/checkout/direct/route.ts), então o badge de status aqui reflete
// isso sem precisar de nenhum passo manual de vínculo.
type AnaliseOrderStatus = { status: string; amount_cents: number | null; paid_at: string | null } | null;

function AnaliseCreditoLinkButton({ proposalId, proposalCode, partnerId, hideBadge }: { proposalId: string; proposalCode: string; partnerId?: string; hideBadge?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const [order, setOrder] = React.useState<AnaliseOrderStatus | "loading">("loading");

  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/credit-proposals/analise-status?proposal_id=${proposalId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setOrder((d.order as AnaliseOrderStatus) ?? null); })
      .catch(() => { if (!cancelled) setOrder(null); });
    return () => { cancelled = true; };
  }, [proposalId]);

  function handleCopy() {
    const params = new URLSearchParams({ prop: proposalCode });
    if (partnerId) params.set("ref", partnerId);
    const url = `https://app.v3partners.com.br/analise-v2?${params.toString()}#configurador`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const badge = order === "loading" || !order
    ? null
    : order.status === "PAID"
    ? { label: `Pago${order.paid_at ? " " + formatDate(order.paid_at) : ""}`, cls: "text-emerald-400" }
    : { label: "Aguardando pagamento", cls: "text-amber-400" };

  return (
    <div className="flex items-center gap-1.5">
      {badge && !hideBadge && <span className={`text-[10px] font-semibold ${badge.cls}`}>{badge.label}</span>}
      <button
        onClick={handleCopy}
        title="Copiar link de Análise de Crédito vinculado a esta proposta"
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
            Link Análise
          </>
        )}
      </button>
    </div>
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
    // doc_id livre: prefixo + timestamp para não colidir com checklist
    const result = await uploadCreditDocument(proposalId, `anexo_${Date.now()}`, file);
    if (!result.ok) {
      setError(result.error);
    } else {
      await load();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
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

// ── Linha do Tempo da Operação ──────────────────────────────────────────────
// Reconstrói entrada/saída de cada etapa a partir de metadata.stage_history
// (que já registra a saída da etapa anterior a cada troca de stage) +
// stage_changed_at (entrada na etapa atual) + created_at (entrada na primeira etapa).
function stageLabelFor(key: string): { label: string; color: string } {
  if (key === "REPROVADO") return STAGE_REPROVADO;
  if (key === "DECLINADO") return STAGE_DECLINADO;
  const found = PIPELINE_STAGES.find(s => s.key === key);
  return found ?? { label: key, color: "text-muted-foreground" };
}

function formatDuracao(ms: number): string {
  if (ms < 0) ms = 0;
  const dias = Math.floor(ms / 86400000);
  const horas = Math.floor((ms % 86400000) / 3600000);
  if (dias === 0 && horas === 0) return "menos de 1h";
  if (dias === 0) return `${horas}h`;
  if (horas === 0) return `${dias}d`;
  return `${dias}d ${horas}h`;
}

interface TimelineEntry {
  stage: string;
  enteredAt: string;
  exitedAt: string | null;
}

function buildStageTimeline(proposal: ProposalFull): TimelineEntry[] {
  const history = (proposal.metadata?.stage_history as { stage: string; exited_at: string }[] | undefined) ?? [];
  const entries: TimelineEntry[] = [];
  let cursor = proposal.created_at;
  for (const h of history) {
    entries.push({ stage: h.stage, enteredAt: cursor, exitedAt: h.exited_at });
    cursor = h.exited_at;
  }
  if (proposal.stage) {
    entries.push({ stage: proposal.stage, enteredAt: cursor, exitedAt: null });
  }
  return entries;
}

function TimelineOperacao({ proposal }: { proposal: ProposalFull }) {
  const entries = buildStageTimeline(proposal);
  if (entries.length === 0) return null;

  const slaOverride = (proposal.metadata?.sla_override as Record<string, string> | undefined) ?? {};
  const isTerminal = proposal.stage === "LIBERADO" || proposal.stage === "REPROVADO" || proposal.stage === "FINALIZADO";
  const inicio = new Date(proposal.created_at).getTime();
  const fim = isTerminal ? new Date(entries[entries.length - 1].enteredAt).getTime() : Date.now();
  const tempoTotal = fim - inicio;

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Linha do Tempo da Operação</p>
      <div className="space-y-0">
        {entries.map((entry, idx) => {
          const { label, color } = stageLabelFor(entry.stage);
          const duracaoMs = (entry.exitedAt ? new Date(entry.exitedAt).getTime() : Date.now()) - new Date(entry.enteredAt).getTime();
          const isUltima = idx === entries.length - 1;
          const target = slaOverride[entry.stage];
          let slaBadge: { text: string; cls: string } | null = null;
          if (target) {
            const deadline = new Date(target + "T23:59:59-03:00").getTime();
            const referencia = entry.exitedAt ? new Date(entry.exitedAt).getTime() : Date.now();
            const noPrazo = referencia <= deadline;
            slaBadge = entry.exitedAt
              ? { text: noPrazo ? "concluído no prazo" : "concluído com atraso", cls: noPrazo ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" : "text-red-400 bg-red-500/10 border-red-500/30" }
              : { text: noPrazo ? `prazo: ${new Date(target + "T12:00:00").toLocaleDateString("pt-BR")}` : "prazo vencido", cls: noPrazo ? "text-amber-400 bg-amber-500/10 border-amber-500/30" : "text-red-400 bg-red-500/10 border-red-500/30" };
          }
          return (
            <div key={`${entry.stage}-${idx}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${isUltima ? "ring-2 ring-offset-2 ring-offset-card" : ""} ${color.replace("text-", "bg-")}`} />
                {!isUltima && <div className="w-px flex-1 bg-border my-0.5" style={{ minHeight: "28px" }} />}
              </div>
              <div className="pb-4 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${color}`}>{label}</span>
                  {slaBadge && (
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${slaBadge.cls}`}>{slaBadge.text}</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {new Date(entry.enteredAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {" · "}
                  {entry.exitedAt ? `durou ${formatDuracao(duracaoMs)}` : `em andamento há ${formatDuracao(duracaoMs)}`}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/40 border border-border mt-1">
        <span className="text-[11px] text-muted-foreground">
          {isTerminal ? "Tempo total da operação" : "Tempo decorrido desde a entrada na esteira"}
        </span>
        <span className="text-xs font-bold text-foreground">{formatDuracao(tempoTotal)}</span>
      </div>
    </div>
  );
}

export function PropostaDetailModal({ open, onClose, proposal, onStageChange, onProposalUpdate, canChangeStage, canEditValorSolicitado, canCompileDocuments, canEditInstituicao, pendingCrmReview, onConfirmSendToMesa, canGenerateContract, isAdmin }: PropostaDetailModalProps) {
  // ── Gate Análise de Crédito (26/08/2026) ─────────────────────────────────
  // Status do pedido de Análise vinculado a esta proposta (?prop=<code> em
  // /analise-v2) -- alimenta a tarja grande na aba Detalhes e o bloqueio do
  // botão Avançar. O bloqueio de verdade é enforced no backend
  // (app/api/credit-proposals/route.ts); isto aqui é só a UI refletindo o
  // mesmo critério pra não deixar o usuário clicar num botão que vai falhar.
  const [analiseOrder, setAnaliseOrder] = useState<{ status: string; paid_at: string | null } | null | "loading">("loading");
  const [autorizandoAvanco, setAutorizandoAvanco] = useState(false);
  const [erroAutorizarAvanco, setErroAutorizarAvanco] = useState<string | null>(null);

  useEffect(() => {
    if (!proposal?.id) { setAnaliseOrder(null); return; }
    let cancelled = false;
    setAnaliseOrder("loading");
    fetch(`/api/credit-proposals/analise-status?proposal_id=${proposal.id}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setAnaliseOrder(d.order ?? null); })
      .catch(() => { if (!cancelled) setAnaliseOrder(null); });
    return () => { cancelled = true; };
  }, [proposal?.id]);

  const analiseOverride = (proposal?.metadata as Record<string, unknown> | undefined)?.analise_gate_override as
    { by_name?: string; at?: string } | undefined;
  const analisePaid = analiseOrder !== "loading" && analiseOrder?.status === "PAID";
  const analiseGateOpen = analisePaid || !!analiseOverride;

  async function handleAutorizarAvanco() {
    if (!proposal) return;
    setAutorizandoAvanco(true);
    setErroAutorizarAvanco(null);
    try {
      const res = await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, metadata: { analise_gate_override: true } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Erro ao autorizar avanço");
      onProposalUpdate?.(proposal.id, { metadata: json.proposal?.metadata ?? proposal.metadata });
    } catch (e) {
      setErroAutorizarAvanco(e instanceof Error ? e.message : "Erro ao autorizar avanço");
    } finally {
      setAutorizandoAvanco(false);
    }
  }

  // ── Gerar NDA / Vínculo pela Introdução (14/08/2026) ────────────────────
  // Mesma UX da Bolsa de Ativos (mesa-capitais-client.tsx: loadContractTemplates
  // + generateContract), reaproveitada aqui pra fechar o gap real reportado
  // por Hamilton (Mesa de Crédito nunca teve nenhum jeito de gerar contrato).
  const [ncndaTemplates, setNcndaTemplates] = useState<{ id: string; template_name: string; approval_status: string }[]>([]);
  const [generatingNcnda, setGeneratingNcnda] = useState(false);
  const [ncndaResult, setNcndaResult] = useState<{ contract_code: string | null; contract_title: string } | null>(null);
  const [ncndaError, setNcndaError] = useState<string | null>(null);

  // ── Enviar NDA pro cliente (17/08/2026) ──────────────────────────────────
  // Não reaproveita o template "NCNDA Mestre" acima — aquele é entre V3/Head
  // da Mesa e intermediários qualificados (vínculo pela introdução), o
  // cliente da proposta nunca entra como parte nele. Este botão usa
  // especificamente o template "NDA (Mesa de operações)" (variáveis
  // nome_cedente/cpf_cnpj_cedente — o cliente É a parte receptora), mesmo
  // template já conectado no botão "Enviar NDA" da Mesa Operacional.
  const [sendingNda, setSendingNda] = useState(false);
  const [ndaSentInfo, setNdaSentInfo] = useState<{ contract_code: string | null } | null>(null);
  const [ndaSendError, setNdaSendError] = useState<string | null>(null);

  async function handleEnviarNda() {
    if (!proposal) return;
    setSendingNda(true);
    setNdaSendError(null);
    try {
      const tpl = ncndaTemplates.find(t => t.template_name.toLowerCase().includes("mesa de opera"));
      if (!tpl) {
        setNdaSendError('Template "NDA (Mesa de operações)" não encontrado na Central de Contratos.');
        return;
      }

      const clientEmail = ((proposal.metadata as Record<string, unknown>)?.email as string | undefined) ?? proposal.email;
      if (!clientEmail) {
        setNdaSendError("Cliente sem e-mail cadastrado — edite a proposta antes de enviar o NDA.");
        return;
      }

      const genRes = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: tpl.id,
          credit_proposal_id: proposal.id,
          extra_data: {
            nome_cedente: proposal.client_name,
            cpf_cnpj_cedente: proposal.client_cpf_cnpj ?? proposal.cpf_cnpj ?? "[CPF/CNPJ]",
            email_cedente: clientEmail,
          },
        }),
      }).then(r => r.json());
      if (genRes.error) { setNdaSendError(genRes.error); return; }

      const sendRes = await fetch(`/api/contracts/${genRes.contract.id}/send`, { method: "POST" }).then(r => r.json());
      if (sendRes.error) {
        setNdaSentInfo({ contract_code: genRes.contract.contract_code ?? null });
        setNdaSendError(sendRes.error);
        return;
      }

      setNdaSentInfo({ contract_code: genRes.contract.contract_code ?? null });
    } catch {
      setNdaSendError("Erro de conexão.");
    } finally {
      setSendingNda(false);
    }
  }

  useEffect(() => {
    if (!open || !proposal || !canGenerateContract) return;
    setNcndaResult(null);
    setNcndaError(null);
    setNdaSentInfo(null);
    setNdaSendError(null);
    fetch("/api/contracts/templates?vertical=credito")
      .then((r) => r.json())
      .then((json) => setNcndaTemplates(json.templates ?? []))
      .catch(() => setNcndaTemplates([]));
  }, [open, proposal?.id, canGenerateContract]);

  async function handleGenerateNcnda(templateId: string) {
    if (!proposal) return;
    setGeneratingNcnda(true);
    setNcndaError(null);
    try {
      const res = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: templateId, credit_proposal_id: proposal.id }),
      });
      const json = await res.json();
      if (res.ok) {
        setNcndaResult({ contract_code: json.contract.contract_code, contract_title: json.contract.contract_title });
      } else {
        setNcndaError(json.error ?? "Erro ao gerar contrato");
      }
    } catch {
      setNcndaError("Erro de conexão");
    } finally {
      setGeneratingNcnda(false);
    }
  }
  const [confirmandoEnvioMesa, setConfirmandoEnvioMesa] = useState(false);
  async function handleConfirmSendToMesa() {
    if (!onConfirmSendToMesa) return;
    setConfirmandoEnvioMesa(true);
    try {
      await onConfirmSendToMesa();
    } finally {
      setConfirmandoEnvioMesa(false);
    }
  }
  // ── Modal tab ─────────────────────────────────────────────────────────────
  type ModalTab = "detalhes" | "recomendacao" | "avaliacao_imovel" | "documentos" | "comentarios" | "analise_ia" | "chat_ia";
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

  // ── Chat IA state ─────────────────────────────────────────────────────────
  interface ChatMessage { role: "user" | "assistant"; content: string; ts: string; }
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Carrega último histórico de chat ao abrir/trocar proposta
  useEffect(() => {
    if (!open || !proposal) return;
    setChatMessages([]);
    setChatInput("");
    setChatSessionId(null);
    fetch(`/api/mesa/chat-deal?proposal_id=${proposal.id}`)
      .then(r => r.json())
      .then((data: { session_id: string | null; messages: ChatMessage[] }) => {
        if (data.messages?.length) {
          setChatMessages(data.messages);
          setChatSessionId(data.session_id);
        }
      })
      .catch(() => {});
  }, [open, proposal?.id]);

  useEffect(() => {
    if (modalTab === "chat_ia") chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, modalTab]);

  async function handleChatSend() {
    if (!chatInput.trim() || chatLoading || !proposal) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim(), ts: new Date().toISOString() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/mesa/chat-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id, message: userMsg.content, session_id: chatSessionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro desconhecido");
      setChatMessages(prev => [...prev, { role: "assistant", content: json.response, ts: new Date().toISOString() }]);
      if (json.session_id) setChatSessionId(json.session_id);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: "assistant", content: `Erro: ${String(e)}`, ts: new Date().toISOString() }]);
    } finally {
      setChatLoading(false);
    }
  }

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

  // ── Relatório Completo (Perfil + OCR + 5C's num único PDF) ──────────────────
  const [gerandoRelatorioCompleto, setGerandoRelatorioCompleto] = useState(false);
  const [erroRelatorioCompleto, setErroRelatorioCompleto] = useState<string>("");

  async function handleRelatorioCompleto() {
    if (!proposal) return;
    setGerandoRelatorioCompleto(true);
    setErroRelatorioCompleto("");
    try {
      const res = await fetch("/api/credit-proposals/relatorio-completo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro desconhecido");
      const bytes = Uint8Array.from(atob(json.pdf_base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `relatorio-completo-${proposal.code}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[RelatorioCompleto]", e);
      setErroRelatorioCompleto(String(e));
    } finally {
      setGerandoRelatorioCompleto(false);
    }
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
  interface OcrDocCheck { documento_esperado: string; documento_encontrado: string; cliente_confere: boolean; resumo_linha: string; status: "ok" | "atencao" | "reprovado"; }
  interface OcrExtratoInfo { banco: string; periodo: string; media_entrada_mensal: number | null; media_entrada_formatada: string; }
  interface OcrResultado { doc_id: string; tipo_documento: string; campos: OcrField[]; resumo: "aprovado" | "atencao" | "reprovado"; observacoes: string; doc_check?: OcrDocCheck; extrato_info?: OcrExtratoInfo; }

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
  const [showDeclinar, setShowDeclinar] = useState(false);
  const [showEscalar, setShowEscalar] = useState(false);
  const [valorAprovado, setValorAprovado] = useState("");
  const [motivoReprovacao, setMotivoReprovacao] = useState("");
  const [motivoDeclinio, setMotivoDeclinio] = useState("");
  const [nivelEscalar, setNivelEscalar] = useState("");
  const [savingAprovacao, setSavingAprovacao] = useState(false);

  async function handleAprovar() {
    if (!proposal || !valorAprovado) return;
    setSavingAprovacao(true);
    try {
      // Aprovar registra a decisão de crédito (status), mas não move a etapa —
      // "Contrato Assinado" só deve ser marcado quando o contrato for realmente
      // assinado (avanço manual pela mesa, refletindo a data real do evento).
      const val = parseFloat(valorAprovado.replace(/\D/g, "")) / 100;
      await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, status: "APPROVED", approved_value: val }),
      });
      onProposalUpdate?.(proposal.id, { status: "APPROVED", approved_value: val });
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
        body: JSON.stringify({ id: proposal.id, status: "REJECTED", stage: "REPROVADO", metadata: newMeta }),
      });
      onProposalUpdate?.(proposal.id, { status: "REJECTED", stage: "REPROVADO", metadata: newMeta as typeof proposal.metadata });
      onStageChange?.(proposal.id, "REPROVADO");
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

  async function handleDeclinar() {
    if (!proposal || !motivoDeclinio.trim()) return;
    setSavingAprovacao(true);
    try {
      const newMeta = { ...(proposal.metadata ?? {}), motivo_declinio: motivoDeclinio };
      await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, status: "CANCELLED", stage: "DECLINADO", metadata: newMeta }),
      });
      onProposalUpdate?.(proposal.id, { status: "CANCELLED", stage: "DECLINADO", metadata: newMeta as typeof proposal.metadata });
      onStageChange?.(proposal.id, "DECLINADO");
      // Notifica o partner
      if (proposal.partner_id) {
        fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: proposal.partner_id,
            title: `⚠️ Proposta ${proposal.code} Declinada`,
            message: `Sua proposta de crédito para ${proposal.client_name} foi declinada por falta de aderência. Motivo: ${motivoDeclinio}`,
            type: "proposal",
            action_url: "/minhas-operacoes",
          }),
        }).catch(() => {});
      }
      setShowDeclinar(false);
      setMotivoDeclinio("");
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
  const [baixandoZip, setBaixandoZip] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);

  // Instituição encaminhada (apenas mesa/admin) — suporta múltiplas
  const INSTITUICOES = [
    "BTG Pactual","Itaú BBA","Bradesco BBI","Santander","Caixa Econômica Federal",
    "Banco do Brasil","Daycoval","Mercantil do Brasil","Omni","Creditas",
    "BV Financeira","Safra","ABC Brasil","Fibra","Oxigênio Capital","Outra",
  ];
  const [instituicoesList, setInstituicoesList] = useState<string[]>([]);
  const [addingInst, setAddingInst] = useState<string>("");
  const [addingInstCustom, setAddingInstCustom] = useState<string>("");
  const [savingInstituicao, setSavingInstituicao] = useState(false);
  const [instituicaoSaved, setInstituicaoSaved] = useState(false);
  const [instituicaoError, setInstituicaoError] = useState<string | null>(null);

  // Estado para envio a securitizadoras parceiras
  const [partnersSecList, setPartnersSecList] = useState<Array<{id: string; display_name: string; active: boolean; has_api_key: boolean; sla_days?: number}>>([]);
  const [loadingPartnersSec, setLoadingPartnersSec] = useState(false);
  const [showPartnerSend, setShowPartnerSend] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("");
  const [sendingToPartner, setSendingToPartner] = useState(false);
  const [partnerSendResult, setPartnerSendResult] = useState<{ok: boolean; msg: string} | null>(null);

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
    setShowPartnerSend(false);
    setSelectedPartnerId("");
    setPartnerSendResult(null);
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
      const result = await uploadCreditDocument(proposal.id, docId, file);
      if (!result.ok) { alert(result.error); return; }
      setCheckedDocs((prev) => ({ ...prev, [docId]: true }));
      setUploadedFiles((prev) => ({
        ...prev,
        [docId]: [...(prev[docId] ?? []), {
          name: file.name,
          url: result.url,
          key: result.fileKey,
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
      const rawOcr = await res.text();
      let json: Record<string, unknown> = {};
      try { json = JSON.parse(rawOcr); } catch {
        throw new Error(`Resposta inválida do servidor: ${rawOcr.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error((json.error as string) ?? "Erro ao validar");
      setOcrResultados(prev => ({ ...prev, [ocrKey]: json.resultado as OcrResultado }));
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
    const docsComArquivo = Object.entries(uploadedFiles).filter(([, files]) => files.some(f => f.url));
    if (docsComArquivo.length === 0) {
      setOcrBatchProgress("Nenhum documento encontrado para analisar.");
      return;
    }

    setOcrBatchLoading(true);

    // Monta mapa de labels do checklist
    const meta = proposal.metadata ?? {};
    const clientType = ((meta.client_type ?? proposal.client_type) === "PJ" ? "PJ" : "PF") as "PF" | "PJ";
    const checklistDocs = portfolioDocs[proposal.credit_line?.toLowerCase()]?.[clientType] ?? CHECKLISTS[proposal.credit_line]?.[clientType] ?? DEFAULT_CHECKLIST[clientType];
    const labelMap: Record<string, string> = {};
    checklistDocs.forEach(d => { labelMap[d.id] = d.label; });

    // Monta contexto da proposta
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

    // Conta total de arquivos
    const totalArquivos = docsComArquivo.reduce((acc, [, files]) => acc + files.filter(f => f.url).length, 0);
    let processados = 0;
    const allResultados: Record<string, OcrResultado> = {};

    try {
      for (const [docId, files] of docsComArquivo) {
        const label = labelMap[docId] ?? docId;
        for (const file of files) {
          if (!file.url) continue;
          processados++;
          setOcrBatchProgress(`Analisando documento ${processados}/${totalArquivos}: ${label}...`);
          const ocrKey = `${docId}::${file.key}`;
          setOcrStatus(prev => ({ ...prev, [ocrKey]: "loading" }));
          try {
            const res = await fetch("/api/ocr-validar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ doc_id: ocrKey, doc_label: label, doc_url: file.url, proposal_context: ctx }),
            });
            const rawText = await res.text();
            let json: Record<string, unknown> = {};
            try { json = JSON.parse(rawText); } catch {
              throw new Error(`Resposta inválida: ${rawText.slice(0, 120)}`);
            }
            if (!res.ok) throw new Error((json.error as string) ?? "Erro ao validar");
            const resultado = json.resultado as OcrResultado;
            allResultados[ocrKey] = resultado;
            setOcrResultados(prev => ({ ...prev, [ocrKey]: resultado }));
            setOcrStatus(prev => ({ ...prev, [ocrKey]: "done" }));
          } catch (e) {
            setOcrStatus(prev => ({ ...prev, [ocrKey]: "error" }));
            setOcrErros(prev => ({ ...prev, [ocrKey]: e instanceof Error ? e.message : "Erro" }));
          }
        }
      }

      // Persiste todos os resultados OCR no metadata
      const newMeta = {
        ...(proposal.metadata ?? {}),
        ocr_resultados: { ...(proposal.metadata?.ocr_resultados as Record<string, unknown> ?? {}), ...allResultados },
        ocr_analyzed_at: new Date().toISOString(),
      };
      onProposalUpdate?.(proposal.id, { metadata: newMeta as typeof proposal.metadata });
      fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, metadata: newMeta }),
      }).catch(() => {});

      // Dispara análise IA
      setOcrBatchProgress("Gerando análise inteligente...");
      try {
        const analyzeRes = await fetch("/api/credit-proposals/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposal_id: proposal.id }),
        });
        const rawAnalyze = await analyzeRes.text();
        let analyzeJson: Record<string, unknown> = {};
        try { analyzeJson = JSON.parse(rawAnalyze); } catch { /* ignora erro de análise */ }
        if (analyzeRes.ok && analyzeJson.analysis) {
          setAnaliseData(analyzeJson.analysis as AnaliseIA);
          setAnalisePdfB64(null);
          setAnaliseStatus("done");
        }
      } catch { /* análise IA é best-effort */ }

      setOcrBatchProgress("");
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

  // Baixa todos os documentos da proposta compactados num .zip só — o
  // navegador salva na pasta de downloads padrão do usuário (não dá pra
  // escolher a pasta local por código, é o próprio navegador quem decide).
  async function baixarTodosZip() {
    if (!proposal) return;
    setBaixandoZip(true);
    setZipError(null);
    try {
      const res = await fetch(`/api/credit-proposals/documents/zip?proposal_id=${proposal.id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Erro ao gerar o arquivo .zip");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${proposal.code ?? "documentos"}-documentos.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setZipError(e instanceof Error ? e.message : "Erro ao gerar o arquivo .zip");
    } finally {
      setBaixandoZip(false);
    }
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
        const clientEmail = (proposal.metadata as Record<string, unknown>)?.email as string | undefined;
        setContratoStatus("sent");
        setContratoMsg(`Contrato enviado para ${clientEmail ?? proposal.email ?? "o cliente"}!`);
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

  // ── Área (m²) inline edit ─────────────────────────────────────────────────
  const [editingAreaIdx, setEditingAreaIdx] = useState<number | null>(null);
  const [areaEditValue, setAreaEditValue] = useState("");
  const [areaSaving, setAreaSaving] = useState(false);

  function startEditArea(idx: number, current: number | undefined) {
    setAreaEditValue(current ? String(current).replace(".", ",") : "");
    setEditingAreaIdx(idx);
  }

  async function saveArea(idx: number) {
    if (!proposal) return;
    setAreaSaving(true);
    const parsed = parseFloat(areaEditValue.replace(",", ".")) || 0;
    const meta = { ...(proposal.metadata ?? {}) };
    const imoveis: ImovelMeta[] = Array.isArray(meta.imoveis) ? meta.imoveis.map((im: ImovelMeta, i: number) =>
      i === idx ? { ...im, area_m2: parsed || undefined } : im
    ) : [];
    meta.imoveis = imoveis;
    try {
      const res = await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, metadata: meta }),
      });
      if (res.ok) {
        setEditingAreaIdx(null);
        onProposalUpdate?.(proposal.id, { metadata: meta as ProposalMeta });
      } else {
        alert("Erro ao salvar área do imóvel.");
      }
    } catch {
      alert("Erro de conexão.");
    } finally {
      setAreaSaving(false);
    }
  }

  // ── Pesquisa de Valor de Mercado (IA + web search) ───────────────────────
  const [searchingMercadoIdx, setSearchingMercadoIdx] = useState<number | null>(null);
  const [mercadoError, setMercadoError] = useState<string | null>(null);

  async function persistImovelPatch(idx: number, patch: Partial<ImovelMeta>) {
    if (!proposal) return null;
    const meta = { ...(proposal.metadata ?? {}) };
    const imoveis: ImovelMeta[] = Array.isArray(meta.imoveis) ? meta.imoveis.map((im: ImovelMeta, i: number) =>
      i === idx ? { ...im, ...patch } : im
    ) : [];
    meta.imoveis = imoveis;
    const res = await fetch("/api/credit-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposal.id, metadata: meta }),
    });
    if (res.ok) {
      onProposalUpdate?.(proposal.id, { metadata: meta as ProposalMeta });
      return meta;
    }
    return null;
  }

  async function pesquisarValorMercado(idx: number, im: ImovelMeta) {
    if (!proposal) return;
    setMercadoError(null);
    setSearchingMercadoIdx(idx);
    try {
      const res = await fetch("/api/credit-proposals/avaliacao-mercado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cep: im.cep, cidade: im.cidade, estado: im.estado, area_m2: im.area_m2 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMercadoError(typeof data.error === "string" ? data.error : "Erro ao pesquisar valor de mercado.");
        return;
      }
      await persistImovelPatch(idx, { pesquisa_mercado: data as PesquisaMercado });
    } catch {
      setMercadoError("Erro de conexão ao pesquisar valor de mercado.");
    } finally {
      setSearchingMercadoIdx(null);
    }
  }

  async function usarComoValorMedio(idx: number, valorEstimado: number) {
    setVmSaving(true);
    try {
      await persistImovelPatch(idx, { valor_medio: valorEstimado });
    } finally {
      setVmSaving(false);
    }
  }

  // ── Aba Avaliação de Imóvel — cadastro do zero e edição de localização ────
  const [addingImovel, setAddingImovel] = useState(false);
  const [editingLocIdx, setEditingLocIdx] = useState<number | null>(null);
  const [locCep, setLocCep] = useState("");
  const [locCidade, setLocCidade] = useState("");
  const [locEstado, setLocEstado] = useState("");
  const [locEndereco, setLocEndereco] = useState("");
  const [locCepLoading, setLocCepLoading] = useState(false);
  const [locSaving, setLocSaving] = useState(false);

  function maskCep(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  }

  async function buscarCep(cep: string) {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return null;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.erro ? null : data as { logradouro: string; bairro: string; localidade: string; uf: string };
    } catch { return null; }
  }

  async function handleLocCepChange(value: string) {
    const masked = maskCep(value);
    setLocCep(masked);
    if (value.replace(/\D/g, "").length === 8) {
      setLocCepLoading(true);
      const addr = await buscarCep(value);
      setLocCepLoading(false);
      if (addr) {
        setLocEndereco(addr.logradouro ? `${addr.logradouro}${addr.bairro ? `, ${addr.bairro}` : ""}` : "");
        setLocCidade(addr.localidade ?? "");
        setLocEstado(addr.uf ?? "");
      }
    }
  }

  function startEditLoc(idx: number, im: ImovelMeta) {
    setLocCep(im.cep ?? "");
    setLocCidade(im.cidade ?? "");
    setLocEstado(im.estado ?? "");
    setLocEndereco(im.endereco ?? "");
    setEditingLocIdx(idx);
  }

  async function saveLoc(idx: number) {
    setLocSaving(true);
    try {
      await persistImovelPatch(idx, {
        cep: locCep || undefined,
        cidade: locCidade || undefined,
        estado: locEstado || undefined,
        endereco: locEndereco || undefined,
      });
      setEditingLocIdx(null);
    } finally {
      setLocSaving(false);
    }
  }

  async function adicionarImovel() {
    if (!proposal) return;
    setAddingImovel(true);
    try {
      const meta = { ...(proposal.metadata ?? {}) };
      const imoveis: ImovelMeta[] = Array.isArray(meta.imoveis) ? [...meta.imoveis] : [];
      imoveis.push({});
      meta.imoveis = imoveis;
      const res = await fetch("/api/credit-proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: proposal.id, metadata: meta }),
      });
      if (res.ok) {
        onProposalUpdate?.(proposal.id, { metadata: meta as ProposalMeta });
        startEditLoc(imoveis.length - 1, {});
      } else {
        alert("Erro ao adicionar imóvel.");
      }
    } catch {
      alert("Erro de conexão.");
    } finally {
      setAddingImovel(false);
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
  // Alíquota global de imposto sobre comissões (Configurações → Comissões)
  const [taxPercent, setTaxPercent] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    fetch("/api/settings/commission-tax")
      .then(r => r.json())
      .then(d => { if (!cancel) setTaxPercent(Number.isFinite(Number(d?.tax_percent)) ? Number(d.tax_percent) : null); })
      .catch(() => { if (!cancel) setTaxPercent(null); });
    return () => { cancel = true; };
  }, [open]);

  // ── Escavador state ──────────────────────────────────────────────────────
  const [escavadorLoading, setEscavadorLoading] = useState(false);
  const [escavadorResult, setEscavadorResult] = useState<EscavadorResult | null>(null);
  const [showEscavador, setShowEscavador] = useState(false);

  // ── Credit Engine state ───────────────────────────────────────────────────
  const [creditLoading, setCreditLoading] = useState(false);
  const [registratoLinkLoading, setRegistratoLinkLoading] = useState(false);
  const [registratoLink, setRegistratoLink] = useState("");
  const [registratoLinkCopied, setRegistratoLinkCopied] = useState(false);
  const [creditResult, setCreditResult] = useState<{ tier: string; score_total: number; spread_min: number; spread_max: number; profile_id: string } | null>(null);
  const [creditError, setCreditError] = useState<string>("");

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
        body: JSON.stringify({ tipo, valor, credit_profile_id: proposal.credit_profile_id }),
      });
      const json = await res.json();
      setEscavadorResult(json);
    } catch {
      setEscavadorResult({ total_processos: 0, match_tipo: null, processos: [], error: "Erro de comunicação com Escavador." });
    } finally {
      setEscavadorLoading(false);
    }
  }

  async function handleCreditAnalysis() {
    if (!proposal) return;
    setCreditLoading(true);
    setCreditResult(null);
    setCreditError("");
    try {
      const res = await fetch("/api/credit-engine/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro no motor de crédito");
      if (!json.success) throw new Error(json.error ?? "Análise não concluída");
      setCreditResult({
        tier: json.tier,
        score_total: json.score_total,
        spread_min: json.spread_min,
        spread_max: json.spread_max,
        profile_id: json.profile_id,
      });
      onProposalUpdate?.(proposal.id, { credit_profile_id: json.profile_id });
    } catch (e) {
      setCreditError(String(e));
    } finally {
      setCreditLoading(false);
    }
  }

  async function handleGenerateRegistratoLink() {
    if (!proposal) return;
    setRegistratoLinkLoading(true);
    setRegistratoLinkCopied(false);
    try {
      const res = await fetch("/api/credit-engine/intake/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposal.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao gerar link");
      setRegistratoLink(json.url);
      await navigator.clipboard.writeText(json.url).catch(() => {});
      setRegistratoLinkCopied(true);
    } catch (e) {
      setCreditError(String(e));
    } finally {
      setRegistratoLinkLoading(false);
    }
  }

  // Sync state when proposal changes
  useEffect(() => {
    if (!proposal) return;
    setShowEdit(false);
    setEscavadorResult(null);
    setShowEscavador(false);
    setCreditResult(null);
    setCreditError("");
    setRegistratoLink("");
    setRegistratoLinkCopied(false);
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

  // Imposto sobre a comissão: alíquota global de Configurações → Comissões.
  // Enquanto o fetch não retorna, usa o fallback histórico (ISS+PIS+COFINS 5,65%).
  const aliquotaImposto = taxPercent ?? TAXA_IMPOSTOS_COMISSAO_FALLBACK;
  const impostoComissao = totalComissao * (aliquotaImposto / 100);
  const comissaoLiquida = totalComissao - impostoComissao;

  // Comissão do licenciado = % do plano contratado pelo parceiro, aplicado
  // sobre a comissão líquida (total bruto − impostos). ENTERPRISE é negociável
  // e não tem percentual fixo, então fica sem valor automático.
  const partnerRole = (proposal.partner_role ?? "") as UserRole;
  const planoComissaoPerc = PLAN_COMMISSION_PCT[partnerRole] ?? null;
  const planoLabel = ROLE_LABELS[partnerRole] ?? (proposal.partner_role || "plano não identificado");
  const comissaoLicenciado = planoComissaoPerc != null ? comissaoLiquida * (planoComissaoPerc / 100) : null;

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

  async function handleAddComment(opts?: { send_email?: boolean; send_chat?: boolean }) {
    if (!proposal || !newComment.trim() || savingComment) return;
    setSavingComment(true);
    try {
      const res = await fetch("/api/credit-proposals/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposal_id: proposal.id,
          text: newComment.trim(),
          send_email: opts?.send_email ?? true,
          send_chat: opts?.send_chat ?? false,
        }),
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

  // FINALIZADO é o rótulo legado usado antes da separação entre Liberado/Reprovado
  const isReprovado = proposal.stage === "REPROVADO" || (proposal.stage === "FINALIZADO" && proposal.status === "REJECTED");
  const isDeclinado = proposal.stage === "DECLINADO" || (proposal.stage === "FINALIZADO" && proposal.status === "CANCELLED");
  const stageParaIndice = proposal.stage === "FINALIZADO" ? "LIBERADO" : (proposal.stage ?? "RECEBIDO");
  const currentStageIdx = PIPELINE_STAGES.findIndex((s) => s.key === stageParaIndice);
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
      <div class="field"><label>Total Bruto</label><span>${fmt(totalComissao)}</span></div>
      <div class="field"><label>Impostos (${aliquotaImposto.toFixed(2)}%)</label><span>- ${fmt(impostoComissao)}</span></div>
      <div class="field"><label>Comissão Líquida</label><span>${fmt(comissaoLiquida)}</span></div>
      <div class="field"><label>Comissão Licenciado (${planoLabel}${planoComissaoPerc != null ? ` · ${planoComissaoPerc}%` : " · negociável"})</label><span>${comissaoLicenciado != null ? fmt(comissaoLicenciado) : "definir manualmente"}</span></div>
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

  function goToPendencia() {
    if (!proposal) return;
    onStageChange?.(proposal.id, "PENDENCIA");
    fetch("/api/credit-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposal.id, stage: "PENDENCIA" }),
    }).catch(() => {});
  }

  const isFinished = activeIdx === PIPELINE_STAGES.length - 1;
  const nextStage = !isFinished ? PIPELINE_STAGES[activeIdx + 1] : null;
  const prevStage = activeIdx > 0 ? PIPELINE_STAGES[activeIdx - 1] : null;

  // Espelha o gate do backend (app/api/credit-proposals/route.ts): avançar
  // pra ANALISE ou além exige Análise de Crédito paga ou autorização de
  // ADMIN. Só desabilita o botão pra não deixar clicar num avanço que o
  // servidor vai recusar — a recusa de verdade é sempre do backend.
  const analiseStageIdx = PIPELINE_STAGES.findIndex((s) => s.key === "ANALISE");
  const advanceBlockedByAnalise = !!nextStage && activeIdx + 1 >= analiseStageIdx && !analiseGateOpen;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60">
      <div className="bg-card border-0 rounded-none w-screen h-screen max-w-none max-h-none flex flex-col animate-fade-in">
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
            {canChangeStage && (
              <button
                onClick={handleRelatorioCompleto}
                disabled={gerandoRelatorioCompleto}
                title="Relatório Completo — Perfil do Cliente + OCR + Análise dos 5C's num único PDF"
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs font-semibold disabled:opacity-50">
                {gerandoRelatorioCompleto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                Relatório Completo
              </button>
            )}
            <button
              onClick={handleExportPDF}
              title="Exportar PDF"
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/20 transition-colors text-xs font-semibold">
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
            <CopyClientLinkButton proposalId={proposal.id} />
            <AnaliseCreditoLinkButton proposalId={proposal.id} proposalCode={proposal.code} partnerId={proposal.partner_id} />
            {(canChangeStage || canEditValorSolicitado) && <GenerateUploadLinkButton proposalId={proposal.id} />}
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {pendingCrmReview && (
          <div className="px-6 py-3 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-400">
                Lead vindo do link de captação — confira os documentos abaixo antes de enviar para a Mesa de Crédito.
              </p>
            </div>
            {onConfirmSendToMesa && (
              <button
                onClick={handleConfirmSendToMesa}
                disabled={confirmandoEnvioMesa}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors text-xs font-bold disabled:opacity-50 flex-shrink-0"
              >
                {confirmandoEnvioMesa ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Confirmar documentos e Enviar para Mesa
              </button>
            )}
          </div>
        )}

        {erroRelatorioCompleto && (
          <div className="px-6 py-2 bg-red-500/10 border-b border-red-500/30">
            <p className="text-xs text-red-400 font-mono break-all">Erro ao gerar Relatório Completo: {erroRelatorioCompleto}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border px-6 gap-1">
          {([
            { id: "detalhes",      label: "Detalhes" },
            { id: "recomendacao",  label: "✦ Recomendação" },
            { id: "avaliacao_imovel", label: "🏠 Avaliação de Imóvel" },
            { id: "documentos",    label: "Documentos" },
            { id: "comentarios",   label: "Comentários" },
            { id: "analise_ia",    label: "🧠 Análise IA" },
            { id: "chat_ia",       label: "💬 Chat IA" },
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
          <div className={modalTab === "documentos" || modalTab === "comentarios" || modalTab === "analise_ia" || modalTab === "chat_ia" || modalTab === "avaliacao_imovel" ? "hidden" : "contents"}>

          {/* ── Tarja Gate Análise de Crédito ── só na aba Detalhes, bem no topo.
              Avançar de etapa (RECEBIDO/TRIAGEM em diante) exige a Análise de
              Crédito do cliente paga, ou autorização explícita de ADMIN — o
              bloqueio de verdade é no backend, isto aqui só deixa o estado
              óbvio antes de tentar. */}
          {modalTab === "detalhes" && analiseOrder !== "loading" && (
            analiseGateOpen ? (
              <div className="rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 px-5 py-4 flex items-center gap-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-emerald-300">
                    {analisePaid ? "Análise de Crédito paga" : "Avanço autorizado sem Análise de Crédito"}
                    {analisePaid && typeof analiseOrder === "object" && analiseOrder?.paid_at ? ` em ${formatDate(analiseOrder.paid_at)}` : ""}
                  </p>
                  <p className="text-xs text-emerald-400/80 mt-0.5">
                    {analisePaid
                      ? "Liberado para avançar de etapa."
                      : `Autorizado por ${analiseOverride?.by_name ?? "ADMIN"}${analiseOverride?.at ? ` em ${formatDate(analiseOverride.at)}` : ""} — a Análise de Crédito do cliente segue pendente de pagamento.`}
                  </p>
                </div>
                <AnaliseCreditoLinkButton proposalId={proposal.id} proposalCode={proposal.code} partnerId={proposal.partner_id} hideBadge />
              </div>
            ) : (
              <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 px-5 py-4 flex items-center gap-4 flex-wrap">
                <AlertTriangle className="w-8 h-8 text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-300">Análise de Crédito do cliente pendente</p>
                  <p className="text-xs text-amber-400/80 mt-0.5">
                    Obrigatória para avançar de etapa. Gere o link, envie pro cliente e aguarde o pagamento — ou peça autorização a um ADMIN.
                  </p>
                  {erroAutorizarAvanco && <p className="text-xs text-red-400 mt-1">{erroAutorizarAvanco}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isAdmin && (
                    <button
                      onClick={handleAutorizarAvanco}
                      disabled={autorizandoAvanco}
                      className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-amber-500/20 border border-amber-500/50 text-amber-300 hover:bg-amber-500/30 transition-colors text-xs font-bold disabled:opacity-50"
                    >
                      {autorizandoAvanco ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Autorizar avanço sem Análise
                    </button>
                  )}
                  <AnaliseCreditoLinkButton proposalId={proposal.id} proposalCode={proposal.code} partnerId={proposal.partner_id} hideBadge />
                </div>
              </div>
            )
          )}

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
            {isReprovado ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10">
                <X className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs font-semibold text-red-400">Operação reprovada</p>
              </div>
            ) : isDeclinado ? (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-500/30 bg-slate-500/10">
                <X className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-xs font-semibold text-slate-400">Operação declinada (sem aderência)</p>
              </div>
            ) : (
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
            )}
          </div>

          {/* ── Linha do Tempo da Operação ── */}
          <TimelineOperacao proposal={proposal} />

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
                  {canChangeStage && !proposal.credit_profile_id && !creditResult && (
                    <button
                      onClick={handleCreditAnalysis}
                      disabled={creditLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creditLoading
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Brain className="w-3 h-3" />}
                      {creditLoading ? "Analisando..." : "Analisar Crédito"}
                    </button>
                  )}
                  <button
                    onClick={handleGenerateRegistratoLink}
                    disabled={registratoLinkLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {registratoLinkLoading
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : registratoLinkCopied
                        ? <CheckCheck className="w-3 h-3" />
                        : <Link2 className="w-3 h-3" />}
                    {registratoLinkLoading ? "Gerando..." : registratoLinkCopied ? "Link copiado!" : "Gerar Link Registrato"}
                  </button>
                  </div>
                </div>

                {registratoLink && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                    <Link2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1">{registratoLink}</span>
                    <button
                      onClick={async () => { await navigator.clipboard.writeText(registratoLink).catch(() => {}); setRegistratoLinkCopied(true); }}
                      className="text-emerald-400 hover:text-emerald-300 flex-shrink-0"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                )}

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

                {/* Enviar para Securitizadora — apenas mesa/admin */}
                {canEditInstituicao && proposal && (
                  <div className="p-4 rounded-xl border border-[#243A66] bg-[#09081A]/50 space-y-3">
                    <p className="text-xs font-semibold text-[#9BAFC5] uppercase tracking-wider flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5 text-[#C9A84C]" /> Encaminhar para Securitizadora
                    </p>
                    {!showPartnerSend ? (
                      <button
                        onClick={async () => {
                          setShowPartnerSend(true);
                          setPartnerSendResult(null);
                          if (partnersSecList.length === 0) {
                            setLoadingPartnersSec(true);
                            try {
                              const r = await fetch("/api/integrations");
                              if (r.ok) {
                                const d = await r.json() as { partners?: typeof partnersSecList };
                                setPartnersSecList(d.partners ?? []);
                              }
                            } finally {
                              setLoadingPartnersSec(false);
                            }
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 border border-[#C9A84C]/25 text-[#C9A84C] text-xs font-semibold transition-colors"
                      >
                        <Send className="w-3 h-3" /> Enviar para Parceiro
                      </button>
                    ) : (
                      <div className="space-y-3">
                        {loadingPartnersSec ? (
                          <p className="text-xs text-[#9BAFC5] flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando parceiros...
                          </p>
                        ) : (
                          <>
                            <select
                              value={selectedPartnerId}
                              onChange={(e) => { setSelectedPartnerId(e.target.value); setPartnerSendResult(null); }}
                              className="w-full h-8 px-3 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                            >
                              <option value="">Selecionar parceiro...</option>
                              {partnersSecList.map(p => (
                                <option key={p.id} value={p.id} disabled={!p.has_api_key}>
                                  {p.display_name}{!p.has_api_key ? " — Aguardando configuração" : ""}
                                </option>
                              ))}
                            </select>
                            {partnerSendResult && (
                              <p className={`text-xs px-3 py-2 rounded-lg border ${partnerSendResult.ok ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                                {partnerSendResult.msg}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  if (!selectedPartnerId || !proposal) return;
                                  setSendingToPartner(true);
                                  setPartnerSendResult(null);
                                  try {
                                    const r = await fetch(`/api/credit-proposals/${proposal.id}/submit-partner`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ partner_id: selectedPartnerId }),
                                    });
                                    const d = await r.json() as { error?: string };
                                    if (r.ok) {
                                      const pName = partnersSecList.find(p => p.id === selectedPartnerId)?.display_name ?? selectedPartnerId;
                                      setPartnerSendResult({ ok: true, msg: `Proposta enviada para ${pName}.` });
                                      if (!instituicoesList.includes(pName)) {
                                        const updated = [...instituicoesList, pName];
                                        setInstituicoesList(updated);
                                        onProposalUpdate?.(proposal.id, { instituicao_encaminhada: JSON.stringify(updated) });
                                      }
                                      setShowPartnerSend(false);
                                      setSelectedPartnerId("");
                                    } else {
                                      setPartnerSendResult({ ok: false, msg: d.error ?? "Erro ao enviar proposta." });
                                    }
                                  } catch {
                                    setPartnerSendResult({ ok: false, msg: "Erro de conexão." });
                                  } finally {
                                    setSendingToPartner(false);
                                  }
                                }}
                                disabled={!selectedPartnerId || sendingToPartner}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold disabled:opacity-50 transition-colors"
                              >
                                {sendingToPartner ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                {sendingToPartner ? "Enviando..." : "Confirmar Envio"}
                              </button>
                              <button
                                onClick={() => { setShowPartnerSend(false); setSelectedPartnerId(""); setPartnerSendResult(null); }}
                                className="px-3 py-1.5 rounded-lg bg-[#243A66]/50 hover:bg-[#243A66] text-[#9BAFC5] text-xs font-semibold transition-colors"
                              >
                                Cancelar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Parecer das Instituições ── */}
          {(() => {
            const feedbacks = proposal.instituicao_feedback;
            if (!feedbacks || feedbacks.length === 0) return null;
            const fbStatusLabel: Record<string, { label: string; color: string }> = {
              EM_ANALISE:     { label: "Em Análise",           color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
              DOCS_PENDENTES: { label: "Documentos Pendentes", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
              PRE_APROVADO:   { label: "Pré-Aprovado",         color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
              REPROVADO:      { label: "Reprovado",            color: "bg-red-500/10 text-red-400 border-red-500/30" },
            };
            return (
              <div className="p-4 rounded-xl border border-[#C9A84C]/25 bg-[#C9A84C]/5 space-y-3">
                <p className="text-xs font-semibold text-[#C9A84C] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Parecer das Instituições
                </p>
                <div className="space-y-2">
                  {feedbacks.map((fb, i) => {
                    const fbInfo = fbStatusLabel[fb.status] ?? { label: fb.status, color: "bg-secondary text-muted-foreground border-border" };
                    return (
                      <div key={i} className="bg-secondary/40 border border-border rounded-lg p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground">{fb.instituicao}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${fbInfo.color}`}>{fbInfo.label}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(fb.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                        {fb.observacao && (
                          <p className="text-xs text-muted-foreground leading-relaxed">{fb.observacao}</p>
                        )}
                      </div>
                    );
                  })}
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

          {/* ── Credit Engine Results ── */}
          {canChangeStage && (creditResult || proposal.credit_profile_id || creditError) && (
            <div className="p-4 rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 space-y-3">
              <p className="text-xs font-semibold text-[#C9A84C] flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> Análise de Crédito — Motor V3
              </p>
              {creditError ? (
                <div className="flex items-center gap-2 py-2 text-red-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs">{creditError}</span>
                </div>
              ) : creditResult ? (
                <div className="space-y-2">
                  <div className={`flex items-center gap-3 p-3 rounded-lg border ${
                    creditResult.tier === "A" ? "bg-emerald-500/10 border-emerald-500/30"
                    : creditResult.tier === "B" ? "bg-teal-500/10 border-teal-500/30"
                    : creditResult.tier === "C" ? "bg-amber-500/10 border-amber-500/30"
                    : creditResult.tier === "D" ? "bg-orange-500/10 border-orange-500/30"
                    : "bg-red-500/10 border-red-500/30"
                  }`}>
                    <span className={`text-2xl font-black ${
                      creditResult.tier === "A" ? "text-emerald-400"
                      : creditResult.tier === "B" ? "text-teal-400"
                      : creditResult.tier === "C" ? "text-amber-400"
                      : creditResult.tier === "D" ? "text-orange-400"
                      : "text-red-400"
                    }`}>{creditResult.tier}</span>
                    <div>
                      <p className="text-xs font-bold text-foreground">Score {creditResult.score_total}/1000</p>
                      <p className="text-[10px] text-muted-foreground">
                        Spread estimado: CDI + {creditResult.spread_min.toFixed(1)}% a {creditResult.spread_max.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">
                    Profile: {creditResult.profile_id}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Análise registrada.{" "}
                  <span className="font-mono text-[10px]">ID: {proposal.credit_profile_id}</span>
                </p>
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
                <span className="text-muted-foreground">
                  Impostos ({aliquotaImposto.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)
                  {taxPercent == null && <span className="text-[10px] text-muted-foreground/60"> · padrão</span>}
                </span>
                <span className="text-red-400">− {formatCurrency(impostoComissao)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Comissão Líquida (Bruto − Impostos)</span>
                <span className="font-semibold text-amber-300">{formatCurrency(comissaoLiquida)}</span>
              </div>
            </div>

            {/* Campo 3 — Comissão Licenciado (% do plano contratado sobre a líquida) */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <span className="text-xs font-semibold text-emerald-400">
                Comissão Licenciado
                <span className="text-[10px] font-normal text-emerald-400/70">
                  {" "}({planoLabel}{planoComissaoPerc != null ? ` · ${planoComissaoPerc}% da líquida` : " · negociável"})
                </span>
              </span>
              <span className="text-sm font-bold text-emerald-400">
                {comissaoLicenciado != null ? formatCurrency(comissaoLicenciado) : "definir manualmente"}
              </span>
            </div>
            {!proposal.partner_id && (
              <p className="text-[10px] text-amber-400/80 text-center italic">Proposta sem parceiro vinculado — comissão do licenciado não se aplica.</p>
            )}

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

          {/* ── Aba Avaliação de Imóvel ── */}
          {modalTab === "avaliacao_imovel" && (() => {
            const meta = proposal.metadata ?? {};
            const imoveis: ImovelMeta[] = (meta.imoveis && meta.imoveis.length > 0)
              ? meta.imoveis
              : (proposal.imovel_cidade || proposal.imovel_endereco)
                ? [{ endereco: proposal.imovel_endereco, valor_medio: proposal.imovel_valor_medio, cidade: proposal.imovel_cidade, estado: proposal.imovel_estado }]
                : [];
            return (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5" /> Imóveis em Garantia {imoveis.length > 0 ? `(${imoveis.length})` : ""}
                </p>

                {imoveis.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-border rounded-xl">
                    <Home className="w-8 h-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground mb-3">Nenhum imóvel cadastrado nesta proposta.</p>
                    <button
                      onClick={adicionarImovel}
                      disabled={addingImovel}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-semibold hover:bg-amber-500/25 transition-colors disabled:opacity-50"
                    >
                      {addingImovel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Home className="w-3.5 h-3.5" />}
                      Adicionar Imóvel
                    </button>
                  </div>
                )}

                {imoveis.map((im, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Imóvel {imoveis.length > 1 ? `#${idx + 1}` : ""}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">

                      {/* ── Localização (CEP / cidade / estado / endereço) — editável ── */}
                      <div className="col-span-2 pb-1.5 border-b border-amber-500/20">
                        {editingLocIdx === idx ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text" inputMode="numeric" placeholder="CEP"
                                value={locCep}
                                onChange={e => handleLocCepChange(e.target.value)}
                                className="w-28 h-7 px-2 text-xs bg-secondary border border-amber-500/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                autoFocus
                              />
                              {locCepLoading && <Loader2 className="w-3 h-3 animate-spin text-amber-400 flex-shrink-0" />}
                              <input
                                type="text" placeholder="Cidade"
                                value={locCidade}
                                onChange={e => setLocCidade(e.target.value)}
                                className="flex-1 h-7 px-2 text-xs bg-secondary border border-amber-500/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                              />
                              <input
                                type="text" placeholder="UF" maxLength={2}
                                value={locEstado}
                                onChange={e => setLocEstado(e.target.value.toUpperCase())}
                                className="w-14 h-7 px-2 text-xs bg-secondary border border-amber-500/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text" placeholder="Endereço (rua, número, bairro)"
                                value={locEndereco}
                                onChange={e => setLocEndereco(e.target.value)}
                                className="flex-1 h-7 px-2 text-xs bg-secondary border border-amber-500/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                              />
                              <button
                                onClick={() => saveLoc(idx)}
                                disabled={locSaving}
                                className="h-7 px-2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition-colors"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingLocIdx(null)}
                                className="h-7 px-2 rounded border border-border text-muted-foreground hover:text-white transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-foreground">
                                {(im.endereco || im.cidade || im.cep) ? (
                                  <>
                                    {im.endereco}{im.endereco && (im.cidade || im.cep) ? " — " : ""}
                                    {[im.cidade, im.estado].filter(Boolean).join("/")}
                                    {im.cep && <span className="text-muted-foreground"> · CEP {im.cep}</span>}
                                  </>
                                ) : <span className="text-muted-foreground italic">localização não informada</span>}
                              </span>
                            </div>
                            <button
                              onClick={() => startEditLoc(idx, im)}
                              className="p-0.5 rounded hover:bg-amber-500/15 text-muted-foreground hover:text-amber-400 transition-colors flex-shrink-0"
                              title="Editar localização"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

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
                      <div className="col-span-2 pt-1.5 border-t border-amber-500/20">
                        {editingAreaIdx === idx ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">Área (m²)</span>
                            <div className="flex-1 flex items-center gap-1.5">
                              <input
                                type="text" inputMode="decimal"
                                value={areaEditValue}
                                onChange={e => setAreaEditValue(e.target.value.replace(/[^0-9,]/g, ""))}
                                className="w-full h-7 px-2 text-xs bg-secondary border border-amber-500/50 rounded text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                                autoFocus
                              />
                              <button
                                onClick={() => saveArea(idx)}
                                disabled={areaSaving}
                                className="h-7 px-2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition-colors"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingAreaIdx(null)}
                                className="h-7 px-2 rounded border border-border text-muted-foreground hover:text-white transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Área do Imóvel</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-foreground">
                                {im.area_m2 ? `${im.area_m2.toLocaleString("pt-BR")} m²` : <span className="text-muted-foreground italic">não informado</span>}
                              </span>
                              <button
                                onClick={() => startEditArea(idx, im.area_m2)}
                                className="p-0.5 rounded hover:bg-amber-500/15 text-muted-foreground hover:text-amber-400 transition-colors"
                                title="Editar área do imóvel"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Pesquisa de Valor de Mercado (IA + web search) ── */}
                      <div className="col-span-2 pt-1.5 border-t border-amber-500/20 space-y-2">
                        <button
                          onClick={() => pesquisarValorMercado(idx, im)}
                          disabled={searchingMercadoIdx === idx || !im.area_m2 || !(im.cep || (im.cidade && im.estado))}
                          title={!im.area_m2 || !(im.cep || (im.cidade && im.estado)) ? "Preencha CEP (ou cidade/estado) e área do imóvel" : undefined}
                          className="w-full h-7 px-2 rounded border border-amber-500/40 text-amber-400 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {searchingMercadoIdx === idx ? (
                            <><Loader2 className="w-3 h-3 animate-spin" /> Pesquisando comparáveis na região...</>
                          ) : (
                            <><Search className="w-3 h-3" /> {im.pesquisa_mercado ? "Pesquisar Novamente" : "Pesquisar Valor de Mercado"}</>
                          )}
                        </button>

                        {mercadoError && searchingMercadoIdx === null && (
                          <p className="text-[10px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {mercadoError}</p>
                        )}

                        {im.pesquisa_mercado && (
                          <div className="p-2.5 rounded-lg bg-cyan-500/5 border border-cyan-500/25 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                                Valor de Mercado Estimado
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                im.pesquisa_mercado.confianca === "ALTA" ? "bg-emerald-500/20 text-emerald-400"
                                : im.pesquisa_mercado.confianca === "MEDIA" ? "bg-amber-500/20 text-amber-400"
                                : "bg-red-500/20 text-red-400"
                              }`}>
                                Confiança {im.pesquisa_mercado.confianca}
                              </span>
                            </div>

                            {im.pesquisa_mercado.comparaveis.length > 0 ? (
                              <>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">R$/m² médio da região</span>
                                  <span className="font-semibold text-foreground">{formatCurrency(im.pesquisa_mercado.preco_m2_medio)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs text-muted-foreground">Valor estimado ({im.area_m2}m²)</span>
                                  <span className="text-sm font-black text-cyan-300">{formatCurrency(im.pesquisa_mercado.valor_estimado)}</span>
                                </div>

                                <div className="space-y-1 pt-1 border-t border-cyan-500/15">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase">Comparáveis encontrados</p>
                                  {im.pesquisa_mercado.comparaveis.map((c, ci) => (
                                    <a
                                      key={ci}
                                      href={c.fonte_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground hover:text-cyan-400 transition-colors group"
                                    >
                                      <span className="truncate flex-1">
                                        {c.titulo} <span className="text-muted-foreground/70">— {c.fonte_nome}</span>
                                      </span>
                                      <span className="shrink-0 font-medium">
                                        {formatCurrency(c.valor)} ({c.area_m2}m² · {formatCurrency(c.preco_m2)}/m²)
                                      </span>
                                      <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </a>
                                  ))}
                                </div>

                                <button
                                  onClick={() => usarComoValorMedio(idx, im.pesquisa_mercado!.valor_estimado)}
                                  disabled={vmSaving}
                                  className="w-full h-7 px-2 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[11px] font-semibold hover:bg-cyan-500/30 transition-colors disabled:opacity-40"
                                >
                                  Usar como Valor Médio de Avaliação
                                </button>
                              </>
                            ) : (
                              <p className="text-[10px] text-muted-foreground italic">Nenhum comparável válido encontrado para a região.</p>
                            )}

                            {im.pesquisa_mercado.observacoes && (
                              <p className="text-[10px] text-muted-foreground italic">{im.pesquisa_mercado.observacoes}</p>
                            )}
                            <p className="text-[9px] text-muted-foreground/70">
                              Pesquisado em {new Date(im.pesquisa_mercado.buscado_em).toLocaleString("pt-BR")}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {imoveis.length > 0 && (
                  <button
                    onClick={adicionarImovel}
                    disabled={addingImovel}
                    className="w-full h-8 px-3 rounded-lg border border-dashed border-amber-500/40 text-amber-400 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                  >
                    {addingImovel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Home className="w-3.5 h-3.5" />}
                    Adicionar outro imóvel
                  </button>
                )}
              </div>
            );
          })()}

          {/* ── Upload livre de documentos (partner e admin) ── */}
          {modalTab === "documentos" && (
            <PartnerDocUpload proposalId={proposal.id} />
          )}

          {/* ── Gerar NDA / Vínculo pela Introdução (14/08/2026) ── */}
          {modalTab === "documentos" && canGenerateContract && (
            <div className="p-4 rounded-xl border border-[#C9A84C]/20 bg-[#12112A] space-y-2">
              <p className="text-xs font-semibold text-[#C9A84C] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Gerar NDA / Vínculo pela Introdução
              </p>
              <p className="text-[10px] text-muted-foreground">
                Gera a minuta em rascunho na Central de Contratos. Depois, use "Gerar Link de Qualificação"
                lá (Contratos e Minutas) para qualificar intermediários/mandatários e enviar para assinatura.
              </p>
              {ncndaTemplates.length === 0 && (
                <p className="text-[10px] text-amber-400">Nenhuma minuta ativa para vertical "credito" encontrada.</p>
              )}
              {ncndaTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleGenerateNcnda(t.id)}
                  disabled={generatingNcnda}
                  className="w-full flex items-center gap-2 px-3 py-2 bg-[#162744] border border-[#9BAFC5]/10 rounded-md text-[#F5F1E8] text-[11px] font-medium hover:border-[#C9A84C]/30 transition disabled:opacity-50"
                >
                  {generatingNcnda ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-[#C9A84C]" />}
                  {t.template_name}
                </button>
              ))}
              {ncndaResult && (
                <p className="text-[10px] text-emerald-400">
                  Gerado: {ncndaResult.contract_code ?? ncndaResult.contract_title}. Vá em Central de Contratos &gt; Contratos e Minutas para qualificar as partes e enviar.
                </p>
              )}
              {ncndaError && <p className="text-[10px] text-red-400">{ncndaError}</p>}
            </div>
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
                                const checkCor = r.doc_check?.status === "ok" ? "emerald" : r.doc_check?.status === "atencao" ? "amber" : "red";
                              return (
                                <div className={`rounded-lg border p-2.5 space-y-2 bg-${resumoCor}-500/5 border-${resumoCor}-500/20`}>

                                  {/* ── Linha de check do documento ── */}
                                  {r.doc_check && (
                                    <div className={`flex items-center justify-between px-2 py-1.5 rounded-md bg-${checkCor}-500/10 border border-${checkCor}-500/25`}>
                                      <span className={`text-[11px] font-semibold text-${checkCor}-400`}>
                                        {r.doc_check.resumo_linha}
                                      </span>
                                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-${checkCor}-500/20 text-${checkCor}-400 uppercase tracking-wide`}>
                                        {r.doc_check.status}
                                      </span>
                                    </div>
                                  )}

                                  {/* ── Dados do extrato bancário ── */}
                                  {r.extrato_info && (
                                    <div className="flex items-center gap-3 px-2 py-1.5 rounded-md bg-[#C9A84C]/8 border border-[#C9A84C]/25">
                                      <div className="flex-1 min-w-0">
                                        <span className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider block">Banco / Instituição</span>
                                        <span className="text-[11px] font-semibold text-foreground">{r.extrato_info.banco}</span>
                                        {r.extrato_info.periodo && (
                                          <span className="text-[9px] text-muted-foreground ml-2">{r.extrato_info.periodo}</span>
                                        )}
                                      </div>
                                      {r.extrato_info.media_entrada_formatada && (
                                        <div className="text-right flex-shrink-0">
                                          <span className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider block">Média de Entrada</span>
                                          <span className="text-[12px] font-bold text-emerald-400">{r.extrato_info.media_entrada_formatada}</span>
                                          <span className="text-[8px] text-muted-foreground block">/mês</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* ── Header status geral ── */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                      {r.tipo_documento}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-${resumoCor}-500/20 text-${resumoCor}-400`}>
                                      {resumoIcon} {r.resumo.toUpperCase()}
                                    </span>
                                  </div>

                                  {/* ── Campos extraídos ── */}
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
                {/* ── Resumo consolidado de extratos bancários ── */}
                {(() => {
                  const extratosResumo = (proposal.metadata as Record<string, unknown>)?.extratos_resumo as Array<{
                    banco: string; periodos: string; media_entrada_formatada: string | null; quantidade_extratos: number;
                  }> | undefined;
                  if (!extratosResumo?.length) return null;
                  return (
                    <div className="mt-3 rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-3">
                      <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider mb-2">
                        Resumo de Extratos Bancários
                      </p>
                      <div className="space-y-2">
                        {extratosResumo.map((e, i) => (
                          <div key={i} className="flex items-center justify-between py-1 border-b border-[#C9A84C]/15 last:border-0">
                            <div>
                              <span className="text-[11px] font-semibold text-foreground">{e.banco}</span>
                              {e.periodos && <span className="text-[9px] text-muted-foreground ml-2">{e.periodos}</span>}
                              <span className="text-[9px] text-muted-foreground ml-2">({e.quantidade_extratos} extrato{e.quantidade_extratos !== 1 ? "s" : ""})</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] text-muted-foreground block">Média de Entrada</span>
                              <span className="text-[12px] font-bold text-emerald-400">
                                {e.media_entrada_formatada ?? "—"}
                              </span>
                              <span className="text-[8px] text-muted-foreground">/mês</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

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
              <div className="space-y-2 pt-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleAddComment(); } }}
                  placeholder="Escreva uma mensagem para o partner... (Ctrl+Enter para enviar)"
                  rows={2}
                  className="w-full text-xs px-3 py-2 bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddComment({ send_email: true })}
                    disabled={!newComment.trim() || savingComment}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                    style={{ background: "#C9A84C", color: "#09081A" }}
                  >
                    {savingComment
                      ? <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : <Send className="w-3 h-3" />}
                    Comentar
                  </button>
                  <button
                    onClick={() => handleAddComment({ send_email: true, send_chat: false })}
                    disabled={!newComment.trim() || savingComment}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                    style={{ background: "#162744", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.4)" }}
                  >
                    <Mail className="w-3 h-3" />
                    + E-mail
                  </button>
                  <button
                    onClick={() => handleAddComment({ send_email: false, send_chat: true })}
                    disabled={!newComment.trim() || savingComment}
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40"
                    style={{ background: "#162744", color: "#C9A84C", border: "1px solid rgba(201,168,76,0.4)" }}
                  >
                    <MessageCircle className="w-3 h-3" />
                    + Chat
                  </button>
                </div>
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

          {/* ── Aba Chat IA ── */}
          {modalTab === "chat_ia" && (
            <div className="flex flex-col h-[520px]">
              {/* Header */}
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <MessageCircle className="w-4 h-4" style={{ color: "#C9A84C" }} />
                <p className="text-sm font-bold text-white">Chat IA — Análise do Cliente</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C9A84C]/15 text-[#E8C97A] font-semibold">
                  {proposal.client_name}
                </span>
                {(() => {
                  const ocrCount = Object.keys((proposal.metadata?.ocr_resultados as Record<string, unknown>) ?? {}).length;
                  return ocrCount > 0 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
                      {ocrCount} doc{ocrCount > 1 ? "s" : ""} OCR no contexto
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#243A66]/60 text-[#7A8FA8] font-semibold">
                      Sem OCR — rode na aba Documentos
                    </span>
                  );
                })()}
              </div>

              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
                    <MessageCircle className="w-10 h-10 text-[#C9A84C]/30" />
                    <p className="text-xs text-[#7A8FA8] text-center max-w-xs">
                      Pergunte sobre o cliente, riscos, documentação, resultados OCR ou linha de crédito recomendada.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {[
                        "Qual o risco desta operação?",
                        "Os documentos OCR conferem com o declarado?",
                        "Qual linha de crédito indica?",
                        "Há divergências nos documentos analisados?",
                      ].map(s => (
                        <button
                          key={s}
                          onClick={() => { setChatInput(s); }}
                          className="text-[10px] px-2.5 py-1.5 rounded-lg border border-[#C9A84C]/30 text-[#E8C97A] hover:bg-[#C9A84C]/10 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] px-3 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                        msg.role === "user"
                          ? "bg-[#C9A84C]/15 text-[#F0ECE4] rounded-br-sm"
                          : "bg-[#162744] text-[#F0ECE4] rounded-bl-sm"
                      }`}
                      style={{ border: msg.role === "user" ? "1px solid rgba(201,168,76,0.25)" : "1px solid rgba(255,255,255,0.06)" }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="px-3 py-2.5 rounded-xl bg-[#162744] border border-white/6 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
                      <span className="text-[10px] text-[#7A8FA8]">Analisando…</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2 flex-shrink-0">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                  placeholder="Pergunte sobre o cliente, OCR dos documentos, risco, linha de crédito..."
                  disabled={chatLoading}
                  className="flex-1 h-9 px-3 text-sm rounded-lg outline-none disabled:opacity-50"
                  style={{ background: "#162744", border: "1px solid rgba(201,168,76,0.2)", color: "#F0ECE4" }}
                />
                <button
                  onClick={handleChatSend}
                  disabled={chatLoading || !chatInput.trim()}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)" }}
                >
                  <Send className="w-4 h-4" style={{ color: "#C9A84C" }} />
                </button>
              </div>
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
            {canChangeStage && (() => {
              const hasEmail = !!((proposal.metadata as Record<string, unknown>)?.email as string | undefined);
              return (
                <div title={!hasEmail ? "Cadastre o e-mail do cliente antes de enviar o contrato" : undefined}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEnviarContrato}
                    disabled={sendingContrato || !hasEmail}
                    className="gap-1.5 border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sendingContrato ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Enviar Contrato
                  </Button>
                </div>
              );
            })()}
            {canGenerateContract && (() => {
              const hasEmail = !!(((proposal.metadata as Record<string, unknown>)?.email as string | undefined) ?? proposal.email);
              return (
                <div title={!hasEmail ? "Cadastre o e-mail do cliente antes de enviar o NDA" : ndaSentInfo ? `NDA gerado: ${ndaSentInfo.contract_code ?? ""}` : undefined}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEnviarNda}
                    disabled={sendingNda || !hasEmail || !!ndaSentInfo}
                    className="gap-1.5 border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {sendingNda ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    {ndaSentInfo ? "NDA enviado" : "Enviar NDA"}
                  </Button>
                  {ndaSendError && <p className="text-[10px] text-red-400 mt-1 max-w-xs">{ndaSendError}</p>}
                </div>
              );
            })()}
          </div>
          {canChangeStage && activeIdx > 0 && prevStage && !isEmAprovacao && (
            <Button size="sm" variant="outline" onClick={goBack} className="gap-2 border-border text-muted-foreground hover:text-white">
              <ArrowLeft className="w-4 h-4" />
              Retroceder para <span className={prevStage.color}>{prevStage.label}</span>
            </Button>
          )}
          {canChangeStage && proposal?.stage !== "PENDENCIA" && !isFinished && !isEmAprovacao && (
            <Button
              size="sm"
              variant="outline"
              onClick={goToPendencia}
              className="gap-2 border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
            >
              <AlertTriangle className="w-4 h-4" />
              Pendência de Docs
            </Button>
          )}
          {canChangeStage && !isFinished && nextStage && !isEmAprovacao && (
            <div title={advanceBlockedByAnalise ? "Bloqueado: Análise de Crédito do cliente pendente de pagamento (peça autorização a um ADMIN se necessário)" : undefined}>
              <Button size="sm" onClick={advance} disabled={advanceBlockedByAnalise} className="gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                Avançar para <span className={nextStage.color}>{nextStage.label}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
          {/* ── Pular Registro de Imóveis quando não aplicável (ex: crédito sem garantia real) ── */}
          {canChangeStage && proposal?.stage === "REGISTRO_IMOVEL" && (
            <Button size="sm" variant="outline" onClick={() => onStageChange?.(proposal!.id, "LIBERADO")}
              className="gap-1.5 border-border text-muted-foreground hover:text-white">
              <ArrowRight className="w-3.5 h-3.5" /> Não aplicável — pular para Liberado
            </Button>
          )}
          {/* ── Botão Reprovar — disponível em qualquer estágio ── */}
          {canChangeStage && !isFinished && proposal?.status !== "REJECTED" && (
            <Button size="sm" variant="outline" onClick={() => setShowReprovar(true)}
              className="gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10">
              <X className="w-3.5 h-3.5" /> Reprovar
            </Button>
          )}
          {/* ── Botão Declinar (sem aderência) — disponível em qualquer estágio ── */}
          {canChangeStage && !isFinished && proposal?.status !== "REJECTED" && proposal?.status !== "CANCELLED" && (
            <Button size="sm" variant="outline" onClick={() => setShowDeclinar(true)}
              className="gap-1.5 border-slate-500/40 text-slate-400 hover:bg-slate-500/10">
              <X className="w-3.5 h-3.5" /> Declinar (sem aderência)
            </Button>
          )}
          {/* ── Botão Aprovar — disponível em qualquer estágio ── */}
          {canChangeStage && !isFinished && proposal?.status !== "APPROVED" && proposal?.status !== "REJECTED" && (
            <div className="flex items-center gap-2 flex-wrap">
              {isEmAprovacao && proximosNiveis.length > 0 && (
                <Button size="sm" variant="outline" onClick={() => setShowEscalar(true)}
                  className="gap-1.5 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
                  <ArrowRight className="w-3.5 h-3.5" /> Escalar Nível
                </Button>
              )}
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
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
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
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
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

      {/* ── Modal: Declinar (sem aderência) ── */}
      {showDeclinar && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
          <div className="bg-card border border-slate-500/30 rounded-2xl w-full max-w-sm animate-fade-in">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <X className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-white">Declinar Proposta (sem aderência)</h3>
            </div>
            <div className="px-5 py-4 space-y-4">
              <p className="text-xs text-muted-foreground">
                Use quando a proposta não é reprovada por crédito, mas não tem aderência ao que oferecemos. Informe o motivo — o partner será notificado.
              </p>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Motivo *</label>
                <textarea
                  value={motivoDeclinio}
                  onChange={e => setMotivoDeclinio(e.target.value)}
                  placeholder="Ex: Fora do escopo de produtos, valor abaixo do mínimo, garantia não aceita..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-slate-500/50 resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowDeclinar(false); setMotivoDeclinio(""); }}>Cancelar</Button>
              <Button size="sm" onClick={handleDeclinar} disabled={!motivoDeclinio.trim() || savingAprovacao}
                className="bg-slate-600 hover:bg-slate-500 border-0 text-white gap-1.5">
                {savingAprovacao ? <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> : <X className="w-3.5 h-3.5" />}
                Confirmar Declínio
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Escalar Nível ── */}
      {showEscalar && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
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
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
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
              <div className="px-6 py-4 border-t border-border space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">{compileDocs.length} documento(s) · validade 20 dias</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={copyAllLinks} className="gap-1.5 text-xs">
                      {copiedId === "__all__"
                        ? <><CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> Copiado!</>
                        : <><Copy className="w-3.5 h-3.5" /> Copiar todos os links</>}
                    </Button>
                    <Button size="sm" onClick={baixarTodosZip} disabled={baixandoZip} className="gap-1.5 text-xs">
                      {baixandoZip
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Compactando...</>
                        : <><Download className="w-3.5 h-3.5" /> Baixar tudo (.zip)</>}
                    </Button>
                  </div>
                </div>
                {zipError && <p className="text-[11px] text-red-400">{zipError}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Solicitar Correção ao Partner ── */}
      {solicitarDoc && (
        <div className="fixed inset-0 z-[220] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
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
        <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-10 bg-black/70 backdrop-blur-sm">
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
                    <EField label="Faturamento Mensal (R$)" value={editFaturamento} onChange={setEditFaturamento} placeholder="0,00" />
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
