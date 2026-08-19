"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, FileText, X, Download, RefreshCw, Repeat, ShoppingCart, IdCard, Target, ShieldCheck, Link2, Check, UserPlus, ClipboardCheck, History, Send } from "lucide-react";
import { QuickIndicateModal } from "@/components/cm/quick-indicate-modal";
import { QualificationBatchesPanel } from "@/components/cm/qualification-batches-panel";

type BuyDemand = {
  id: string;
  intake_token: string;
  nome_contato: string;
  empresa: string | null;
  cpf: string | null;
  cnpj: string | null;
  nacionalidade: string | null;
  profissao: string | null;
  estado_civil: string | null;
  identidade_orgao: string | null;
  endereco: string | null;
  telefone: string | null;
  email: string;
  jurisdicao_alvo: string[] | null;
  natureza_preferida: string[] | null;
  desagio_min: number | null;
  criterios: string | null;
  asset_types_preferidos: string[] | null;
  setores: string[];
  ticket_min: number;
  ticket_max: number;
  status: string;
  intake_locked: boolean;
  nda_accepted: boolean;
  nda_accepted_at: string | null;
  purchase_frequency_type: string | null;
  recurrence_months: number | null;
  origin_partner: { id: string; full_name: string } | null;
  document_count: number;
  document_types: string[];
  match_count: number;
  pipeline_status: "aguardando_preenchimento" | "documentos_pendentes" | "documentacao_completa";
  kyc_approved_at: string | null;
  kyc_missing: string[];
  kyc_ready_for_approval: boolean;
  created_at: string;
};

type KycDoc = {
  id: string;
  document_type: string;
  original_filename: string;
  download_url: string | null;
  created_at: string;
};

type TimelineNote = {
  id: string;
  content: string;
  is_system: boolean;
  created_at: string;
  profiles: { full_name: string } | null;
};

const ASSET_LABEL: Record<string, string> = {
  precatorio: "Precatório",
  direito_creditorio: "Dir. Creditório",
  icms: "ICMS",
  ipi: "IPI",
  outros: "Outros",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  loi_mou: "LOI / MOU",
  procuracao: "Procuração",
  outro: "Outro",
  kyc_identidade: "KYC, Identidade",
  kyc_comprovante_residencia: "KYC, Comprovante de Residência",
  kyc_contrato_social: "KYC, Contrato Social",
};

// Status de fila -- cor ajuda a Mesa a escanear rapido quem ja esta pronto pra Full DD
// vs quem ainda falta documento vs quem nem preencheu o formulario ainda.
const PIPELINE_STATUS: Record<BuyDemand["pipeline_status"], { label: string; dot: string; text: string; bg: string; border: string }> = {
  aguardando_preenchimento: { label: "Aguardando Preenchimento", dot: "#5A7490", text: "#9BAFC5", bg: "rgba(90,116,144,0.12)", border: "rgba(90,116,144,0.3)" },
  documentos_pendentes: { label: "Documentos Pendentes", dot: "#E8935A", text: "#E8935A", bg: "rgba(232,147,90,0.12)", border: "rgba(232,147,90,0.3)" },
  documentacao_completa: { label: "Documentação Completa", dot: "#4ADE80", text: "#4ADE80", bg: "rgba(74,222,128,0.12)", border: "rgba(74,222,128,0.3)" },
};

function formatM(v: number) {
  if (!v) return "R$ 0";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  return `R$ ${(v / 1e3).toFixed(0)}K`;
}

function StatusChip({ status }: { status: BuyDemand["pipeline_status"] }) {
  const s = PIPELINE_STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded-full border w-fit whitespace-nowrap"
      style={{ color: s.text, background: s.bg, borderColor: s.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-[#9BAFC5]/70">{label}</div>
      <div className="text-xs text-[#F5F1E8] mt-0.5">{value}</div>
    </div>
  );
}

interface BuySideDemandsPanelProps {
  /** "mesa": Mesa/Gestao/Admin, ve tudo. "mine": Partner externo, API ja forca o filtro por
   *  origin_partner_id no servidor -- aqui so ajusta o texto e esconde a coluna redundante. */
  mode?: "mesa" | "mine";
  title?: string;
  subtitle?: string;
}

export function BuySideDemandsPanel({ mode = "mesa", title, subtitle }: BuySideDemandsPanelProps) {
  const [demands, setDemands] = useState<BuyDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailDemand, setDetailDemand] = useState<BuyDemand | null>(null);
  const [docs, setDocs] = useState<KycDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [indicateDemand, setIndicateDemand] = useState<BuyDemand | null>(null);
  const [timeline, setTimeline] = useState<TimelineNote[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [approvingKyc, setApprovingKyc] = useState(false);

  const copyLink = (d: BuyDemand) => {
    const url = `${window.location.origin}/intake/buy/${d.intake_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(d.id);
    setTimeout(() => setCopiedId((cur) => (cur === d.id ? null : cur)), 2000);
  };

  const fetchDemands = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cm/investor-demands?status=ativo");
      const json = await res.json();
      setDemands(json.demands ?? []);
    } catch {
      setDemands([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDemands(); }, [fetchDemands]);

  const openDetail = async (demand: BuyDemand) => {
    setDetailDemand(demand);
    setDocsLoading(true);
    setTimelineLoading(true);
    try {
      const res = await fetch(`/api/cm/kyc-documents?demand_id=${demand.id}`);
      const json = await res.json();
      setDocs(json.documents ?? []);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
    try {
      const res = await fetch(`/api/cm/deal-notes?demand_id=${demand.id}`);
      const json = await res.json();
      setTimeline(json.notes ?? []);
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  const addNote = async () => {
    if (!detailDemand || !newNote.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/cm/deal-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demand_id: detailDemand.id, content: newNote.trim() }),
      });
      const json = await res.json();
      if (res.ok) {
        setTimeline((prev) => [json.note, ...prev]);
        setNewNote("");
      } else {
        alert(json.error ?? "Erro ao salvar nota");
      }
    } catch {
      alert("Erro de conexão");
    } finally {
      setSavingNote(false);
    }
  };

  const approveKyc = async () => {
    if (!detailDemand) return;
    setApprovingKyc(true);
    try {
      const res = await fetch(`/api/cm/investor-demands/${detailDemand.id}/approve-kyc`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setDetailDemand((prev) => (prev ? { ...prev, kyc_approved_at: new Date().toISOString(), kyc_missing: [], kyc_ready_for_approval: true } : prev));
        setTimeline((prev) => [{ id: `local-${Date.now()}`, content: "KYC aprovado pela Mesa. Full DD liberado para este comprador.", is_system: true, created_at: new Date().toISOString(), profiles: null }, ...prev]);
        fetchDemands();
      } else {
        alert(json.error ?? "Erro ao aprovar KYC");
      }
    } catch {
      alert("Erro de conexão");
    } finally {
      setApprovingKyc(false);
    }
  };

  const statusHeader = detailDemand ? PIPELINE_STATUS[detailDemand.pipeline_status] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#F5F1E8]">{title ?? "Demandas de Compra (Buy-Side)"}</p>
          <p className="text-xs text-[#9BAFC5]">{subtitle ?? "Compradores cadastrados via link de intake, com ou sem match já executado"}</p>
        </div>
        <button
          onClick={fetchDemands}
          className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-xs font-semibold px-3 py-2 hover:text-[#F5F1E8] hover:border-[#9BAFC5]/40 transition-colors"
        >
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="text-[#9BAFC5] animate-spin" />
        </div>
      ) : demands.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-[#243A66]">
          <ShoppingCart size={24} className="text-[#5A7490] mx-auto mb-3 opacity-40" />
          <p className="text-[#5A7490] text-sm">Nenhuma demanda de compra ativa.</p>
          <p className="text-[#5A7490] text-xs mt-1">Gere um link em "Link Comprador" no header desta tela.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#243A66]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#243A66] bg-[#13223A] text-left">
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Comprador</th>
                {mode === "mesa" && <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Partner de Origem</th>}
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Ativo Pretendido</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Ticket</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Frequência</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Status da Fila</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Ação</th>
              </tr>
            </thead>
            <tbody>
              {demands.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => openDetail(d)}
                  className="border-b border-[#162744] last:border-0 hover:bg-[#162744]/40 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-3">
                    <div className="text-[#F5F1E8] font-semibold">{d.nome_contato}</div>
                    {d.empresa && <div className="text-[#9BAFC5] text-[10px]">{d.empresa}</div>}
                  </td>
                  {mode === "mesa" && (
                    <td className="px-3 py-3 text-[#9BAFC5]">
                      {d.origin_partner?.full_name ?? <span className="text-[#5A7490]">Sem atribuição</span>}
                    </td>
                  )}
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(d.asset_types_preferidos ?? []).map((t) => (
                        <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#C9A84C]/10 text-[#E8C97A]">
                          {ASSET_LABEL[t] ?? t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[#C9A84C] font-bold whitespace-nowrap">
                    {formatM(d.ticket_min)} a {formatM(d.ticket_max)}
                  </td>
                  <td className="px-3 py-3">
                    {d.purchase_frequency_type === "RECURRENT_MONTHLY" ? (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 w-fit">
                        <Repeat size={9} /> Recorrente ({d.recurrence_months ?? "?"}m)
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#243A66] text-[#9BAFC5] w-fit">
                        Compra Única
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <StatusChip status={d.pipeline_status} />
                    {d.match_count > 0 && (
                      <div className="text-[9px] text-[#9BAFC5] mt-1">{d.match_count} match(es)</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); openDetail(d); }}
                        className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-[10px] font-semibold px-2.5 py-1.5 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                      >
                        <FileText size={11} /> Ficha
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyLink(d); }}
                        title="Copiar link de intake para reenviar ao comprador"
                        className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-[10px] font-semibold px-2.5 py-1.5 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                      >
                        {copiedId === d.id ? <Check size={11} className="text-emerald-400" /> : <Link2 size={11} />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setIndicateDemand(d); }}
                        title="Indicar finder, intermediário ou mandatário deste comprador"
                        className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-[10px] font-semibold px-2.5 py-1.5 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                      >
                        <UserPlus size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Card de detalhe: identificacao + mandato de busca + NDA + documentos, tudo num so lugar */}
      {detailDemand && statusHeader && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={() => setDetailDemand(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: statusHeader.border }}>
              <div>
                <div className="text-sm font-bold text-[#F5F1E8]">{detailDemand.nome_contato}</div>
                {detailDemand.empresa && <div className="text-[10px] text-[#9BAFC5]">{detailDemand.empresa}</div>}
                <div className="mt-1.5"><StatusChip status={detailDemand.pipeline_status} /></div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setIndicateDemand(detailDemand)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-[10px] font-semibold px-2.5 py-1.5 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                >
                  <UserPlus size={12} /> Indicar
                </button>
                <button
                  onClick={() => copyLink(detailDemand)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-[10px] font-semibold px-2.5 py-1.5 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                >
                  {copiedId === detailDemand.id ? <Check size={12} className="text-emerald-400" /> : <Link2 size={12} />}
                  {copiedId === detailDemand.id ? "Copiado" : "Copiar Link"}
                </button>
                <button onClick={() => setDetailDemand(null)} className="text-[#9BAFC5] hover:text-[#F5F1E8]">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Identificacao */}
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#E8C97A] mb-2.5">
                  <IdCard size={12} /> Identificação
                </div>
                <div className="grid grid-cols-2 gap-3 bg-[#12112A] border border-[#243A66] rounded-lg p-3">
                  <Field label="Email" value={detailDemand.email} />
                  <Field label="Telefone" value={detailDemand.telefone} />
                  <Field label="CPF" value={detailDemand.cpf} />
                  <Field label="CNPJ" value={detailDemand.cnpj} />
                  <Field label="Nacionalidade" value={detailDemand.nacionalidade} />
                  <Field label="Profissão" value={detailDemand.profissao} />
                  <Field label="Estado Civil" value={detailDemand.estado_civil} />
                  <Field label="Identidade / Órgão" value={detailDemand.identidade_orgao} />
                  {detailDemand.endereco && <div className="col-span-2"><Field label="Endereço" value={detailDemand.endereco} /></div>}
                  {!detailDemand.cpf && !detailDemand.cnpj && !detailDemand.nacionalidade && !detailDemand.profissao && !detailDemand.endereco && (
                    <div className="col-span-2 text-xs text-[#5A7490]">Comprador ainda não preencheu identificação completa.</div>
                  )}
                </div>
              </div>

              {/* Mandato de Busca */}
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#E8C97A] mb-2.5">
                  <Target size={12} /> Mandato de Busca
                </div>
                <div className="bg-[#12112A] border border-[#243A66] rounded-lg p-3 space-y-3">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-[#9BAFC5]/70">Ativo Pretendido</div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(detailDemand.asset_types_preferidos ?? []).length > 0 ? (
                        detailDemand.asset_types_preferidos!.map((t) => (
                          <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C9A84C]/10 text-[#E8C97A]">
                            {ASSET_LABEL[t] ?? t}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#5A7490]">Nenhum tipo selecionado ainda.</span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ticket" value={`${formatM(detailDemand.ticket_min)} a ${formatM(detailDemand.ticket_max)}`} />
                    <Field label="Deságio Mínimo" value={detailDemand.desagio_min ? `${detailDemand.desagio_min}%` : null} />
                    <Field label="Jurisdição de Interesse (Esfera)" value={detailDemand.jurisdicao_alvo?.join(", ")} />
                    <Field label="Natureza Preferida" value={detailDemand.natureza_preferida?.join(", ")} />
                  </div>
                  {detailDemand.criterios && <Field label="Critérios Adicionais" value={detailDemand.criterios} />}
                </div>
              </div>

              {/* NDA */}
              <div className="flex items-center gap-2 text-xs">
                <ShieldCheck size={14} className={detailDemand.nda_accepted ? "text-emerald-400" : "text-[#5A7490]"} />
                <span className={detailDemand.nda_accepted ? "text-emerald-400 font-semibold" : "text-[#5A7490]"}>
                  {detailDemand.nda_accepted
                    ? `NDA aceito${detailDemand.nda_accepted_at ? ` em ${new Date(detailDemand.nda_accepted_at).toLocaleString("pt-BR")}` : ""}`
                    : "NDA ainda não aceito"}
                </span>
              </div>

              {/* Documentos */}
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#E8C97A] mb-2.5">
                  <FileText size={12} /> Documentos
                </div>
                {docsLoading ? (
                  <div className="flex items-center justify-center py-6"><Loader2 size={16} className="text-[#9BAFC5] animate-spin" /></div>
                ) : docs.length === 0 ? (
                  <p className="text-xs text-[#5A7490] bg-[#12112A] border border-dashed border-[#243A66] rounded-lg py-4 text-center">Nenhum documento enviado ainda pelo comprador.</p>
                ) : (
                  <div className="space-y-2">
                    {docs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-2 bg-[#162744] rounded-lg px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="text-xs text-[#F5F1E8] font-semibold">{DOC_TYPE_LABEL[doc.document_type] ?? doc.document_type}</div>
                          <div className="text-[10px] text-[#9BAFC5] truncate">{doc.original_filename}</div>
                        </div>
                        {doc.download_url ? (
                          <a href={doc.download_url} target="_blank" rel="noreferrer"
                            className="flex items-center gap-1 text-[10px] font-bold text-[#C9A84C] hover:text-[#E8C97A] flex-shrink-0">
                            <Download size={12} /> Baixar
                          </a>
                        ) : (
                          <span className="text-[9px] text-[#5A7490] flex-shrink-0">indisponível</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklist de KYC + Aprovacao (BRIEF 3b, 19/08/2026) */}
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#E8C97A] mb-2.5">
                  <ClipboardCheck size={12} /> KYC, Checklist de Aprovação
                </div>
                <div className="bg-[#12112A] border border-[#243A66] rounded-lg p-3 space-y-3">
                  {detailDemand.kyc_approved_at ? (
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                      <ShieldCheck size={14} /> KYC aprovado em {new Date(detailDemand.kyc_approved_at).toLocaleString("pt-BR")}, Full DD liberado
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        {["Identidade (RG/CNH)", "Comprovante de Residência", ...(detailDemand.cnpj ? ["Contrato Social"] : [])].map((item) => {
                          const pending = detailDemand.kyc_missing.includes(item);
                          return (
                            <div key={item} className="flex items-center gap-2 text-xs">
                              {pending ? (
                                <span className="w-3.5 h-3.5 rounded-full border border-[#9BAFC5]/40 flex-shrink-0" />
                              ) : (
                                <Check size={14} className="text-emerald-400 flex-shrink-0" />
                              )}
                              <span className={pending ? "text-[#9BAFC5]" : "text-[#F5F1E8]"}>{item}</span>
                            </div>
                          );
                        })}
                      </div>
                      {mode === "mesa" && (
                        <button
                          onClick={approveKyc}
                          disabled={!detailDemand.kyc_ready_for_approval || approvingKyc}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#C9A84C] text-[#09081A] rounded-lg text-xs font-bold hover:bg-[#D4B96A] transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          {approvingKyc ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                          Aprovar KYC
                        </button>
                      )}
                      {!detailDemand.kyc_ready_for_approval && (
                        <p className="text-[10px] text-[#5A7490]">Faltando: {detailDemand.kyc_missing.join(", ")}.</p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Timeline (BRIEF 3b, 19/08/2026): eventos automaticos (documento anexado, KYC
                  aprovado) + notas manuais da Mesa, visivel pra quem estrutura/origina o deal. */}
              <div>
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#E8C97A] mb-2.5">
                  <History size={12} /> Timeline
                </div>
                {mode === "mesa" && (
                  <div className="flex gap-2 mb-3">
                    <input
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addNote()}
                      placeholder="Adicionar nota..."
                      className="flex-1 bg-[#12112A] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] placeholder:text-[#9BAFC5]/40 focus:border-[#C9A84C]/40 focus:outline-none"
                    />
                    <button
                      onClick={addNote}
                      disabled={savingNote || !newNote.trim()}
                      className="px-3 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-lg text-[#C9A84C] disabled:opacity-30"
                    >
                      {savingNote ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    </button>
                  </div>
                )}
                {timelineLoading ? (
                  <div className="flex items-center justify-center py-6"><Loader2 size={16} className="text-[#9BAFC5] animate-spin" /></div>
                ) : timeline.length === 0 ? (
                  <p className="text-xs text-[#5A7490] bg-[#12112A] border border-dashed border-[#243A66] rounded-lg py-4 text-center">Nenhum evento registrado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {timeline.map((n) => (
                      <div key={n.id} className={`rounded-lg px-3 py-2.5 text-xs ${n.is_system ? "bg-[#12112A] border border-dashed border-[#243A66] text-[#9BAFC5]" : "bg-[#162744] text-[#F5F1E8]"}`}>
                        <p>{n.content}</p>
                        <div className="text-[9px] text-[#5A7490] mt-1">
                          {n.is_system ? "Sistema" : n.profiles?.full_name ?? "Mesa"} · {new Date(n.created_at).toLocaleString("pt-BR")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <QualificationBatchesPanel demandId={detailDemand.id} cardLabel={`Comprador ${detailDemand.nome_contato}`} />
            </div>
          </div>
        </div>
      )}

      {indicateDemand && (
        <QuickIndicateModal
          side="BUY_SIDE"
          demandId={indicateDemand.id}
          anchorLabel={indicateDemand.nome_contato}
          onClose={() => setIndicateDemand(null)}
        />
      )}
    </div>
  );
}
