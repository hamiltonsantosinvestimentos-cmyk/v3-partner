"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, XCircle, Zap, ChevronDown, ChevronUp, FileImage, Loader2 } from "lucide-react";
import Link from "next/link";

type ValidatedField = { field: string; value: string; note?: string };
type CorrectedField = { field: string; original: string; corrected: string; reason: string };
type MissingField = { field: string; impact: string; priority: "ALTA" | "MEDIA" | "BAIXA" };

type ForjaResult = {
  score: number;
  validated: ValidatedField[];
  corrected: CorrectedField[];
  missing: MissingField[];
  narrative_pt: string;
  narrative_en: string;
  recommendation: "APROVADO" | "APROVADO_COM_RESSALVAS" | "PENDENTE" | "BLOQUEADO";
  recommendation_note: string;
};

const REC_CONFIG = {
  APROVADO:               { label: "Aprovado", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", bar: "bg-emerald-500" },
  APROVADO_COM_RESSALVAS: { label: "Aprovado com Ressalvas", color: "bg-amber-500/20 text-amber-400 border-amber-500/30", bar: "bg-amber-500" },
  PENDENTE:               { label: "Pendente", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", bar: "bg-orange-500" },
  BLOQUEADO:              { label: "Bloqueado", color: "bg-red-500/20 text-red-400 border-red-500/30", bar: "bg-red-500" },
};

const PRIORITY_COLORS = {
  ALTA:  "bg-red-500/20 text-red-400 border-red-500/30",
  MEDIA: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  BAIXA: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

interface ForjaPanelProps {
  deal: Record<string, unknown>;
  dealId: string;
  savedResult?: ForjaResult | null;
  onSaved?: (result: ForjaResult) => void;
}

export function ForjaPanel({ deal, dealId, savedResult, onSaved }: ForjaPanelProps) {
  const [result, setResult] = useState<ForjaResult | null>(savedResult ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNarrative, setShowNarrative] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleValidate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ma/forja-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
      // Salva resultado no Supabase sempre que dealId existir
      if (dealId) {
        setSaving(true);
        try {
          await fetch("/api/ma/forja-kit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deal_id: dealId, action: "save_forja", forja_result: data }),
          });
          if (onSaved) onSaved(data);
        } catch {}
        setSaving(false);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Falha na validação: ${msg}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const rec = result ? REC_CONFIG[result.recommendation] : null;
  const canProceed = result && (result.recommendation === "APROVADO" || result.recommendation === "APROVADO_COM_RESSALVAS");

  return (
    <div className="space-y-4">

      {/* Header card do FORJA */}
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
                    ? `${result.validated.length} validados · ${result.corrected.length} corrigidos · ${result.missing.length} ausentes`
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
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Validando...</>
                ) : saving ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Salvando...</>
                ) : result ? (
                  "Revalidar"
                ) : (
                  <><Zap className="w-3.5 h-3.5 mr-1.5" />Validar com FORJA</>
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
                </div>
              </div>
              <div className="h-2 bg-[#09081A] rounded-full overflow-hidden">
                <div
                  className={`h-full ${rec!.bar} rounded-full transition-all duration-700`}
                  style={{ width: `${result.score}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{result.recommendation_note}</p>
            </div>
          )}

          {/* Loading state */}
          {loading && !result && (
            <div className="mt-4">
              <div className="h-1.5 bg-[#09081A] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] rounded-full animate-pulse" style={{ width: "60%" }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">Analisando dados do ativo...</p>
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5" />{error}
            </p>
          )}
        </CardContent>
      </Card>

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
                  <p className="text-[10px] font-bold tracking-widest uppercase text-emerald-500/70 mb-0.5">{v.field}</p>
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

      {/* Narrativa */}
      {result && (
        <Card className="border-[#243A66]">
          <CardHeader className="pb-2 pt-4">
            <button
              onClick={() => setShowNarrative(!showNarrative)}
              className="flex items-center justify-between w-full text-left"
            >
              <CardTitle className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
                Narrativa de Investimento Gerada pelo FORJA
              </CardTitle>
              {showNarrative ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
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
