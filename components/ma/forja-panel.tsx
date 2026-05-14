"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, AlertTriangle, XCircle, Zap, ChevronDown, ChevronUp,
  FileImage, Loader2, FileText, CheckSquare, Square, ShieldCheck,
  Download, Send, CheckCheck,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type ValidatedField = { field: string; value: string; note?: string; doc_confirmed?: boolean };
type CorrectedField = { field: string; original: string; corrected: string; reason: string; doc_source?: string };
type MissingField   = { field: string; impact: string; priority: "ALTA" | "MEDIA" | "BAIXA" };
type DocInsight     = { doc: string; finding: string };

type ForjaResult = {
  score: number;
  validated: ValidatedField[];
  corrected: CorrectedField[];
  missing: MissingField[];
  doc_insights?: DocInsight[];
  tese_investimento?: string[];
  narrative_pt: string;
  narrative_en: string;
  recommendation: "APROVADO" | "APROVADO_COM_RESSALVAS" | "PENDENTE" | "BLOQUEADO";
  recommendation_note: string;
  docs_analyzed?: number;
};

type DocEntry = {
  doc_id: string;
  file_name: string;
  storage_path: string;
  uploaded_at: string;
  url?: string | null;
};

// ─── Config ───────────────────────────────────────────────────────────────────

const REC_CONFIG = {
  APROVADO:               { label: "Aprovado",               color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", bar: "bg-emerald-500" },
  APROVADO_COM_RESSALVAS: { label: "Aprovado com Ressalvas", color: "bg-amber-500/20 text-amber-400 border-amber-500/30",   bar: "bg-amber-500"   },
  PENDENTE:               { label: "Pendente",               color: "bg-orange-500/20 text-orange-400 border-orange-500/30", bar: "bg-orange-500"  },
  BLOQUEADO:              { label: "Bloqueado",               color: "bg-red-500/20 text-red-400 border-red-500/30",         bar: "bg-red-500"     },
};

const PRIORITY_COLORS = {
  ALTA:  "bg-red-500/20 text-red-400 border-red-500/30",
  MEDIA: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  BAIXA: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface ForjaPanelProps {
  deal: Record<string, unknown>;
  dealId: string;
  savedResult?: ForjaResult | null;
  onSaved?: (result: ForjaResult) => void;
  onReportSaved?: (reportUrl: string, generatedAt: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ForjaPanel({ deal, dealId, savedResult, onSaved, onReportSaved }: ForjaPanelProps) {
  const [result, setResult]               = useState<ForjaResult | null>(savedResult ?? null);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [showNarrative, setShowNarrative] = useState(false);
  const [saving, setSaving]               = useState(false);

  const [exporting, setExporting]   = useState(false);
  const [exported, setExported]     = useState<{ url: string; emails: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Teaser Cego
  const [teaserLoading, setTeaserLoading] = useState(false);
  const [teaserError, setTeaserError]     = useState<string | null>(null);
  const [teaserDone, setTeaserDone]       = useState(false);

  const [docs, setDocs]                 = useState<DocEntry[]>([]);
  const [docsLoading, setDocsLoading]   = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [showDocs, setShowDocs]         = useState(false);

  // Carrega documentos do deal
  useEffect(() => {
    if (!dealId) return;
    setDocsLoading(true);
    fetch(`/api/ma/documents?deal_id=${dealId}`)
      .then((r) => r.json())
      .then((data) => setDocs(Array.isArray(data.documents) ? data.documents : []))
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false));
  }, [dealId]);

  const toggleDoc = (id: string) =>
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleValidate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ma/forja-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deal: { ...deal, id: dealId },
          doc_ids: selectedDocIds.length > 0 ? selectedDocIds : undefined,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data: ForjaResult = await res.json();
      setResult(data);

      if (dealId) {
        setSaving(true);
        try {
          await fetch("/api/ma/forja-kit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deal_id: dealId, action: "save_forja", forja_result: data }),
          });
          if (onSaved) onSaved(data);
        } catch { /* silencioso — resultado já exibido */ }
        setSaving(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Falha na validação: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!result) return;
    setExporting(true);
    setExportError(null);
    setExported(null);
    try {
      const res = await fetch("/api/ma/forja-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_id: dealId, deal: { ...deal, id: dealId }, forja_result: result }),
      });
      const data = await res.json() as {
        ok?: boolean; error?: string;
        report_url?: string; report_html?: string;
        emails_sent?: number; notifications_created?: number;
      };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      const now = new Date().toISOString();
      setExported({ url: data.report_url ?? "", emails: data.emails_sent ?? 0 });
      // Notifica o pai para atualizar asset_data.forja_reports imediatamente
      if (onReportSaved && data.report_url) onReportSaved(data.report_url, now);
      // Abre via Blob URL com charset explícito — evita mojibake do Supabase Storage
      if (data.report_html) {
        const blob = new Blob([data.report_html], { type: "text/html;charset=utf-8" });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      } else if (data.report_url) {
        window.open(data.report_url, "_blank");
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const handleTeaserCego = async () => {
    setTeaserLoading(true);
    setTeaserError(null);
    setTeaserDone(false);
    try {
      const res = await fetch("/api/ma/gerar-teaser-cego", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal_id: dealId }),
      });
      const data = await res.json() as { ok?: boolean; html?: string; error?: string };
      if (!res.ok || !data.html) throw new Error(data.error ?? `HTTP ${res.status}`);
      const blob = new Blob([data.html], { type: "text/html;charset=utf-8" });
      window.open(URL.createObjectURL(blob), "_blank");
      setTeaserDone(true);
    } catch (e) {
      setTeaserError(e instanceof Error ? e.message : "Erro ao gerar teaser");
    } finally {
      setTeaserLoading(false);
    }
  };

  const rec         = result ? REC_CONFIG[result.recommendation] : null;
  const canProceed  = result && (result.recommendation === "APROVADO" || result.recommendation === "APROVADO_COM_RESSALVAS");
  const docsLabel   = selectedDocIds.length > 0 ? `com ${selectedDocIds.length} doc${selectedDocIds.length > 1 ? "s" : ""}` : null;

  return (
    <div className="space-y-4">

      {/* Header card */}
      <Card className="border-[#C9A84C]/30 bg-gradient-to-br from-[#162744] to-[#111F35]">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-[#09081A]" />
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-0.5">
                  FORJA — Validação M&A
                </p>
                <p className="text-sm font-semibold text-white">
                  {result ? "Relatório de Validação Gerado" : "Validador de Dados do Ativo"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {result
                    ? `${result.validated.length} validados · ${result.corrected.length} corrigidos · ${result.missing.length} ausentes${result.docs_analyzed ? ` · ${result.docs_analyzed} doc${result.docs_analyzed > 1 ? "s" : ""} analisado${result.docs_analyzed > 1 ? "s" : ""}` : ""}`
                    : "Analisa e valida todos os dados antes de gerar os criativos"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {result && canProceed && (
                <Link href={`/ma/${dealId}/criativos`}>
                  <Button size="sm" className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold flex items-center gap-1.5">
                    <FileImage className="w-3.5 h-3.5" />
                    Gerar Criativos
                  </Button>
                </Link>
              )}
              <Button
                size="sm"
                onClick={handleValidate}
                disabled={loading}
                variant={result ? "outline" : "default"}
                className={result
                  ? "border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10"
                  : "bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold"}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    {docsLabel ? `Validando ${docsLabel}...` : "Validando..."}
                  </>
                ) : saving ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Salvando...</>
                ) : result ? (
                  docsLabel ? `Revalidar ${docsLabel}` : "Revalidar"
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                    {docsLabel ? `Validar ${docsLabel}` : "Validar com FORJA"}
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Score bar */}
          {result && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Score de Qualidade</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">{result.score}/100</span>
                  <Badge className={rec!.color}>{rec!.label}</Badge>
                  {result.docs_analyzed ? (
                    <Badge className="bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30 flex items-center gap-1">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      {result.docs_analyzed} doc{result.docs_analyzed > 1 ? "s" : ""}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="h-2 bg-[#09081A] rounded-full overflow-hidden">
                <div className={`h-full ${rec!.bar} rounded-full transition-all duration-700`} style={{ width: `${result.score}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{result.recommendation_note}</p>
            </div>
          )}

          {/* Loading */}
          {loading && !result && (
            <div className="mt-4">
              <div className="h-1.5 bg-[#09081A] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {docsLabel ? `Analisando dados + ${docsLabel}...` : "Analisando dados do ativo..."}
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" />{error}
            </p>
          )}

          {/* Teaser Cego — visível para qualquer resultado FORJA */}
          {result && (
            <div className="mt-3 pt-3 border-t border-[#243A66] flex items-center gap-3 flex-wrap">
              <Button
                size="sm"
                onClick={handleTeaserCego}
                disabled={teaserLoading}
                variant="outline"
                className="border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10 flex items-center gap-1.5"
              >
                {teaserLoading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" />Gerando Teaser...</>
                ) : teaserDone ? (
                  <><CheckCheck className="w-3.5 h-3.5" />Teaser Gerado</>
                ) : (
                  <><FileText className="w-3.5 h-3.5" />Gerar Teaser Cego</>
                )}
              </Button>
              <span className="text-[10px] text-muted-foreground">
                Disponível para qualquer status FORJA · identidade do ativo omitida automaticamente
              </span>
              {teaserError && (
                <span className="text-xs text-red-400 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />{teaserError}
                </span>
              )}
            </div>
          )}

          {/* Exportar Relatório — sempre visível, desabilitado sem resultado */}
          <div className="mt-4 pt-4 border-t border-[#243A66] flex items-center gap-3 flex-wrap">
            <Button
              size="sm"
              onClick={handleExport}
              disabled={exporting || !result}
              variant="outline"
              title={!result ? "Execute a validação FORJA primeiro" : undefined}
              className={`flex items-center gap-1.5 transition-all ${
                result
                  ? "border-[#243A66] text-[#F0ECE4] hover:bg-[#162744]"
                  : "border-[#243A66]/40 text-[#7A8FA8] cursor-not-allowed opacity-50"
              }`}
            >
              {exporting ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" />Gerando...</>
              ) : exported ? (
                <><CheckCheck className="w-3.5 h-3.5 text-emerald-400" />Relatório Gerado</>
              ) : (
                <><Download className="w-3.5 h-3.5" />Exportar Relatório</>
              )}
            </Button>

            {/* Abrir último — session ou Storage */}
            {(() => {
              const sessionUrl = exported?.url;
              const reports = (deal?.asset_data as Record<string, unknown> | undefined)
                ?.forja_reports as Array<{ url: string; generated_at: string }> | undefined;
              const savedUrl  = reports?.[0]?.url;
              const savedDate = reports?.[0]?.generated_at
                ? new Date(reports[0].generated_at).toLocaleDateString("pt-BR")
                : null;
              const url  = sessionUrl || savedUrl;
              const label = sessionUrl ? "Abrir relatório" : savedDate ? `Abrir último (${savedDate})` : null;
              if (!url || !label) return null;
              return (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] text-[#C9A84C] hover:underline flex-shrink-0"
                >
                  <FileText className="w-3 h-3" />
                  {label}
                </a>
              );
            })()}

            {!result && !loading && (
              <span className="text-[10px] text-muted-foreground">
                Execute a validação para liberar o relatório
              </span>
            )}

            {exported && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Send className="w-3 h-3 text-[#C9A84C]" />
                {exported.emails > 0
                  ? `Notificado — ${exported.emails} email${exported.emails > 1 ? "s" : ""} enviado${exported.emails > 1 ? "s" : ""}`
                  : "Notificações criadas na plataforma"}
              </span>
            )}

            {exportError && (
              <span className="text-xs text-red-400">{exportError}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seleção de documentos */}
      {!docsLoading && (
        <Card className="border-[#243A66]">
          <CardHeader className="pb-2 pt-3">
            <button
              onClick={() => setShowDocs(!showDocs)}
              className="flex items-center justify-between w-full text-left"
            >
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#7A8FA8] flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" />
                Documentos para Validação
                {docs.length > 0 && (
                  <span className="text-[#C9A84C]">({docs.length})</span>
                )}
                {selectedDocIds.length > 0 && (
                  <Badge className="bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30 text-[9px]">
                    {selectedDocIds.length} selecionado{selectedDocIds.length > 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
              {showDocs ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </CardHeader>
          {showDocs && (
            <CardContent className="pb-4">
              {docs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  Nenhum documento enviado. Faça upload na aba de detalhes do deal.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground mb-3">
                    Selecione os documentos que o FORJA deve ler e validar contra os dados do deal.
                  </p>
                  {docs.map((doc) => {
                    const selected = selectedDocIds.includes(doc.doc_id);
                    return (
                      <button
                        key={doc.doc_id}
                        onClick={() => toggleDoc(doc.doc_id)}
                        className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left ${
                          selected
                            ? "border-[#C9A84C]/40 bg-[#C9A84C]/5"
                            : "border-[#243A66] bg-[#111F35] hover:border-[#243A66]/80"
                        }`}
                      >
                        {selected
                          ? <CheckSquare className="w-3.5 h-3.5 text-[#C9A84C] flex-shrink-0" />
                          : <Square className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        }
                        <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs text-[#F0ECE4] flex-1 truncate">{doc.file_name}</span>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {new Date(doc.uploaded_at).toLocaleDateString("pt-BR")}
                        </span>
                      </button>
                    );
                  })}
                  {docs.length > 0 && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setSelectedDocIds(docs.map((d) => d.doc_id))}
                        className="text-[10px] text-[#C9A84C] hover:underline"
                      >
                        Selecionar todos
                      </button>
                      <span className="text-muted-foreground text-[10px]">·</span>
                      <button
                        onClick={() => setSelectedDocIds([])}
                        className="text-[10px] text-muted-foreground hover:underline"
                      >
                        Limpar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Resultados */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Validados */}
          <Card className="border-emerald-500/20">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                Validados ({result.validated.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              {result.validated.map((v, i) => (
                <div key={i} className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-lg">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/70">{v.field}</p>
                    {v.doc_confirmed && (
                      <ShieldCheck className="w-3 h-3 text-[#C9A84C]" aria-label="Confirmado em documento" />
                    )}
                  </div>
                  <p className="text-xs text-[#F0ECE4] font-medium">{v.value}</p>
                  {v.note && <p className="text-[10px] text-muted-foreground mt-0.5">{v.note}</p>}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Corrigidos */}
          <Card className="border-amber-500/20">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                Corrigidos ({result.corrected.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              {result.corrected.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhuma correção necessária</p>
              ) : result.corrected.map((c, i) => (
                <div key={i} className="p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-amber-500/70 mb-1">{c.field}</p>
                  <p className="text-[10px] text-muted-foreground line-through mb-0.5">{c.original}</p>
                  <p className="text-xs text-amber-300 font-medium">{c.corrected}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{c.reason}</p>
                  {c.doc_source && (
                    <p className="text-[9px] text-[#C9A84C] mt-0.5 flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5" />{c.doc_source}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Ausentes */}
          <Card className="border-red-500/20">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 text-red-400">
                <XCircle className="w-3.5 h-3.5" />
                Ausentes ({result.missing.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-2">
              {result.missing.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Nenhum campo crítico ausente</p>
              ) : result.missing.map((m, i) => (
                <div key={i} className="p-2.5 bg-red-500/5 border border-red-500/10 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-bold tracking-widest uppercase text-red-400/70">{m.field}</p>
                    <Badge className={`text-[8px] px-1 py-0 ${PRIORITY_COLORS[m.priority]}`}>{m.priority}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{m.impact}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Doc Insights — só aparece quando PDFs foram analisados */}
      {result?.doc_insights && result.doc_insights.length > 0 && (
        <Card className="border-[#C9A84C]/20">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-bold tracking-widest uppercase flex items-center gap-2 text-[#C9A84C]">
              <ShieldCheck className="w-3.5 h-3.5" />
              Dados Extraídos dos Documentos ({result.doc_insights.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            {result.doc_insights.map((ins, i) => (
              <div key={i} className="p-2.5 bg-[#C9A84C]/5 border border-[#C9A84C]/10 rounded-lg">
                <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C]/70 mb-0.5 flex items-center gap-1">
                  <FileText className="w-2.5 h-2.5" />{ins.doc}
                </p>
                <p className="text-xs text-[#F0ECE4]">{ins.finding}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tese de Investimento */}
      {result?.tese_investimento && result.tese_investimento.length > 0 && (
        <Card className="border-[#C9A84C]/20 bg-gradient-to-br from-[#162744] to-[#111F35]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C] flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              Tese de Investimento
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 space-y-2">
            {result.tese_investimento.map((bullet, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C] flex-shrink-0 mt-1.5" />
                <p className="text-xs text-[#E8EDF5] leading-relaxed">{bullet}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Narrativa */}
      {result && (
        <Card className="border-[#243A66]">
          <CardHeader className="pb-2 pt-4">
            <button
              onClick={() => setShowNarrative(!showNarrative)}
              className="flex items-center justify-between w-full text-left"
            >
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
                Narrativa de Investimento
              </CardTitle>
              {showNarrative
                ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          </CardHeader>
          {showNarrative && (
            <CardContent className="pb-5 space-y-4">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">PT-BR</p>
                <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-[#C9A84C]/30 pl-3">{result.narrative_pt}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">EN</p>
                <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-[#C9A84C]/30 pl-3">{result.narrative_en}</p>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
