"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, FileText, X, Download, RefreshCw, Repeat, ShoppingCart, IdCard, Target, ShieldCheck, Link2, Check, UserPlus } from "lucide-react";
import { QuickIndicateModal } from "@/components/cm/quick-indicate-modal";

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
  created_at: string;
};

type KycDoc = {
  id: string;
  document_type: string;
  original_filename: string;
  download_url: string | null;
  created_at: string;
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
    try {
      const res = await fetch(`/api/cm/kyc-documents?demand_id=${demand.id}`);
      const json = await res.json();
      setDocs(json.documents ?? []);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
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
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Ticket" value={`${formatM(detailDemand.ticket_min)} a ${formatM(detailDemand.ticket_max)}`} />
                    <Field label="Deságio Mínimo" value={detailDemand.desagio_min ? `${detailDemand.desagio_min}%` : null} />
                    <Field label="Jurisdição de Interesse" value={detailDemand.jurisdicao_alvo?.join(", ")} />
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
