"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, CheckCheck, Loader2, ShieldCheck,
  XCircle, ChevronDown, ChevronUp, FileText,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type CampoConfianca = {
  campo:     string;
  confianca: number;
  evidencia: string;
};

export type ExtractionSummary = {
  extraction_id:         string;
  doc_name:              string;
  tipo_documento:        string;
  confiabilidade:        number;
  dados_extraidos:       Record<string, unknown>;
  campos_baixa_confianca: CampoConfianca[];
  pendencias:            string[];
  status:                string;
  resumo:                string;
};

interface Props {
  dealId:     string;
  extraction: ExtractionSummary;
  currentAssetData?: Record<string, unknown>;
  onConfirmed: () => void;
  onClose:     () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-amber-400";
  return "text-red-400";
}

function scoreBarColor(score: number) {
  if (score >= 70) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConfirmacaoExtracaoModal({
  dealId, extraction, currentAssetData = {}, onConfirmed, onClose,
}: Props) {
  const [step, setStep]               = useState<1 | 2>(1);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [showDiff, setShowDiff]       = useState(false);
  const [showPendencias, setShowPendencias] = useState(false);

  // Campos que serão mesclados (todos por padrão, exceto os nulos)
  const allFields = Object.keys(extraction.dados_extraidos).filter(
    (k) => extraction.dados_extraidos[k] !== null && extraction.dados_extraidos[k] !== undefined
  );

  // Diff: detecta campos novos e campos que serão sobrescritos
  const diffChanges = allFields.map((field) => ({
    field,
    extracted:  extraction.dados_extraidos[field],
    current:    currentAssetData[field] ?? null,
    isNew:      !(field in currentAssetData) || currentAssetData[field] === null || currentAssetData[field] === "",
    willChange: currentAssetData[field] !== null && currentAssetData[field] !== undefined
                 && String(currentAssetData[field]) !== String(extraction.dados_extraidos[field]),
  }));

  const overwriteCount = diffChanges.filter((d) => d.willChange).length;
  const newCount       = diffChanges.filter((d) => d.isNew).length;
  const lowConfFields  = extraction.campos_baixa_confianca.length;

  const handleConfirm = useCallback(async () => {
    if (step === 1) { setStep(2); return; }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ma/doc-extract/confirm", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ extraction_id: extraction.extraction_id, deal_id: dealId }),
      });

      const data = await res.json() as { ok?: boolean; error?: string; fields_merged?: number };
      if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);

      onConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [step, extraction.extraction_id, dealId, onConfirmed]);

  return (
    /* Overlay */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#13223A] border border-[#243A66] rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-[#243A66] bg-gradient-to-r from-[#162744] to-[#13223A]">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
              step === 2 ? "bg-amber-500/20" : "bg-[#C9A84C]/20"
            }`}>
              {step === 2
                ? <AlertTriangle className="w-4.5 h-4.5 text-amber-400" />
                : <ShieldCheck className="w-4.5 h-4.5 text-[#C9A84C]" />
              }
            </div>
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] mb-0.5">
                {step === 2 ? "CONFIRMAÇÃO FINAL" : "FORJAR INSERÇÃO — REVISÃO"}
              </p>
              <p className="text-sm font-semibold text-white leading-snug">
                {step === 2
                  ? "Tem certeza? Esta ação é irreversível."
                  : "Persistir dados extraídos no deal"}
              </p>
              <p className="text-[11px] text-[#9BAFC5] mt-0.5 truncate max-w-[340px]">
                {extraction.doc_name}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">

          {/* Score */}
          <div className="flex items-center gap-4 p-3 rounded-xl bg-[#09081A]/60 border border-[#243A66]">
            <div className="flex-1">
              <p className="text-[10px] font-bold tracking-widest uppercase text-[#9BAFC5] mb-1">
                Confiabilidade da Extração
              </p>
              <div className="h-1.5 bg-[#243A66] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${scoreBarColor(extraction.confiabilidade)}`}
                  style={{ width: `${extraction.confiabilidade}%` }}
                />
              </div>
            </div>
            <p className={`text-2xl font-bold ${scoreColor(extraction.confiabilidade)}`}>
              {extraction.confiabilidade}
              <span className="text-sm font-normal text-[#9BAFC5]">/100</span>
            </p>
          </div>

          {/* Resumo stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-lg font-bold text-emerald-400">{newCount}</p>
              <p className="text-[9px] text-[#9BAFC5] uppercase tracking-wide">Campos Novos</p>
            </div>
            <div className={`text-center p-2 rounded-lg border ${
              overwriteCount > 0 ? "bg-amber-500/5 border-amber-500/20" : "bg-[#09081A]/40 border-[#243A66]"
            }`}>
              <p className={`text-lg font-bold ${overwriteCount > 0 ? "text-amber-400" : "text-[#9BAFC5]"}`}>
                {overwriteCount}
              </p>
              <p className="text-[9px] text-[#9BAFC5] uppercase tracking-wide">Sobrescritos</p>
            </div>
            <div className={`text-center p-2 rounded-lg border ${
              lowConfFields > 0 ? "bg-red-500/5 border-red-500/20" : "bg-[#09081A]/40 border-[#243A66]"
            }`}>
              <p className={`text-lg font-bold ${lowConfFields > 0 ? "text-red-400" : "text-[#9BAFC5]"}`}>
                {lowConfFields}
              </p>
              <p className="text-[9px] text-[#9BAFC5] uppercase tracking-wide">Baixa Conf.</p>
            </div>
          </div>

          {/* Campos baixa confiança */}
          {lowConfFields > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-hidden">
              <button
                onClick={() => setShowPendencias(!showPendencias)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left"
              >
                <span className="text-[10px] font-bold tracking-widest uppercase text-red-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  Campos com Baixa Confiança ({lowConfFields})
                </span>
                {showPendencias
                  ? <ChevronUp className="w-3.5 h-3.5 text-[#9BAFC5]" />
                  : <ChevronDown className="w-3.5 h-3.5 text-[#9BAFC5]" />
                }
              </button>
              {showPendencias && (
                <div className="px-3 pb-3 space-y-1.5">
                  {extraction.campos_baixa_confianca.map((c, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[8px] mt-0.5 flex-shrink-0">
                        {c.confianca}%
                      </Badge>
                      <div>
                        <p className="text-[10px] font-semibold text-[#F5F1E8]">{c.campo}</p>
                        <p className="text-[10px] text-[#9BAFC5] line-clamp-1">{c.evidencia}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Diff de campos */}
          <div className="rounded-xl border border-[#243A66] overflow-hidden">
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left"
            >
              <span className="text-[10px] font-bold tracking-widest uppercase text-[#9BAFC5] flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                Diff — Extraído vs Declarado ({allFields.length} campos)
              </span>
              {showDiff
                ? <ChevronUp className="w-3.5 h-3.5 text-[#9BAFC5]" />
                : <ChevronDown className="w-3.5 h-3.5 text-[#9BAFC5]" />
              }
            </button>
            {showDiff && (
              <div className="border-t border-[#243A66] divide-y divide-[#243A66]/50 max-h-48 overflow-y-auto">
                {diffChanges.map((d, i) => (
                  <div key={i} className={`px-3 py-2 ${d.willChange ? "bg-amber-500/5" : ""}`}>
                    <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C]/70 mb-0.5">
                      {d.field}
                      {d.isNew && (
                        <span className="ml-1.5 text-emerald-400 normal-case font-normal tracking-normal">novo</span>
                      )}
                      {d.willChange && (
                        <span className="ml-1.5 text-amber-400 normal-case font-normal tracking-normal">alterado</span>
                      )}
                    </p>
                    {d.willChange && (
                      <p className="text-[10px] text-[#9BAFC5] line-through mb-0.5">
                        {formatValue(d.current)}
                      </p>
                    )}
                    <p className="text-[11px] text-[#F5F1E8] font-medium">
                      {formatValue(d.extracted)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Resumo do doc */}
          {extraction.resumo && (
            <p className="text-[11px] text-[#9BAFC5] leading-relaxed border-l-2 border-[#C9A84C]/30 pl-3">
              {extraction.resumo}
            </p>
          )}

          {/* Aviso passo 2 */}
          {step === 2 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-xs font-semibold text-amber-300 mb-1">
                Acao irreversivel — confirme para prosseguir
              </p>
              <p className="text-[10px] text-[#9BAFC5]">
                Os dados extraídos serão mesclados ao asset_data do deal.
                Campos sobrescritos não poderão ser recuperados automaticamente.
              </p>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-red-400">
              <XCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#243A66] flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={step === 2 ? () => setStep(1) : onClose}
            disabled={loading}
            className="border-[#243A66] text-[#9BAFC5] hover:bg-[#162744]"
          >
            {step === 2 ? "Voltar" : "Cancelar"}
          </Button>

          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
            className={`font-bold flex items-center gap-1.5 ${
              step === 2
                ? "bg-amber-500 hover:bg-amber-400 text-[#09081A]"
                : "bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A]"
            }`}
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Persistindo...</>
            ) : step === 2 ? (
              <><CheckCheck className="w-3.5 h-3.5" />Confirmar e Persistir</>
            ) : (
              <><ShieldCheck className="w-3.5 h-3.5" />Continuar para Confirmação</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
