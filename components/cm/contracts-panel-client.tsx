"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText, Search, Filter, Clock, CheckCircle2, XCircle,
  Send, Eye, MessageSquare, Loader2, ChevronDown, User,
  AlertTriangle, Shield, UserPlus, Plus, X, Copy, Share2,
} from "lucide-react";
import { cn, isValidEmail } from "@/lib/utils";

interface Approval {
  id: string;
  approver_name: string;
  decision: string;
  comment: string | null;
  created_at: string;
}

interface Note {
  id: string;
  author_name: string;
  note_type: string;
  content: string;
  decision: string | null;
  created_at: string;
}

interface Contract {
  id: string;
  template_id: string;
  vertical: string;
  contract_title: string;
  rendered_html: string | null;
  status_signature: string;
  commission_percent: number | null;
  parties: any[];
  created_at: string;
  updated_at: string;
  signed_at: string | null;
  approval_count: number;
  approved_by: string[];
  requires_review: boolean;
  approvals: Approval[];
  notes: Note[];
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  rascunho: { label: "Rascunho", color: "bg-[#243A66] text-[#9BAFC5]", icon: <FileText size={12} /> },
  em_revisao: { label: "Em Revisão", color: "bg-amber-500/20 text-amber-400", icon: <AlertTriangle size={12} /> },
  aprovado: { label: "Aprovado", color: "bg-emerald-500/20 text-emerald-400", icon: <CheckCircle2 size={12} /> },
  enviado_assinatura: { label: "Enviado p/ Assinatura", color: "bg-blue-500/20 text-blue-400", icon: <Send size={12} /> },
  assinado: { label: "Assinado", color: "bg-[#C9A84C]/20 text-[#C9A84C]", icon: <Shield size={12} /> },
  cancelado: { label: "Cancelado", color: "bg-red-500/20 text-red-400", icon: <XCircle size={12} /> },
};

const VERTICAL_LABELS: Record<string, string> = {
  capital_markets: "Bolsa de Ativos",
  credito: "Mesa de Crédito",
  ma: "M&A",
  institucional: "Institucional",
  clientes: "Clientes / Partners",
  talent_pool: "Talent Pool",
  colaboradores: "Colaboradores",
};

interface QualParty {
  id: string;
  full_name: string;
  email: string;
  role_in_document: string;
  status: string;
  qualification_token: string;
}

interface QualBatch {
  id: string;
  status: string;
  cm_party_qualifications: QualParty[];
}

const ROLE_LABELS: Record<string, string> = {
  parte_principal: "Parte Principal",
  intermediario_finder_venda: "Intermediário/Finder Venda",
  intermediario_finder_compra: "Intermediário/Finder Compra",
  mandatario: "Mandatário",
  testemunha: "Testemunha",
};

export function ContractsPanelClient() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [filterVertical, setFilterVertical] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [sendingToSignature, setSendingToSignature] = useState(false);
  const [qualBatches, setQualBatches] = useState<QualBatch[]>([]);
  const [showQualModal, setShowQualModal] = useState(false);
  const [qualParties, setQualParties] = useState<{ full_name: string; email: string; role_in_document: string }[]>([
    { full_name: "", email: "", role_in_document: "parte_principal" },
  ]);
  const [creatingQualification, setCreatingQualification] = useState(false);
  const [copiedToken, setCopiedToken] = useState("");

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterVertical) params.set("vertical", filterVertical);
      if (filterStatus) params.set("status", filterStatus);
      if (searchQuery) params.set("q", searchQuery);
      const res = await fetch(`/api/contracts/list?${params}`);
      const json = await res.json();
      const list = json.contracts ?? [];
      setContracts(list);
      setSelected(prev => prev ? list.find((c: Contract) => c.id === prev.id) ?? null : null);
    } catch { /* */ }
    finally { setLoading(false); }
  }, [filterVertical, filterStatus, searchQuery]);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const handleAddNote = async () => {
    if (!selected || !noteText.trim()) return;
    setSubmittingNote(true);
    try {
      const res = await fetch("/api/contracts/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract_id: selected.id, content: noteText.trim() }),
      });
      if (res.ok) {
        setNoteText("");
        fetchContracts();
      }
    } catch { /* */ }
    finally { setSubmittingNote(false); }
  };

  const handleApprove = async (decision: "aprovado" | "reprovado") => {
    if (!selected) return;
    const comment = decision === "reprovado" ? prompt("Motivo da reprovação:") : null;
    if (decision === "reprovado" && !comment) return;

    try {
      const res = await fetch("/api/contracts/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract_id: selected.id, decision, comment }),
      });
      if (res.ok) fetchContracts();
      else {
        const j = await res.json();
        alert(j.error);
      }
    } catch { /* */ }
  };

  const handleSendToSignature = async () => {
    if (!selected) return;
    if (!confirm(`Enviar "${selected.contract_title}" para assinatura digital via ClickSign?`)) return;
    setSendingToSignature(true);
    try {
      const res = await fetch(`/api/contracts/${selected.id}/send`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        alert(`Enviado para assinatura (${json.signatarios} signatário(s)).`);
        fetchContracts();
      } else {
        alert(json.error ?? "Erro ao enviar para assinatura");
      }
    } catch { alert("Erro de conexão"); }
    finally { setSendingToSignature(false); }
  };

  const loadQualifications = async (contractId: string) => {
    try {
      const res = await fetch(`/api/cm/qualifications?operation_contract_id=${contractId}`);
      const json = await res.json();
      setQualBatches(json.batches ?? []);
    } catch { setQualBatches([]); }
  };

  const addQualPartyRow = () => setQualParties((prev) => [...prev, { full_name: "", email: "", role_in_document: "parte_principal" }]);
  const removeQualPartyRow = (index: number) => setQualParties((prev) => prev.filter((_, i) => i !== index));
  const updateQualPartyRow = (index: number, field: "full_name" | "email" | "role_in_document", value: string) => {
    setQualParties((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const submitQualification = async () => {
    if (!selected) return;
    const invalid = qualParties.some((p) => !p.full_name.trim() || !isValidEmail(p.email));
    if (qualParties.length === 0 || invalid) {
      alert("Preencha nome e e-mail válido para todos os envolvidos");
      return;
    }
    setCreatingQualification(true);
    try {
      const res = await fetch("/api/cm/qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation_contract_id: selected.id, document_type: "contrato_parceria", parties: qualParties }),
      });
      const json = await res.json();
      if (res.ok) {
        setShowQualModal(false);
        setQualParties([{ full_name: "", email: "", role_in_document: "parte_principal" }]);
        loadQualifications(selected.id);
      } else {
        alert(json.error ?? "Erro ao gerar qualificação");
      }
    } catch { alert("Erro de conexão"); }
    finally { setCreatingQualification(false); }
  };

  const qualificationLink = (token: string) =>
    `${typeof window !== "undefined" ? window.location.origin : "https://app.v3partners.com.br"}/intake/qualificacao/${token}`;

  const copyQualLink = (token: string) => {
    navigator.clipboard.writeText(qualificationLink(token));
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(""), 2000);
  };

  // Link geral "compartilhar via WhatsApp" — abre o WhatsApp Web/App do
  // próprio operador com a mensagem pronta, ele escolhe o contato e envia.
  // Mesmo padrão já em produção em Indicações (indicacoes-dashboard-client.tsx),
  // sem depender de nenhuma integração de envio automatizado (achado
  // 11/08/2026: não existe credencial WhatsApp provisionada no sistema).
  const whatsappQualLink = (party: QualParty, contractTitle: string) => {
    const msg = `Olá ${party.full_name}, você foi cadastrado(a) como envolvido(a) no contrato "${contractTitle}" da V3 Partners. Complete seus dados de qualificação para prosseguirmos: ${qualificationLink(party.qualification_token)}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const statusInfo = (s: string) => STATUS_MAP[s] ?? STATUS_MAP.rascunho;

  const timelineItems = selected ? [
    ...selected.approvals.map(a => ({
      type: "approval" as const,
      date: a.created_at,
      title: `${a.approver_name} ${a.decision === "aprovado" ? "aprovou" : "reprovou"}`,
      detail: a.comment,
      icon: a.decision === "aprovado" ? <CheckCircle2 size={14} className="text-emerald-400" /> : <XCircle size={14} className="text-red-400" />,
    })),
    ...selected.notes.map(n => ({
      type: "note" as const,
      date: n.created_at,
      title: `${n.author_name} — ${n.note_type === "comentario" ? "comentou" : n.note_type}`,
      detail: n.content,
      icon: <MessageSquare size={14} className="text-[#9BAFC5]" />,
    })),
    { type: "creation" as const, date: selected.created_at, title: "Contrato gerado", detail: null, icon: <FileText size={14} className="text-[#C9A84C]" /> },
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];

  return (
    <div className="min-h-screen p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F1E8]">Painel de Contratos</h1>
          <p className="text-sm text-[#9BAFC5]">Gestão de contratos gerados — aprovações, alterações e timeline</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#9BAFC5]">
          <Shield size={14} className="text-[#C9A84C]" />
          <span>Quórum: 2/3 sócios</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BAFC5]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar contrato..."
            className="w-full bg-[#162744] border border-[#9BAFC5]/15 rounded-lg pl-9 pr-4 py-2 text-sm text-[#F5F1E8] placeholder:text-[#9BAFC5]/50 focus:border-[#C9A84C]/50 focus:outline-none"
          />
        </div>

        <select
          value={filterVertical}
          onChange={(e) => setFilterVertical(e.target.value)}
          className="bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none"
        >
          <option value="">Todas verticais</option>
          {Object.entries(VERTICAL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] focus:border-[#C9A84C]/50 focus:outline-none"
        >
          <option value="">Todos status</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Lista de contratos */}
        <div className="col-span-5 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#C9A84C]" /></div>
          ) : contracts.length === 0 ? (
            <div className="text-center py-12 text-[#9BAFC5] text-sm">Nenhum contrato encontrado</div>
          ) : contracts.map((c) => {
            const si = statusInfo(c.status_signature);
            return (
              <div
                key={c.id}
                onClick={() => { setSelected(c); setShowPreview(false); loadQualifications(c.id); }}
                className={cn(
                  "bg-[#12112A] border rounded-lg p-4 cursor-pointer transition",
                  selected?.id === c.id ? "border-[#C9A84C]/50" : "border-[#9BAFC5]/10 hover:border-[#C9A84C]/20"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1", si.color)}>
                    {si.icon} {si.label}
                  </span>
                  <span className="text-[9px] text-[#9BAFC5]">
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="text-sm font-bold text-[#F5F1E8] mb-1 line-clamp-1">{c.contract_title}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#9BAFC5]">{VERTICAL_LABELS[c.vertical] ?? c.vertical}</span>
                  <div className="flex items-center gap-1">
                    {c.approval_count > 0 && (
                      <span className="text-[9px] text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle2 size={10} /> {c.approval_count}/2
                      </span>
                    )}
                    {c.notes.length > 0 && (
                      <span className="text-[9px] text-[#9BAFC5] flex items-center gap-0.5">
                        <MessageSquare size={10} /> {c.notes.length}
                      </span>
                    )}
                  </div>
                </div>
                {c.parties && c.parties.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.parties.map((p: any, i: number) => (
                      <span key={i} className="text-[9px] bg-[#162744] text-[#9BAFC5] px-1.5 py-0.5 rounded">
                        <User size={8} className="inline mr-0.5" />{p.name ?? p.role}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Detalhe + Timeline */}
        <div className="col-span-7">
          {!selected ? (
            <div className="flex items-center justify-center h-64 text-[#9BAFC5] text-sm">
              Selecione um contrato para ver detalhes e timeline
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header do contrato */}
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-[#F5F1E8]">{selected.contract_title}</h2>
                  <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded flex items-center gap-1", statusInfo(selected.status_signature).color)}>
                    {statusInfo(selected.status_signature).icon} {statusInfo(selected.status_signature).label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-[#9BAFC5]">Vertical</span>
                    <p className="text-[#F5F1E8] font-medium">{VERTICAL_LABELS[selected.vertical] ?? selected.vertical}</p>
                  </div>
                  <div>
                    <span className="text-[#9BAFC5]">Criado em</span>
                    <p className="text-[#F5F1E8] font-medium">{new Date(selected.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                  <div>
                    <span className="text-[#9BAFC5]">Comissão</span>
                    <p className="text-[#F5F1E8] font-medium">{selected.commission_percent ? `${selected.commission_percent}%` : "—"}</p>
                  </div>
                </div>

                {selected.parties && selected.parties.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#9BAFC5]/10">
                    <span className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider">Partes</span>
                    <div className="flex gap-4 mt-1">
                      {selected.parties.map((p: any, i: number) => (
                        <div key={i} className="text-xs">
                          <span className="text-[#9BAFC5]">{p.role === "cedente" ? "Cedente" : p.role === "v3_partners" ? "V3 Partners" : p.role}</span>
                          <p className="text-[#F5F1E8] font-medium">{p.name}</p>
                          {p.doc && <p className="text-[10px] text-[#9BAFC5]">{p.doc}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="mt-4 pt-3 border-t border-[#9BAFC5]/10 flex items-center gap-2">
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#162744] text-[#F5F1E8] rounded-lg text-xs hover:bg-[#243A66] transition"
                  >
                    <Eye size={13} /> {showPreview ? "Ocultar" : "Visualizar"}
                  </button>

                  {selected.status_signature === "rascunho" && (
                    <>
                      <button
                        onClick={() => handleApprove("aprovado")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs hover:bg-emerald-500/30 transition"
                      >
                        <CheckCircle2 size={13} /> Aprovar
                      </button>
                      <button
                        onClick={() => handleApprove("reprovado")}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs hover:bg-red-500/30 transition"
                      >
                        <XCircle size={13} /> Reprovar
                      </button>
                    </>
                  )}

                  {["rascunho", "aprovado"].includes(selected.status_signature) && selected.parties?.some((p: any) => p.role !== "v3_partners" && p.email) && (
                    <button
                      onClick={handleSendToSignature}
                      disabled={sendingToSignature}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#C9A84C]/20 text-[#C9A84C] rounded-lg text-xs font-bold hover:bg-[#C9A84C]/30 transition disabled:opacity-50"
                    >
                      {sendingToSignature ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Enviar para Assinatura
                    </button>
                  )}

                  {selected.status_signature === "rascunho" && (
                    <button
                      onClick={() => setShowQualModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#162744] text-[#9BAFC5] rounded-lg text-xs font-bold hover:text-[#F5F1E8] hover:bg-[#243A66] transition"
                    >
                      <UserPlus size={13} /> Gerar Link de Qualificação
                    </button>
                  )}
                </div>
              </div>

              {/* Qualificação de Partes */}
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-5">
                <h3 className="text-sm font-bold text-[#F5F1E8] mb-3 flex items-center gap-2">
                  <UserPlus size={14} className="text-[#C9A84C]" /> Qualificação de Partes
                </h3>
                {qualBatches.length === 0 ? (
                  <p className="text-xs text-[#9BAFC5]">Nenhuma qualificação gerada para este contrato ainda.</p>
                ) : (
                  <div className="space-y-3">
                    {qualBatches.map((batch) => (
                      <div key={batch.id} className="bg-[#162744] border border-[#9BAFC5]/10 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold text-[#C9A84C] uppercase">Lote de Qualificação</span>
                          <span className={cn("text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border",
                            batch.status === "completo" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-[#243A66] text-[#9BAFC5] border-[#9BAFC5]/15"
                          )}>
                            {batch.cm_party_qualifications.filter((p) => p.status === "preenchido").length}/{batch.cm_party_qualifications.length} qualificados
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {batch.cm_party_qualifications.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 bg-[#09081A] rounded px-2.5 py-1.5">
                              <div className="min-w-0">
                                <p className="text-xs text-[#F5F1E8] truncate">{p.full_name} <span className="text-[9px] text-[#9BAFC5]">— {ROLE_LABELS[p.role_in_document] ?? p.role_in_document}</span></p>
                              </div>
                              {p.status === "preenchido" ? (
                                <span className="text-[9px] text-emerald-400 flex items-center gap-1 flex-shrink-0"><CheckCircle2 size={11} /> Qualificado</span>
                              ) : (
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button onClick={() => copyQualLink(p.qualification_token)}
                                    className="flex items-center gap-1 text-[9px] font-semibold text-[#C9A84C] px-2 py-1 rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 transition-colors">
                                    <Copy size={10} /> {copiedToken === p.qualification_token ? "Copiado" : "Copiar link"}
                                  </button>
                                  <a href={whatsappQualLink(p, selected.contract_title)} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 px-2 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors">
                                    <Share2 size={10} /> WhatsApp
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Preview HTML */}
              {showPreview && selected.rendered_html && (
                <div className="bg-white rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                  <iframe
                    srcDoc={selected.rendered_html}
                    className="w-full h-[400px] border-0"
                    title="Preview do contrato"
                  />
                </div>
              )}

              {/* Timeline */}
              <div className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-5">
                <h3 className="text-sm font-bold text-[#F5F1E8] mb-4 flex items-center gap-2">
                  <Clock size={14} className="text-[#C9A84C]" /> Timeline de Alterações
                </h3>

                {timelineItems.length === 0 ? (
                  <p className="text-xs text-[#9BAFC5]">Nenhuma atividade registrada</p>
                ) : (
                  <div className="space-y-3 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-[#243A66]">
                    {timelineItems.map((item, i) => (
                      <div key={i} className="flex gap-3 relative">
                        <div className="z-10 bg-[#12112A] p-0.5">{item.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-[#F5F1E8] font-medium">{item.title}</span>
                            <span className="text-[9px] text-[#9BAFC5]">
                              {new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} {new Date(item.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {item.detail && (
                            <p className="text-[11px] text-[#9BAFC5] mt-0.5 line-clamp-2">{item.detail}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Adicionar nota */}
                <div className="mt-4 pt-3 border-t border-[#9BAFC5]/10">
                  <div className="flex gap-2">
                    <input
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Adicionar comentário ou alteração..."
                      className="flex-1 bg-[#162744] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] placeholder:text-[#9BAFC5]/50 focus:border-[#C9A84C]/50 focus:outline-none"
                      onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={submittingNote || !noteText.trim()}
                      className="px-3 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg text-xs font-bold hover:bg-[#E8C97A] disabled:opacity-40 transition"
                    >
                      {submittingNote ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Qualificação de Partes */}
      {showQualModal && selected && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => setShowQualModal(false)}>
          <div className="w-full max-w-lg max-h-[85vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-sm font-bold text-[#F5F1E8]">Gerar Qualificação de Partes</div>
                <div className="text-[10px] text-[#9BAFC5]">{selected.contract_title}</div>
              </div>
              <button onClick={() => setShowQualModal(false)} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-[11px] text-[#9BAFC5] leading-relaxed">
                Cada envolvido recebe um link individual para preencher seus próprios dados (CPF/CNPJ e, se necessário, dados de repasse). Evita erro humano de digitar dado de terceiro na mão.
              </p>
              <div className="space-y-2">
                {qualParties.map((row, i) => (
                  <div key={i} className="bg-[#12112A] border border-[#9BAFC5]/10 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-[#9BAFC5] uppercase">Envolvido {i + 1}</span>
                      {qualParties.length > 1 && (
                        <button onClick={() => removeQualPartyRow(i)}><X size={12} className="text-red-400/70 hover:text-red-400" /></button>
                      )}
                    </div>
                    <input value={row.full_name} onChange={(e) => updateQualPartyRow(i, "full_name", e.target.value)} placeholder="Nome completo *"
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                    <input value={row.email} onChange={(e) => updateQualPartyRow(i, "email", e.target.value)} placeholder="E-mail *" type="email"
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]" />
                    <select value={row.role_in_document} onChange={(e) => updateQualPartyRow(i, "role_in_document", e.target.value)}
                      className="w-full bg-[#09081A] border border-[#9BAFC5]/15 rounded px-2 py-1.5 text-xs text-[#F5F1E8]">
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <button onClick={addQualPartyRow}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#162744] border border-[#9BAFC5]/15 rounded text-[#9BAFC5] text-[10px] font-bold hover:text-[#F5F1E8] transition">
                <Plus size={12} /> Adicionar Envolvido
              </button>
            </div>
            <div className="p-4 border-t border-[#C9A84C]/20 flex-shrink-0">
              <button onClick={submitQualification} disabled={creatingQualification}
                className="w-full px-3 py-2.5 bg-[#C9A84C] text-[#09081A] rounded-lg text-xs font-bold hover:bg-[#E8C97A] transition disabled:opacity-50 flex items-center justify-center gap-2">
                {creatingQualification ? <Loader2 size={14} className="animate-spin" /> : null} Enviar Links de Qualificação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
