"use client";

import { useState } from "react";
import {
  CheckCircle2, XCircle, FileText, Scale, ReceiptText,
  ShieldCheck, Building2, Hammer, FileSignature, Loader2,
  ChevronRight, AlertCircle
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
  isDemo?: boolean;
}

interface ValidationResult {
  score: number;
  aprovado: boolean;
  documentos_presentes: string[];
  documentos_faltantes: string[];
  dados_extraidos: {
    cnpj_confirmado: boolean;
    socios_identificados: string[];
    receita_auditada: string;
    pendencias: string;
  };
  observacoes: string;
}

// ─── Document list definition ─────────────────────────────────────────────────
const DOCS = [
  { id: "contrato_social",   label: "Contrato Social / Estatuto",    icon: Building2,     required: true,     demo_present: true  },
  { id: "balanco_3anos",     label: "Balanço Patrimonial 3 anos",    icon: Scale,         required: true,     demo_present: false },
  { id: "dre_3anos",         label: "DRE últimos 3 anos",            icon: ReceiptText,   required: true,     demo_present: true  },
  { id: "certidoes",         label: "Certidões Negativas",           icon: ShieldCheck,   required: true,     demo_present: false },
  { id: "licencas",          label: "Licenças e Alvarás",            icon: FileText,      required: false,    demo_present: true  },
  { id: "laudo_tecnico",     label: "Laudo Técnico",                 icon: Hammer,        required: false,    demo_present: false },
  { id: "nda",               label: "NDA assinado",                  icon: FileSignature, required: false,    demo_present: true  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatM(v: number) {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v}`;
}

function scoreColor(score: number) {
  if (score >= 85) return "#10B981";
  if (score >= 60) return "#F59E0B";
  return "#EF4444";
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function ValidacaoDocumentalPanel({ deal, isDemo = true }: ValidacaoDocumentalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presentDocs = DOCS.filter(d => d.demo_present);
  const missingDocs = DOCS.filter(d => !d.demo_present);
  const requiredMissing = missingDocs.filter(d => d.required);
  const allRequiredPresent = requiredMissing.length === 0;

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ma/validacao-documental", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deal }),
      });
      if (!res.ok) throw new Error("Erro na validação");
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

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

      {/* Checklist */}
      <div>
        <p className="text-[10px] font-bold tracking-widest text-[#7A8FA8] uppercase mb-3">Checklist Documental</p>
        <div className="space-y-2">
          {DOCS.map(doc => {
            const Icon = doc.icon;
            const present = doc.demo_present;
            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors"
                style={{
                  borderColor: present ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)",
                  background: present ? "rgba(16,185,129,0.05)" : "rgba(239,68,68,0.04)",
                }}
              >
                <Icon size={14} className="flex-shrink-0" style={{ color: present ? "#10B981" : "#EF4444" }} />
                <span className="flex-1 text-xs text-[#F0ECE4]">{doc.label}</span>
                {doc.required && (
                  <span className="text-[9px] font-bold tracking-widest text-[#7A8FA8] uppercase">OBRIG.</span>
                )}
                {present
                  ? <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-400" />
                  : <XCircle size={14} className="flex-shrink-0 text-red-400" />
                }
              </div>
            );
          })}
        </div>

        {/* Summary line */}
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-[#162744] border border-[#243A66] px-3 py-2">
          <AlertCircle size={13} className="flex-shrink-0" style={{ color: allRequiredPresent ? "#10B981" : "#F59E0B" }} />
          <span className="text-xs text-[#7A8FA8]">
            {presentDocs.length}/{DOCS.length} documentos presentes
            {requiredMissing.length > 0 && ` · ${requiredMissing.length} obrigatório(s) faltando`}
          </span>
        </div>
      </div>

      {/* Analisar com IA */}
      <div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#C9A84C]/50 bg-[#C9A84C]/10 text-[#C9A84C] text-sm font-semibold py-3 hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              FORJA analisando documentos...
            </>
          ) : (
            <>
              <FileText size={15} />
              Analisar com IA
            </>
          )}
        </button>

        {error && (
          <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="space-y-4 border-t border-[#162744] pt-4">
          {/* Score */}
          <div className="rounded-xl border border-[#162744] bg-[#111F35] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold tracking-widest text-[#7A8FA8] uppercase">Score de Validação</p>
              <span className="text-2xl font-bold" style={{ color: scoreColor(result.score) }}>{result.score}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#162744] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${result.score}%`, background: scoreColor(result.score) }}
              />
            </div>
            <p className="text-xs text-[#7A8FA8] mt-2">{result.observacoes}</p>
          </div>

          {/* Presentes / Faltantes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase mb-2">Presentes</p>
              {result.documentos_presentes.map(d => (
                <div key={d} className="flex items-center gap-1.5 mb-1">
                  <CheckCircle2 size={10} className="text-emerald-400 flex-shrink-0" />
                  <span className="text-[11px] text-[#F0ECE4]">{d}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-[10px] font-bold tracking-widest text-red-400 uppercase mb-2">Faltantes</p>
              {result.documentos_faltantes.map(d => (
                <div key={d} className="flex items-center gap-1.5 mb-1">
                  <XCircle size={10} className="text-red-400 flex-shrink-0" />
                  <span className="text-[11px] text-[#F0ECE4]">{d}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dados Extraídos */}
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#7A8FA8] uppercase mb-3">Dados Extraídos pela IA</p>
            <div className="space-y-2">
              <DataRow label="CNPJ Confirmado" value={result.dados_extraidos.cnpj_confirmado ? "Sim" : "Não"} ok={result.dados_extraidos.cnpj_confirmado} />
              <DataRow label="Receita Auditada" value={result.dados_extraidos.receita_auditada} />
              <DataRow label="Sócios Identificados" value={result.dados_extraidos.socios_identificados.join(", ")} />
              <DataRow label="Pendências" value={result.dados_extraidos.pendencias} />
            </div>
          </div>
        </div>
      )}

      {/* Status geral / CTA */}
      <div className="mt-auto pt-2">
        {allRequiredPresent ? (
          <a
            href={`/ma/${deal.id}/criativos`}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold py-3 hover:bg-emerald-400 transition-colors"
          >
            Aprovado — Gerar Kit de Criativos
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
              Complete os documentos obrigatórios
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper sub-component ─────────────────────────────────────────────────────
function DataRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-[#111F35] border border-[#162744] px-3 py-2">
      <span className="text-[11px] text-[#7A8FA8] flex-shrink-0">{label}</span>
      <span className={`text-[11px] font-medium text-right ${ok === false ? "text-red-400" : "text-[#F0ECE4]"}`}>{value}</span>
    </div>
  );
}
