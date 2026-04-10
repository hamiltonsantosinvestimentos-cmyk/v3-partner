"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, Search, AlertTriangle, CheckCircle, XCircle,
  Clock, FileText, List, Plus, Trash2, ChevronDown, ChevronUp,
  Building2, User, Loader2, RefreshCw,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type RiskLabel = "BAIXO RISCO" | "RISCO MÉDIO" | "ALTO RISCO";
type Verdict = "Aprovado" | "Condicional" | "Bloqueado";
type DDLevel = "SDD" | "Padrão" | "EDD";
type BlacklistType = "interpol" | "ofac" | "pep" | "v3" | "outro";

interface AnalysisResult {
  analysis_id?: string;
  score: number;
  risk_label: RiskLabel;
  verdict: Verdict;
  sources_used: string[];
  cnpj_data: Record<string, unknown> | null;
  sanctions: unknown[];
  processes: unknown[];
  blacklist_match: BlacklistEntry | null;
}

interface HistoryEntry {
  id: string;
  entity_doc: string;
  entity_name: string | null;
  entity_type: "PJ" | "PF";
  operation_type: string | null;
  dd_level: DDLevel;
  score: number;
  risk_label: RiskLabel;
  verdict: Verdict;
  sources_used: string[];
  created_at: string;
}

interface BlacklistEntry {
  id: string;
  name: string;
  doc: string | null;
  nationality: string | null;
  type: BlacklistType;
  notes: string | null;
  source: string;
  active: boolean;
  created_at: string;
}

interface KycClientProps {
  userRole: "ADMIN" | "GESTAO";
  userId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLabel, { color: string; bg: string; icon: typeof CheckCircle }> = {
  "BAIXO RISCO":  { color: "#22c55e", bg: "rgba(34,197,94,0.1)",   icon: CheckCircle },
  "RISCO MÉDIO":  { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  icon: AlertTriangle },
  "ALTO RISCO":   { color: "#ef4444", bg: "rgba(239,68,68,0.1)",   icon: XCircle },
};

const VERDICT_STYLE: Record<Verdict, string> = {
  Aprovado:     "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  Condicional:  "text-amber-400   border-amber-500/30   bg-amber-500/10",
  Bloqueado:    "text-red-400     border-red-500/30     bg-red-500/10",
};

const BL_TYPE_LABELS: Record<BlacklistType, string> = {
  interpol: "INTERPOL", ofac: "OFAC", pep: "PEP", v3: "V3 Interno", outro: "Outro",
};

const BL_TYPE_COLORS: Record<BlacklistType, string> = {
  interpol: "text-red-400 bg-red-500/10 border-red-500/30",
  ofac:     "text-orange-400 bg-orange-500/10 border-orange-500/30",
  pep:      "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  v3:       "text-purple-400 bg-purple-500/10 border-purple-500/30",
  outro:    "text-gray-400 bg-gray-500/10 border-gray-500/30",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtDoc(doc: string) {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return doc;
}

function ScoreGauge({ score, risk_label }: { score: number; risk_label: RiskLabel }) {
  const cfg = RISK_CONFIG[risk_label];
  const deg = Math.round((score / 100) * 180);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-14 overflow-hidden">
        <div className="absolute inset-0 rounded-t-full border-8 border-[#162744]" />
        <div
          className="absolute bottom-0 left-1/2 origin-bottom w-1 h-12 rounded-full transition-transform duration-700"
          style={{
            background: cfg.color,
            transform: `translateX(-50%) rotate(${deg - 90}deg)`,
            boxShadow: `0 0 8px ${cfg.color}`,
          }}
        />
      </div>
      <span className="text-4xl font-bold" style={{ color: cfg.color }}>{score}</span>
      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: cfg.color }}>
        {risk_label}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function KycClient({ userRole }: KycClientProps) {
  const [tab, setTab] = useState<"analyze" | "history" | "blacklist">("analyze");

  // Analysis form
  const [entityDoc, setEntityDoc] = useState("");
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState<"PJ" | "PF">("PJ");
  const [operationType, setOperationType] = useState("");
  const [ddLevel, setDdLevel] = useState<DDLevel>("Padrão");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const [expandedResult, setExpandedResult] = useState(false);

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Blacklist
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [blLoading, setBlLoading] = useState(false);
  const [blForm, setBlForm] = useState({ name: "", doc: "", nationality: "", type: "v3" as BlacklistType, notes: "", source: "V3 Interno" });
  const [blAdding, setBlAdding] = useState(false);
  const [showBlForm, setShowBlForm] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const r = await fetch("/api/kyc/history");
      const data = await r.json();
      setHistory(Array.isArray(data) ? data : []);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadBlacklist = useCallback(async () => {
    setBlLoading(true);
    try {
      const r = await fetch("/api/kyc/blacklist");
      const data = await r.json();
      setBlacklist(Array.isArray(data) ? data : []);
    } finally {
      setBlLoading(false);
    }
  }, []);

  useEffect(() => { if (tab === "history") loadHistory(); }, [tab, loadHistory]);
  useEffect(() => { if (tab === "blacklist") loadBlacklist(); }, [tab, loadBlacklist]);

  async function handleAnalyze() {
    if (!entityDoc.trim()) return;
    setAnalyzing(true);
    setResult(null);
    setAnalysisError("");
    setExpandedResult(false);

    try {
      const r = await fetch("/api/kyc/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_doc: entityDoc.trim(),
          entity_name: entityName.trim() || undefined,
          entity_type: entityType,
          operation_type: operationType || undefined,
          dd_level: ddLevel,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Erro na análise");
      setResult(data);
    } catch (e: unknown) {
      setAnalysisError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleBlAdd() {
    if (!blForm.name.trim()) return;
    setBlAdding(true);
    try {
      const r = await fetch("/api/kyc/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(blForm),
      });
      if (r.ok) {
        setBlForm({ name: "", doc: "", nationality: "", type: "v3", notes: "", source: "V3 Interno" });
        setShowBlForm(false);
        await loadBlacklist();
      }
    } finally {
      setBlAdding(false);
    }
  }

  async function handleBlDelete(id: string) {
    if (!confirm("Remover da blacklist?")) return;
    await fetch("/api/kyc/blacklist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBlacklist((prev) => prev.filter((b) => b.id !== id));
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #C9A84C, #E8C97A)" }}>
            <Shield className="w-5 h-5 text-[#09081A]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#F0ECE4]">KYC Engine</h1>
            <p className="text-xs text-[#7A8FA8]">Know Your Customer · Compliance V3 Partners</p>
          </div>
        </div>
        <span className="text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded border"
          style={{ color: "#C9A84C", borderColor: "rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.08)" }}>
          {userRole === "ADMIN" ? "Administrador" : "Gestão"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#111F35] border border-[#162744]">
        {([
          { key: "analyze",   label: "Nova Análise",  Icon: Search },
          { key: "history",   label: "Histórico",     Icon: Clock },
          { key: "blacklist", label: "Black List",    Icon: List },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-all"
            style={tab === key ? {
              background: "rgba(201,168,76,0.12)",
              color: "#E8C97A",
              borderBottom: "2px solid #C9A84C",
            } : { color: "#7A8FA8" }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: ANALYZE ─────────────────────────────────────── */}
      {tab === "analyze" && (
        <div className="space-y-4">
          {/* Form */}
          <div className="rounded-xl border border-[#162744] bg-[#111F35] p-5 space-y-4">
            <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C]">
              Dados da Entidade
            </p>

            {/* Entity type toggle */}
            <div className="flex gap-2">
              {(["PJ", "PF"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setEntityType(t)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border transition-all"
                  style={entityType === t ? {
                    background: "rgba(201,168,76,0.12)",
                    color: "#E8C97A",
                    borderColor: "rgba(201,168,76,0.4)",
                  } : {
                    background: "transparent",
                    color: "#7A8FA8",
                    borderColor: "#162744",
                  }}
                >
                  {t === "PJ" ? <Building2 className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                  {t === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A8FA8]">
                  {entityType === "PJ" ? "CNPJ" : "CPF"} *
                </label>
                <input
                  type="text"
                  placeholder={entityType === "PJ" ? "00.000.000/0001-00" : "000.000.000-00"}
                  value={entityDoc}
                  onChange={(e) => setEntityDoc(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#162744] border border-[#243A66] text-[#F0ECE4] text-sm placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A8FA8]">
                  Nome / Razão Social
                </label>
                <input
                  type="text"
                  placeholder="Razão Social ou nome completo"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#162744] border border-[#243A66] text-[#F0ECE4] text-sm placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A8FA8]">
                  Tipo de Operação
                </label>
                <input
                  type="text"
                  placeholder="Ex: Home Equity, CRI, M&A"
                  value={operationType}
                  onChange={(e) => setOperationType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#162744] border border-[#243A66] text-[#F0ECE4] text-sm placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A8FA8]">
                  Nível de Due Diligence
                </label>
                <select
                  value={ddLevel}
                  onChange={(e) => setDdLevel(e.target.value as DDLevel)}
                  className="w-full px-3 py-2.5 rounded-lg bg-[#162744] border border-[#243A66] text-[#F0ECE4] text-sm focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
                >
                  <option value="SDD">SDD — Simplificada</option>
                  <option value="Padrão">Padrão</option>
                  <option value="EDD">EDD — Aprimorada</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!entityDoc.trim() || analyzing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg, #C9A84C, #E8C97A)", color: "#09081A" }}
            >
              {analyzing ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Consultando fontes...</>
              ) : (
                <><Search className="w-4 h-4" />Executar Análise KYC</>
              )}
            </button>
          </div>

          {/* Error */}
          {analysisError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-300">{analysisError}</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-xl border border-[#162744] bg-[#111F35] overflow-hidden">
              {/* Header bar */}
              <div className="border-l-4 px-5 py-4 flex items-center justify-between"
                style={{ borderColor: RISK_CONFIG[result.risk_label].color }}>
                <div>
                  <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C]">
                    V3 Partners · Laudo KYC — Documento Confidencial
                  </p>
                  <p className="text-base font-bold text-[#F0ECE4] mt-0.5">
                    {entityName || fmtDoc(entityDoc)}
                  </p>
                  <p className="text-xs text-[#7A8FA8]">{fmtDoc(entityDoc)} · {ddLevel}</p>
                </div>
                <ScoreGauge score={result.score} risk_label={result.risk_label} />
              </div>

              {/* Verdict */}
              <div className="px-5 py-3 border-t border-[#162744] flex items-center gap-3">
                <p className="text-[9px] font-bold tracking-widest uppercase text-[#7A8FA8]">Parecer Final — Compliance V3</p>
                <span className={`ml-auto px-3 py-1 rounded-full text-xs font-bold border ${VERDICT_STYLE[result.verdict]}`}>
                  {result.verdict}
                </span>
              </div>

              {/* Blacklist alert */}
              {result.blacklist_match && (
                <div className="mx-5 my-3 rounded-lg border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-400">Consta na Black List V3</p>
                    <p className="text-xs text-red-300/70 mt-0.5">
                      Tipo: {BL_TYPE_LABELS[result.blacklist_match.type as BlacklistType]} · Fonte: {result.blacklist_match.source}
                    </p>
                  </div>
                </div>
              )}

              {/* Sources */}
              <div className="px-5 py-3 border-t border-[#162744]">
                <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C] mb-2">Fontes Consultadas</p>
                <div className="h-[2px] w-10 bg-[#C9A84C] mb-3 rounded-full" />
                <div className="flex flex-wrap gap-2">
                  {result.sources_used.map((s) => (
                    <span key={s} className="px-2.5 py-1 rounded-full text-[10px] font-semibold border border-[#C9A84C]/20 text-[#C9A84C] bg-[#C9A84C]/5">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="px-5 py-3 border-t border-[#162744] grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-[#F0ECE4]">{result.processes.length}</p>
                  <p className="text-[10px] text-[#7A8FA8]">Processos CNJ</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-[#F0ECE4]">{result.sanctions.length}</p>
                  <p className="text-[10px] text-[#7A8FA8]">Sanções Internac.</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold" style={{ color: result.blacklist_match ? "#ef4444" : "#22c55e" }}>
                    {result.blacklist_match ? "SIM" : "NÃO"}
                  </p>
                  <p className="text-[10px] text-[#7A8FA8]">Black List</p>
                </div>
              </div>

              {/* CNPJ data (expandable) */}
              {result.cnpj_data && (
                <div className="border-t border-[#162744]">
                  <button
                    onClick={() => setExpandedResult(!expandedResult)}
                    className="w-full px-5 py-3 flex items-center justify-between text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      Dados Receita Federal
                    </span>
                    {expandedResult ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {expandedResult && (
                    <div className="px-5 pb-4 grid grid-cols-2 gap-2 text-xs">
                      {[
                        ["Razão Social", (result.cnpj_data as Record<string, string>)?.razao_social],
                        ["Situação", (result.cnpj_data as Record<string, string>)?.descricao_situacao_cadastral],
                        ["Porte", (result.cnpj_data as Record<string, string>)?.porte],
                        ["Natureza Jurídica", (result.cnpj_data as Record<string, string>)?.natureza_juridica],
                        ["UF", (result.cnpj_data as Record<string, string>)?.uf],
                        ["Município", (result.cnpj_data as Record<string, string>)?.municipio],
                      ].map(([label, value]) => value ? (
                        <div key={label} className="bg-[#162744] rounded-lg p-2">
                          <p className="text-[9px] font-bold uppercase tracking-wider text-[#7A8FA8]">{label}</p>
                          <p className="text-[#F0ECE4] font-medium mt-0.5">{value}</p>
                        </div>
                      ) : null)}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="px-5 py-2 border-t border-[#162744] bg-[#0D1A2D]">
                <p className="text-[9px] text-[#7A8FA8] text-center">
                  V3 Partners · KYC Engine v2.1 · Infraestrutura Bloxs S.A.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: HISTORY ─────────────────────────────────────── */}
      {tab === "history" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C]">
              {userRole === "ADMIN" ? "Todas as Análises" : "Minhas Análises"}
            </p>
            <button onClick={loadHistory} className="p-1.5 rounded-lg hover:bg-[#162744] text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {historyLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#C9A84C] animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-xl border border-[#162744] bg-[#111F35] p-12 text-center">
              <Clock className="w-8 h-8 text-[#7A8FA8] mx-auto mb-3" />
              <p className="text-sm text-[#7A8FA8]">Nenhuma análise realizada ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const cfg = RISK_CONFIG[h.risk_label];
                const RiskIcon = cfg.icon;
                return (
                  <div key={h.id} className="rounded-xl border border-[#162744] bg-[#111F35] p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: cfg.bg }}>
                      <RiskIcon className="w-5 h-5" style={{ color: cfg.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#F0ECE4] truncate">
                        {h.entity_name || fmtDoc(h.entity_doc)}
                      </p>
                      <p className="text-xs text-[#7A8FA8]">
                        {fmtDoc(h.entity_doc)} · {h.dd_level} · {fmtDate(h.created_at)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold" style={{ color: cfg.color }}>{h.score}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${VERDICT_STYLE[h.verdict]}`}>
                        {h.verdict}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: BLACKLIST ───────────────────────────────────── */}
      {tab === "blacklist" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C]">
              Black List Consolidada — INTERPOL · OFAC · PEP · V3 Interno
            </p>
            {userRole === "ADMIN" && (
              <button
                onClick={() => setShowBlForm(!showBlForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={{ background: "rgba(201,168,76,0.12)", color: "#E8C97A", border: "1px solid rgba(201,168,76,0.3)" }}
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </button>
            )}
          </div>

          {/* Add form (ADMIN only) */}
          {userRole === "ADMIN" && showBlForm && (
            <div className="rounded-xl border border-[#C9A84C]/20 bg-[#111F35] p-5 space-y-3">
              <p className="text-[9px] font-bold tracking-widest uppercase text-[#C9A84C]">Nova Entrada</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { label: "Nome *", key: "name", placeholder: "Nome completo / Razão Social" },
                  { label: "CPF / CNPJ", key: "doc", placeholder: "Documento (opcional)" },
                  { label: "Nacionalidade", key: "nationality", placeholder: "Ex: Brasileiro, Americano" },
                  { label: "Fonte", key: "source", placeholder: "Ex: V3 Interno, OFAC" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key} className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A8FA8]">{label}</label>
                    <input
                      type="text"
                      placeholder={placeholder}
                      value={blForm[key as keyof typeof blForm]}
                      onChange={(e) => setBlForm((f) => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[#162744] border border-[#243A66] text-[#F0ECE4] text-sm placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50"
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A8FA8]">Tipo</label>
                  <select
                    value={blForm.type}
                    onChange={(e) => setBlForm((f) => ({ ...f, type: e.target.value as BlacklistType }))}
                    className="w-full px-3 py-2 rounded-lg bg-[#162744] border border-[#243A66] text-[#F0ECE4] text-sm focus:outline-none focus:border-[#C9A84C]/50"
                  >
                    {Object.entries(BL_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#7A8FA8]">Observações</label>
                  <input
                    type="text"
                    placeholder="Motivo, processo, referência..."
                    value={blForm.notes}
                    onChange={(e) => setBlForm((f) => ({ ...f, notes: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[#162744] border border-[#243A66] text-[#F0ECE4] text-sm placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowBlForm(false)} className="px-4 py-2 rounded-lg text-xs font-semibold text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleBlAdd}
                  disabled={!blForm.name.trim() || blAdding}
                  className="px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50 transition-all"
                  style={{ background: "linear-gradient(135deg, #C9A84C, #E8C97A)", color: "#09081A" }}
                >
                  {blAdding ? "Salvando..." : "Adicionar"}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {blLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#C9A84C] animate-spin" />
            </div>
          ) : blacklist.length === 0 ? (
            <div className="rounded-xl border border-[#162744] bg-[#111F35] p-12 text-center">
              <List className="w-8 h-8 text-[#7A8FA8] mx-auto mb-3" />
              <p className="text-sm text-[#7A8FA8]">Nenhuma entrada na blacklist</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blacklist.map((b) => (
                <div key={b.id} className="rounded-xl border border-[#162744] bg-[#111F35] p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#F0ECE4]">{b.name}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${BL_TYPE_COLORS[b.type as BlacklistType]}`}>
                        {BL_TYPE_LABELS[b.type as BlacklistType]}
                      </span>
                    </div>
                    <p className="text-xs text-[#7A8FA8]">
                      {b.doc && <span className="mr-3">{fmtDoc(b.doc)}</span>}
                      {b.nationality && <span className="mr-3">{b.nationality}</span>}
                      <span>Fonte: {b.source}</span>
                    </p>
                    {b.notes && <p className="text-xs text-[#7A8FA8]/70 italic">{b.notes}</p>}
                    <p className="text-[10px] text-[#7A8FA8]/50">{fmtDate(b.created_at)}</p>
                  </div>
                  {userRole === "ADMIN" && (
                    <button
                      onClick={() => handleBlDelete(b.id)}
                      className="p-1.5 rounded-lg text-[#7A8FA8] hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
