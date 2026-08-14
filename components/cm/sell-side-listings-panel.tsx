"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, FileText, X, Download, RefreshCw, Package, Link2, Check, UserPlus, Upload } from "lucide-react";
import { QuickIndicateModal } from "@/components/cm/quick-indicate-modal";
import { QualificationBatchesPanel } from "@/components/cm/qualification-batches-panel";

// Equivalente Sell-Side de buy-side-demands-panel.tsx (13/08/2026). Mesmo motivo de existir:
// Joao relatou que o Partner que origina um ATIVO (nao so um comprador) tambem nao tinha
// nenhum jeito de acompanhar status/documentos/indicar comissionados -- cm_asset_listings ja
// tinha originator_profile_id desde 07/07 (espelha ma_deals), so nunca teve rota nem tela.

type Listing = {
  id: string;
  anonymous_id: string;
  numero_interno: string | null;
  apelido: string | null;
  asset_type: string;
  seller_name: string;
  valor_face: number;
  currency: string | null;
  listing_status: string;
  cm_intake_token: string | null;
  originator: { id: string; full_name: string } | null;
  cm_bids: { count: number }[];
  cm_listing_documents: { count: number }[];
  created_at: string;
};

type ListingDoc = {
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
  imovel: "Imóvel",
  cgi: "CGI",
  cri: "CRI",
  fidc: "FIDC",
  outros: "Outros",
};

// Cor por status -- mesmo criterio pedido por Joao pro lado comprador: escanear rapido o
// estagio do ativo sem ler o texto inteiro.
const STATUS_META: Record<string, { label: string; dot: string; text: string; bg: string; border: string }> = {
  reuniao_validada: { label: "Reunião Validada", dot: "#5A7490", text: "#9BAFC5", bg: "rgba(90,116,144,0.12)", border: "rgba(90,116,144,0.3)" },
  formulario_preenchido: { label: "Formulário Preenchido", dot: "#5A7490", text: "#9BAFC5", bg: "rgba(90,116,144,0.12)", border: "rgba(90,116,144,0.3)" },
  nda_assinado: { label: "NDA Assinado", dot: "#E8935A", text: "#E8935A", bg: "rgba(232,147,90,0.12)", border: "rgba(232,147,90,0.3)" },
  em_analise: { label: "Em Análise", dot: "#E8935A", text: "#E8935A", bg: "rgba(232,147,90,0.12)", border: "rgba(232,147,90,0.3)" },
  aprovado_head: { label: "Aprovado pela Diretoria", dot: "#C9A84C", text: "#C9A84C", bg: "rgba(201,168,76,0.12)", border: "rgba(201,168,76,0.3)" },
  ativo_vitrine: { label: "Ativo na Vitrine", dot: "#C9A84C", text: "#C9A84C", bg: "rgba(201,168,76,0.12)", border: "rgba(201,168,76,0.3)" },
  proposta_recebida: { label: "Proposta Recebida", dot: "#C9A84C", text: "#C9A84C", bg: "rgba(201,168,76,0.12)", border: "rgba(201,168,76,0.3)" },
  em_escrow_due_diligence: { label: "Escrow / Due Diligence", dot: "#4ADE80", text: "#4ADE80", bg: "rgba(74,222,128,0.12)", border: "rgba(74,222,128,0.3)" },
  liquidado: { label: "Liquidado", dot: "#4ADE80", text: "#4ADE80", bg: "rgba(74,222,128,0.12)", border: "rgba(74,222,128,0.3)" },
  cancelado: { label: "Cancelado", dot: "#F87171", text: "#F87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" },
  expirado: { label: "Expirado", dot: "#F87171", text: "#F87171", bg: "rgba(248,113,113,0.12)", border: "rgba(248,113,113,0.3)" },
};

function formatM(v: number, currency?: string | null) {
  const symbol = currency === "USD" ? "US$" : currency === "EUR" ? "€" : "R$";
  if (!v) return `${symbol} 0`;
  if (v >= 1e9) return `${symbol} ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `${symbol} ${(v / 1e6).toFixed(1)}M`;
  return `${symbol} ${(v / 1e3).toFixed(0)}K`;
}

function StatusChip({ status }: { status: string }) {
  const s = STATUS_META[status] ?? STATUS_META.reuniao_validada;
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

interface SellSideListingsPanelProps {
  mode?: "mesa" | "mine";
  title?: string;
  subtitle?: string;
}

export function SellSideListingsPanel({ mode = "mine", title, subtitle }: SellSideListingsPanelProps) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Listing | null>(null);
  const [docs, setDocs] = useState<ListingDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [indicateListing, setIndicateListing] = useState<Listing | null>(null);
  const [uploading, setUploading] = useState(false);

  const copyLink = (l: Listing) => {
    if (!l.cm_intake_token) return;
    const url = `${window.location.origin}/intake/cm/${l.cm_intake_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(l.id);
    setTimeout(() => setCopiedId((cur) => (cur === l.id ? null : cur)), 2000);
  };

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cm/listings");
      const json = await res.json();
      setListings(json.listings ?? []);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const openDetail = async (listing: Listing) => {
    setDetail(listing);
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/cm/listings/${listing.id}/documents`);
      const json = await res.json();
      setDocs(json.documents ?? []);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const uploadDoc = async (listing: Listing, file: File) => {
    setUploading(true);
    try {
      const urlRes = await fetch(`/api/cm/listings/${listing.id}/documents/upload-url?file_name=${encodeURIComponent(file.name)}`);
      const urlJson = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlJson.error ?? "Erro ao gerar URL de upload");

      const uploadRes = await fetch(urlJson.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!uploadRes.ok) throw new Error("Upload ao Storage falhou");

      const metaRes = await fetch(`/api/cm/listings/${listing.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_path: urlJson.storagePath,
          original_filename: file.name,
          file_size_bytes: file.size,
          content_type: file.type,
        }),
      });
      if (!metaRes.ok) throw new Error((await metaRes.json()).error ?? "Erro ao registrar documento");

      await openDetail(listing);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao enviar documento");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#F5F1E8]">{title ?? "Ativos na Bolsa de Capitais"}</p>
          <p className="text-xs text-[#9BAFC5]">{subtitle ?? "Ativos cadastrados, com status e documentos"}</p>
        </div>
        <button
          onClick={fetchListings}
          className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-xs font-semibold px-3 py-2 hover:text-[#F5F1E8] hover:border-[#9BAFC5]/40 transition-colors"
        >
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="text-[#9BAFC5] animate-spin" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-[#243A66]">
          <Package size={24} className="text-[#5A7490] mx-auto mb-3 opacity-40" />
          <p className="text-[#5A7490] text-sm">{mode === "mine" ? "Nenhum ativo seu cadastrado ainda." : "Nenhum ativo cadastrado."}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#243A66]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#243A66] bg-[#13223A] text-left">
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Ativo</th>
                {mode === "mesa" && <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Partner de Origem</th>}
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Tipo</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Valor de Face</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Status</th>
                <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-widest text-[#E8C97A]">Ação</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => openDetail(l)}
                  className="border-b border-[#162744] last:border-0 hover:bg-[#162744]/40 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-3">
                    <div className="text-[#F5F1E8] font-semibold">{l.anonymous_id}</div>
                    {l.apelido && <div className="text-[#9BAFC5] text-[10px]">{l.apelido}</div>}
                  </td>
                  {mode === "mesa" && (
                    <td className="px-3 py-3 text-[#9BAFC5]">
                      {l.originator?.full_name ?? <span className="text-[#5A7490]">Sem atribuição</span>}
                    </td>
                  )}
                  <td className="px-3 py-3">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#C9A84C]/10 text-[#E8C97A]">
                      {ASSET_LABEL[l.asset_type] ?? l.asset_type}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-[#C9A84C] font-bold whitespace-nowrap">{formatM(Number(l.valor_face), l.currency)}</td>
                  <td className="px-3 py-3">
                    <StatusChip status={l.listing_status} />
                    {(l.cm_listing_documents?.[0]?.count ?? 0) > 0 && (
                      <div className="text-[9px] text-[#9BAFC5] mt-1">{l.cm_listing_documents[0].count} doc(s)</div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); openDetail(l); }}
                        className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-[10px] font-semibold px-2.5 py-1.5 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                      >
                        <FileText size={11} /> Ficha
                      </button>
                      {l.cm_intake_token && (
                        <button
                          onClick={(e) => { e.stopPropagation(); copyLink(l); }}
                          title="Copiar link de intake"
                          className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-[10px] font-semibold px-2.5 py-1.5 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                        >
                          {copiedId === l.id ? <Check size={11} className="text-emerald-400" /> : <Link2 size={11} />}
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setIndicateListing(l); }}
                        title="Indicar finder, intermediário ou mandatário deste ativo"
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

      {detail && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-2xl max-h-[85vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: (STATUS_META[detail.listing_status] ?? STATUS_META.reuniao_validada).border }}>
              <div>
                <div className="text-sm font-bold text-[#F5F1E8]">{detail.anonymous_id}</div>
                {detail.apelido && <div className="text-[10px] text-[#9BAFC5]">{detail.apelido}</div>}
                <div className="mt-1.5"><StatusChip status={detail.listing_status} /></div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setIndicateListing(detail)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-[10px] font-semibold px-2.5 py-1.5 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                >
                  <UserPlus size={12} /> Indicar
                </button>
                {detail.cm_intake_token && (
                  <button
                    onClick={() => copyLink(detail)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-[10px] font-semibold px-2.5 py-1.5 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors"
                  >
                    {copiedId === detail.id ? <Check size={12} className="text-emerald-400" /> : <Link2 size={12} />}
                    {copiedId === detail.id ? "Copiado" : "Copiar Link"}
                  </button>
                )}
                <button onClick={() => setDetail(null)} className="text-[#9BAFC5] hover:text-[#F5F1E8]">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              <div className="grid grid-cols-2 gap-3 bg-[#12112A] border border-[#243A66] rounded-lg p-3">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#9BAFC5]/70">Tipo</div>
                  <div className="text-xs text-[#F5F1E8] mt-0.5">{ASSET_LABEL[detail.asset_type] ?? detail.asset_type}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-[#9BAFC5]/70">Valor de Face</div>
                  <div className="text-xs text-[#F5F1E8] mt-0.5">{formatM(Number(detail.valor_face), detail.currency)}</div>
                </div>
                {detail.numero_interno && (
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-[#9BAFC5]/70">Número Interno</div>
                    <div className="text-xs text-[#F5F1E8] mt-0.5">{detail.numero_interno}</div>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#E8C97A]">
                    <FileText size={12} /> Documentos
                  </div>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-[#C9A84C] hover:text-[#E8C97A] cursor-pointer">
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                    Enviar documento
                    <input
                      type="file"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => { if (e.target.files?.[0]) uploadDoc(detail, e.target.files[0]); }}
                    />
                  </label>
                </div>
                {docsLoading ? (
                  <div className="flex items-center justify-center py-6"><Loader2 size={16} className="text-[#9BAFC5] animate-spin" /></div>
                ) : docs.length === 0 ? (
                  <p className="text-xs text-[#5A7490] bg-[#12112A] border border-dashed border-[#243A66] rounded-lg py-4 text-center">Nenhum documento enviado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {docs.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between gap-2 bg-[#162744] rounded-lg px-3 py-2.5">
                        <div className="min-w-0">
                          <div className="text-xs text-[#F5F1E8] font-semibold truncate">{doc.original_filename}</div>
                          <div className="text-[10px] text-[#9BAFC5]">{doc.document_type}</div>
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

              <QualificationBatchesPanel listingId={detail.id} cardLabel={`Ativo ${detail.anonymous_id}`} />
            </div>
          </div>
        </div>
      )}

      {indicateListing && (
        <QuickIndicateModal
          side="SELL_SIDE"
          listingId={indicateListing.id}
          anchorLabel={indicateListing.anonymous_id}
          onClose={() => setIndicateListing(null)}
        />
      )}
    </div>
  );
}
