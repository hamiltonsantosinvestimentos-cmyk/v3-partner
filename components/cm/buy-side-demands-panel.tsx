"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, FileText, X, Download, RefreshCw, Repeat, ShoppingCart } from "lucide-react";

type BuyDemand = {
  id: string;
  nome_contato: string;
  empresa: string | null;
  asset_types_preferidos: string[] | null;
  setores: string[];
  ticket_min: number;
  ticket_max: number;
  status: string;
  purchase_frequency_type: string | null;
  recurrence_months: number | null;
  origin_partner: { id: string; full_name: string } | null;
  document_count: number;
  match_count: number;
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

function formatM(v: number) {
  if (!v) return "R$ 0";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  return `R$ ${(v / 1e3).toFixed(0)}K`;
}

export function BuySideDemandsPanel() {
  const [demands, setDemands] = useState<BuyDemand[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsModalDemand, setDocsModalDemand] = useState<BuyDemand | null>(null);
  const [docs, setDocs] = useState<KycDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

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

  const openDocs = async (demand: BuyDemand) => {
    setDocsModalDemand(demand);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#F5F1E8]">Demandas de Compra (Buy-Side)</p>
          <p className="text-xs text-[#9BAFC5]">Compradores cadastrados via link de intake, com ou sem match já executado</p>
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
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Partner de Origem</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Ativo Pretendido</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Ticket</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Frequência</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Status</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Ação</th>
              </tr>
            </thead>
            <tbody>
              {demands.map((d) => (
                <tr key={d.id} className="border-b border-[#162744] last:border-0 hover:bg-[#162744]/40">
                  <td className="px-3 py-3">
                    <div className="text-[#F5F1E8] font-semibold">{d.nome_contato}</div>
                    {d.empresa && <div className="text-[#9BAFC5] text-[10px]">{d.empresa}</div>}
                  </td>
                  <td className="px-3 py-3 text-[#9BAFC5]">
                    {d.origin_partner?.full_name ?? <span className="text-[#5A7490]">Sem atribuição</span>}
                  </td>
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
                    <span className="text-[9px] px-2 py-0.5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#E8C97A] font-semibold">
                      {d.status}
                    </span>
                    {d.match_count > 0 && (
                      <div className="text-[9px] text-[#9BAFC5] mt-1">{d.match_count} match(es)</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => openDocs(d)}
                      className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-[10px] font-semibold px-2.5 py-1.5 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                    >
                      <FileText size={11} /> Documentos ({d.document_count})
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de documentos */}
      {docsModalDemand && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60" onClick={() => setDocsModalDemand(null)}>
          <div className="w-full max-w-md max-h-[70vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
              <div>
                <div className="text-sm font-bold text-[#F5F1E8]">Documentos / KYC</div>
                <div className="text-[10px] text-[#9BAFC5]">{docsModalDemand.nome_contato}</div>
              </div>
              <button onClick={() => setDocsModalDemand(null)} className="text-[#9BAFC5] hover:text-[#F5F1E8]">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {docsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="text-[#9BAFC5] animate-spin" />
                </div>
              ) : docs.length === 0 ? (
                <p className="text-center text-[#5A7490] text-xs py-8">Nenhum documento enviado ainda pelo comprador.</p>
              ) : (
                docs.map((doc) => (
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
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
