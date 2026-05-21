"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  X, FileText, Download, Loader2, AlertTriangle, Clock,
  CheckCircle2, XCircle, ChevronRight, Building2, Send, ExternalLink
} from "lucide-react";

type Doc = {
  doc_id: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  url: string | null;
};

type ProposalDetail = {
  id: string;
  code: string;
  client_name: string;
  client_cpf_cnpj?: string | null;
  credit_line: string;
  requested_value: number;
  approved_value?: number | null;
  stage: string;
  status: string;
  created_at: string;
  updated_at: string;
  pending_reason?: string | null;
  level1_notes?: string | null;
  level2_notes?: string | null;
  finalidade?: string | null;
  prazo?: string | null;
  imovel_endereco?: string | null;
  imovel_valor_medio?: number | null;
  imovel_cidade?: string | null;
  imovel_estado?: string | null;
  documents: Doc[];
  instituicao_feedback?: { instituicao: string; status: string; observacao: string; updated_at: string }[];
};

const STATUS_OPTIONS = [
  { value: "EM_ANALISE",     label: "Em Análise",            color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  { value: "DOCS_PENDENTES", label: "Documentos Pendentes",  color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  { value: "PRE_APROVADO",   label: "Pré-Aprovado",          color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  { value: "REPROVADO",      label: "Reprovado",             color: "text-red-400 bg-red-500/10 border-red-500/30" },
];

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

type Tab = "dados" | "documentos" | "parecer";

export function InstituicaoPropostaModal({
  proposalId,
  instituicaoNome,
  onClose,
}: {
  proposalId: string;
  instituicaoNome: string;
  onClose: () => void;
}) {
  const [proposal, setProposal] = useState<ProposalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("dados");

  // Feedback state
  const [fbStatus, setFbStatus] = useState("");
  const [fbObs, setFbObs] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchProposal = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/instituicao/propostas/${proposalId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao carregar proposta.");
      setProposal(data.proposal);

      // Pre-fill feedback se já existe
      const existing = (data.proposal.instituicao_feedback ?? []).find(
        (f: { instituicao: string }) => f.instituicao === instituicaoNome
      );
      if (existing) {
        setFbStatus(existing.status);
        setFbObs(existing.observacao);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, [proposalId, instituicaoNome]);

  useEffect(() => { fetchProposal(); }, [fetchProposal]);

  // Fecha com ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSaveFeedback() {
    if (!fbStatus) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`/api/instituicao/propostas/${proposalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instituicao: instituicaoNome, status: fbStatus, observacao: fbObs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar.");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const stageColor: Record<string, string> = {
    ANALISE: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    PENDENCIA: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#111F35] border border-[#243A66] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#243A66]">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-[#C9A84C]" />
            <div>
              <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest">
                {proposal?.code ?? "Carregando..."}
              </p>
              <p className="text-sm font-bold text-[#F0ECE4]">
                {proposal?.client_name ?? ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#7A8FA8] hover:text-[#F0ECE4] hover:bg-[#243A66]/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#243A66] px-6 gap-1">
          {([
            { id: "dados",      label: "Dados da Proposta" },
            { id: "documentos", label: "Anexos" },
            { id: "parecer",    label: "Meu Parecer" },
          ] as { id: Tab; label: string }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                tab === t.id ? "border-[#C9A84C] text-[#C9A84C]" : "border-transparent text-[#7A8FA8] hover:text-[#F0ECE4]"
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-[#C9A84C] animate-spin" />
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* ── Aba: Dados ── */}
          {!loading && proposal && tab === "dados" && (
            <div className="space-y-5">

              {/* Etapa + status */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${stageColor[proposal.stage] ?? "text-[#7A8FA8] border-[#243A66]"}`}>
                  <Clock className="w-3 h-3" />
                  {proposal.stage === "ANALISE" ? "Em Análise" : "Pendência"}
                </span>
                {proposal.pending_reason && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-amber-300">{proposal.pending_reason}</p>
                  </div>
                )}
              </div>

              {/* Grid de dados */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Cliente", value: proposal.client_name },
                  { label: "CPF/CNPJ", value: proposal.client_cpf_cnpj ?? "—" },
                  { label: "Linha de Crédito", value: proposal.credit_line },
                  { label: "Finalidade", value: proposal.finalidade ?? "—" },
                  { label: "Valor Solicitado", value: formatBRL(proposal.requested_value) },
                  { label: "Prazo", value: proposal.prazo ?? "—" },
                  ...(proposal.approved_value ? [{ label: "Valor Aprovado", value: formatBRL(proposal.approved_value) }] : []),
                  { label: "Encaminhado em", value: formatDate(proposal.created_at) },
                  { label: "Atualizado em", value: formatDate(proposal.updated_at) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#0D1929] rounded-xl p-3 border border-[#243A66]/60">
                    <p className="text-[9px] font-bold text-[#7A8FA8] uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-xs font-semibold text-[#F0ECE4]">{value}</p>
                  </div>
                ))}
              </div>

              {/* Imóvel */}
              {(proposal.imovel_endereco || proposal.imovel_cidade) && (
                <div className="bg-[#0D1929] rounded-xl p-4 border border-[#243A66]/60 space-y-2">
                  <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Garantia — Imóvel</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-[#F0ECE4]">
                    {proposal.imovel_endereco && <span>{proposal.imovel_endereco}</span>}
                    {proposal.imovel_cidade && <span>{proposal.imovel_cidade} / {proposal.imovel_estado}</span>}
                    {proposal.imovel_valor_medio && <span>Valor estimado: {formatBRL(proposal.imovel_valor_medio)}</span>}
                  </div>
                </div>
              )}

              {/* Notas da mesa */}
              {(proposal.level1_notes || proposal.level2_notes) && (
                <div className="bg-[#0D1929] rounded-xl p-4 border border-[#243A66]/60 space-y-2">
                  <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Observações da Mesa</p>
                  {proposal.level1_notes && <p className="text-xs text-[#F0ECE4] leading-relaxed">{proposal.level1_notes}</p>}
                  {proposal.level2_notes && <p className="text-xs text-[#7A8FA8] leading-relaxed">{proposal.level2_notes}</p>}
                </div>
              )}
            </div>
          )}

          {/* ── Aba: Documentos ── */}
          {!loading && proposal && tab === "documentos" && (
            <div className="space-y-3">
              {proposal.documents.length === 0 ? (
                <div className="text-center py-12 text-[#7A8FA8]">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum anexo disponível.</p>
                </div>
              ) : (
                proposal.documents.map((doc) => (
                  <div key={doc.storage_path} className="flex items-center gap-3 bg-[#0D1929] border border-[#243A66]/60 rounded-xl px-4 py-3">
                    <FileText className="w-4 h-4 text-[#C9A84C] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#F0ECE4] truncate">{doc.file_name}</p>
                      <p className="text-[10px] text-[#7A8FA8] mt-0.5">
                        {formatDate(doc.uploaded_at)}
                      </p>
                    </div>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C]/15 hover:bg-[#C9A84C]/25 border border-[#C9A84C]/30 text-[#C9A84C] text-[10px] font-bold transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        Abrir
                      </a>
                    ) : (
                      <span className="text-[10px] text-[#7A8FA8] italic">Indisponível</span>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── Aba: Parecer ── */}
          {!loading && proposal && tab === "parecer" && (
            <div className="space-y-5">
              <div className="bg-[#0D1929] border border-[#243A66]/60 rounded-xl p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-[#C9A84C]" />
                  <p className="text-xs font-bold text-[#C9A84C]">{instituicaoNome}</p>
                </div>
                <p className="text-[11px] text-[#7A8FA8]">
                  Informe o status da sua análise para esta proposta. Isso ficará visível para a equipe V3 Partners.
                </p>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-widest">Status da Análise</p>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setFbStatus(opt.value)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        fbStatus === opt.value
                          ? opt.color + " ring-2 ring-offset-1 ring-offset-[#111F35] ring-[#C9A84C]/40"
                          : "border-[#243A66] text-[#7A8FA8] hover:border-[#C9A84C]/40 hover:text-[#F0ECE4]"
                      }`}
                    >
                      {opt.value === "EM_ANALISE" && <Clock className="w-3.5 h-3.5" />}
                      {opt.value === "DOCS_PENDENTES" && <AlertTriangle className="w-3.5 h-3.5" />}
                      {opt.value === "PRE_APROVADO" && <CheckCircle2 className="w-3.5 h-3.5" />}
                      {opt.value === "REPROVADO" && <XCircle className="w-3.5 h-3.5" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Observação */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-widest">Observações / Parecer</p>
                <textarea
                  value={fbObs}
                  onChange={e => setFbObs(e.target.value)}
                  rows={5}
                  placeholder="Descreva pendências, condicionantes, documentos solicitados ou qualquer observação relevante..."
                  className="w-full bg-[#0D1929] border border-[#243A66] rounded-xl px-4 py-3 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/40 focus:outline-none focus:border-[#C9A84C]/50 transition-colors resize-none"
                />
              </div>

              {saveError && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <p className="text-red-400 text-xs">{saveError}</p>
                </div>
              )}

              <button
                onClick={handleSaveFeedback}
                disabled={!fbStatus || saving}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {saving ? "Salvando..." : saved ? "Parecer salvo!" : "Salvar Parecer"}
              </button>

              {saved && (
                <p className="text-center text-xs text-emerald-400">
                  Parecer registrado com sucesso. A equipe V3 Partners foi notificada.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
