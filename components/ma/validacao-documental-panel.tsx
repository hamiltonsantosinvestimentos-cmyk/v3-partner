"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2, XCircle, FileText, Loader2, ChevronRight,
  AlertCircle, Zap, RefreshCw, ShieldCheck,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ValidacaoDocumentalProps {
  deal: {
    id: string;
    code: string;
    target_company: string;
    sector: string;
    deal_value: number;
    asset_data: Record<string, unknown>;
    stage: string;
  };
}

type DocEntry = {
  doc_id: string;
  file_name: string;
  uploaded_at: string;
  url?: string | null;
};

type PdfExtraction = {
  tipo_documento: string;
  dados_extraidos: {
    empresa?: string;
    cnpj?: string;
    periodo?: string;
    receita?: string;
    ebitda?: string;
    lucro?: string;
    socios?: string[];
    outros?: Record<string, string>;
  };
  pendencias?: string[];
  validade?: string;
  resumo: string;
  confiabilidade: number;
  doc_name?: string;
  extracted_at?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatM(v: number) {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v}`;
}

function confidenceColor(score: number) {
  if (score >= 80) return "text-emerald-400";
  if (score >= 55) return "text-amber-400";
  return "text-red-400";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ValidacaoDocumentalPanel({ deal }: ValidacaoDocumentalProps) {
  const [docs, setDocs]               = useState<DocEntry[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  // extracoes[doc_id] = resultado da extração
  const [extracoes, setExtracoes]     = useState<Record<string, PdfExtraction>>({});
  // extracting[doc_id] = true enquanto processa
  const [extracting, setExtracting]   = useState<Record<string, boolean>>({});
  const [extractErrors, setExtractErrors] = useState<Record<string, string>>({});

  const fetchDocs = useCallback(() => {
    setDocsLoading(true);
    fetch(`/api/ma/documents?deal_id=${deal.id}`)
      .then((r) => r.json())
      .then((data) => setDocs(Array.isArray(data.documents) ? data.documents : []))
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false));
  }, [deal.id]);

  // Carrega extrações já salvas no asset_data
  useEffect(() => {
    fetchDocs();
    const saved = (deal.asset_data?.forja_pdf_extractions ?? {}) as Record<string, PdfExtraction>;
    setExtracoes(saved);
  }, [deal.id, deal.asset_data, fetchDocs]);

  const handleExtract = async (doc: DocEntry) => {
    setExtracting((p) => ({ ...p, [doc.doc_id]: true }));
    setExtractErrors((p) => ({ ...p, [doc.doc_id]: "" }));
    try {
      const res = await fetch("/api/ma/forja-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_id: deal.id, doc_id: doc.doc_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
      setExtracoes((p) => ({ ...p, [doc.doc_id]: data.extraction as PdfExtraction }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setExtractErrors((p) => ({ ...p, [doc.doc_id]: msg }));
    } finally {
      setExtracting((p) => ({ ...p, [doc.doc_id]: false }));
    }
  };

  // Calcula status geral com base nas extrações disponíveis
  const docsWithExtraction = docs.filter((d) => extracoes[d.doc_id]);
  const allRequiredPresent  = docs.length > 0 && docsWithExtraction.length === docs.length;

  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto">

      {/* Header */}
      <div className="border-b border-[#162744] pb-4">
        <p className="text-[10px] font-bold tracking-widest text-[#C9A84C] uppercase mb-1">{deal.code}</p>
        <h2 className="text-lg font-bold text-[#F0ECE4]">{deal.target_company}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[#7A8FA8]">{deal.sector}</span>
          <span className="text-[#243A66]">·</span>
          <span className="text-xs font-semibold text-[#C9A84C]">{formatM(deal.deal_value)}</span>
        </div>
      </div>

      {/* Lista de documentos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold tracking-widest text-[#7A8FA8] uppercase">
            Documentos do Deal
          </p>
          <button
            onClick={fetchDocs}
            className="text-[10px] text-muted-foreground hover:text-[#C9A84C] flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Atualizar
          </button>
        </div>

        {docsLoading ? (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando documentos...
          </div>
        ) : docs.length === 0 ? (
          <div className="rounded-lg border border-[#243A66] bg-[#111F35] p-4 text-center">
            <FileText className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Nenhum documento enviado para este deal.</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Faça upload na aba de detalhes do deal para habilitar a validação por IA.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => {
              const ext      = extracoes[doc.doc_id];
              const isLoading = extracting[doc.doc_id];
              const errMsg   = extractErrors[doc.doc_id];

              return (
                <div
                  key={doc.doc_id}
                  className={`rounded-lg border transition-colors ${
                    ext ? "border-emerald-500/20 bg-emerald-500/5" : "border-[#243A66] bg-[#111F35]"
                  }`}
                >
                  {/* Doc header */}
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    {ext
                      ? <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-400" />
                      : <FileText size={14} className="flex-shrink-0 text-[#7A8FA8]" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-[#F0ECE4] truncate">{doc.file_name}</p>
                      {ext && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {ext.tipo_documento} · confiabilidade{" "}
                          <span className={confidenceColor(ext.confiabilidade)}>{ext.confiabilidade}%</span>
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleExtract(doc)}
                      disabled={isLoading}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-colors ${
                        ext
                          ? "border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10"
                          : "bg-[#C9A84C]/10 border border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/20"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isLoading
                        ? <><Loader2 size={10} className="animate-spin" /> Extraindo...</>
                        : ext
                          ? <><RefreshCw size={10} /> Re-analisar</>
                          : <><Zap size={10} /> Extrair com IA</>
                      }
                    </button>
                  </div>

                  {/* Extraction result */}
                  {ext && (
                    <div className="border-t border-emerald-500/10 px-3 py-3 space-y-3">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{ext.resumo}</p>

                      {/* Dados extraídos */}
                      {ext.dados_extraidos && Object.keys(ext.dados_extraidos).filter(
                        (k) => k !== "outros" && ext.dados_extraidos[k as keyof typeof ext.dados_extraidos]
                      ).length > 0 && (
                        <div className="grid grid-cols-2 gap-1.5">
                          {(["empresa","cnpj","periodo","receita","ebitda","lucro"] as const).map((k) => {
                            const val = ext.dados_extraidos[k];
                            if (!val) return null;
                            const labels: Record<string, string> = {
                              empresa: "Empresa", cnpj: "CNPJ", periodo: "Período",
                              receita: "Receita", ebitda: "EBITDA", lucro: "Lucro",
                            };
                            return (
                              <div key={k} className="rounded bg-[#111F35] border border-[#162744] px-2 py-1.5">
                                <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{labels[k]}</p>
                                <p className="text-[11px] text-[#F0ECE4] font-medium">{val}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Sócios */}
                      {ext.dados_extraidos?.socios?.length ? (
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Sócios / Diretores</p>
                          <div className="flex flex-wrap gap-1">
                            {ext.dados_extraidos.socios.map((s, i) => (
                              <span key={i} className="text-[10px] bg-[#162744] border border-[#243A66] rounded px-2 py-0.5 text-[#F0ECE4]">{s}</span>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Pendências */}
                      {ext.pendencias?.length ? (
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-red-400/70 mb-1">Pendências Identificadas</p>
                          {ext.pendencias.map((p, i) => (
                            <div key={i} className="flex items-start gap-1.5 mb-1">
                              <XCircle size={10} className="text-red-400 flex-shrink-0 mt-0.5" />
                              <p className="text-[10px] text-[#F0ECE4]">{p}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {/* Validade */}
                      {ext.validade && (
                        <p className="text-[10px] text-muted-foreground">
                          Validade: <span className="text-[#F0ECE4]">{ext.validade}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Error */}
                  {errMsg && (
                    <div className="border-t border-red-500/20 px-3 py-2">
                      <p className="text-[10px] text-red-400">{errMsg}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {docs.length > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#162744] border border-[#243A66] px-3 py-2">
            <AlertCircle size={13} className="flex-shrink-0" style={{ color: allRequiredPresent ? "#10B981" : "#F59E0B" }} />
            <span className="text-xs text-[#7A8FA8]">
              {docsWithExtraction.length}/{docs.length} documentos analisados pela IA
              {docsWithExtraction.length < docs.length && ` · ${docs.length - docsWithExtraction.length} pendente${docs.length - docsWithExtraction.length > 1 ? "s" : ""}`}
            </span>
            {docsWithExtraction.length > 0 && (
              <ShieldCheck className="w-3.5 h-3.5 text-[#C9A84C] ml-auto flex-shrink-0" />
            )}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="mt-auto pt-2">
        {allRequiredPresent ? (
          <a
            href={`/ma/${deal.id}/criativos`}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold py-3 hover:bg-emerald-400 transition-colors"
          >
            Documentos Validados — Gerar Kit de Criativos
            <ChevronRight size={15} />
          </a>
        ) : (
          <div className="relative group">
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#243A66] bg-[#162744] text-[#7A8FA8] text-sm font-medium py-3 cursor-not-allowed opacity-60"
            >
              Gerar Kit de Criativos
            </button>
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-[#09081A] border border-[#243A66] text-[#7A8FA8] text-[11px] px-3 py-1.5 rounded-lg whitespace-nowrap z-10">
              Analise todos os documentos para liberar
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
