"use client";

import { useState } from "react";
import {
  Radar, Zap, Target, Loader2, ChevronDown, ChevronUp,
  Building2, MapPin, TrendingUp, CheckCircle2, AlertCircle, Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Investor = {
  id: string; nome: string; tipo: string;
  setores: string[]; ufs: string[]; ticket_min: number | null; ticket_max: number | null; status: string;
};

type Opportunity = {
  id: string; empresa_blind: string; setor: string; uf: string | null;
  valor_estimado: number | null; tipo_operacao: string; descricao: string;
  contexto: string; score_relevancia: number; source_type: string; status: string; created_at: string;
};

type Report = {
  id: string; squad_id: string; title: string; created_at: string;
  opportunities_scanned_at: string | null; opportunities_found: number | null;
};

type BriefingResult = {
  investor: { nome: string; tipo: string; criterios_ativos: Record<string, unknown> };
  resumo: { total_encontrado: number; deals_pipeline: number; intakes_w2: number;
             oportunidades_detectadas: number; relatorios_nao_escaneados: number };
  fontes: {
    deals: Record<string, unknown>[];
    intakes: Record<string, unknown>[];
    oportunidades: Record<string, unknown>[];
    relatorios_pendentes: Record<string, unknown>[];
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatM(v: number | null) {
  if (!v) return "—";
  if (v >= 1e9) return `R$ ${(v/1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v/1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v/1e3).toFixed(0)}K`;
  return `R$ ${v}`;
}

function scoreColor(s: number) {
  if (s >= 75) return "#10B981";
  if (s >= 50) return "#F59E0B";
  return "#7A8FA8";
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  userRole: string; userName: string;
  investors: Investor[]; opportunities: Opportunity[]; reports: Report[];
}

export function DealDiscoveryClient({ investors, opportunities, reports }: Props) {
  const [activeInvestor, setActiveInvestor] = useState<string | null>(null);
  const [briefing, setBriefing]             = useState<BriefingResult | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingError, setBriefingError]   = useState<string | null>(null);
  const [scanningReport, setScanningReport] = useState<string | null>(null);
  const [scanResults, setScanResults]       = useState<Record<string, number>>({});
  const [expandedOpp, setExpandedOpp]       = useState<string | null>(null);

  const unscannedReports = reports.filter(r => !r.opportunities_scanned_at);
  const scannedReports   = reports.filter(r => !!r.opportunities_scanned_at);

  const handleBriefing = async (investorId: string) => {
    if (activeInvestor === investorId && briefing) {
      setActiveInvestor(null); setBriefing(null); return;
    }
    setActiveInvestor(investorId);
    setBriefingLoading(true);
    setBriefingError(null);
    setBriefing(null);
    try {
      const res = await fetch(`/api/ma/briefing-by-profile?investor_id=${investorId}`);
      const data = await res.json() as BriefingResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao gerar briefing");
      setBriefing(data);
    } catch (e) {
      setBriefingError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBriefingLoading(false);
    }
  };

  const handleScanReport = async (reportId: string) => {
    setScanningReport(reportId);
    try {
      const res = await fetch("/api/ma/detect-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId, save: true }),
      });
      const data = await res.json() as { total?: number };
      setScanResults(p => ({ ...p, [reportId]: data.total ?? 0 }));
    } catch { /* silencioso */ }
    finally { setScanningReport(null); }
  };

  return (
    <div className="min-h-screen bg-[#09081A] p-6 space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Radar className="w-5 h-5 text-[#C9A84C]" />
          <span className="text-[#C9A84C] text-xs font-bold tracking-[2px] uppercase">Deal Discovery</span>
        </div>
        <h1 className="text-[#F0ECE4] text-3xl font-bold">Central de Oportunidades</h1>
        <p className="text-[#7A8FA8] text-sm mt-1">
          Cruzamento automático de deals · relatórios de pesquisa · perfis de investidores
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Investidores Ativos", value: investors.length, color: "#C9A84C" },
          { label: "Oportunidades Detectadas", value: opportunities.length, color: "#10B981" },
          { label: "Relatórios Escaneados", value: scannedReports.length, color: "#60A5FA" },
          { label: "Relatórios Pendentes", value: unscannedReports.length, color: "#F59E0B" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-xl border border-[#162744] bg-[#111F35] p-4">
            <p className="text-xs text-[#7A8FA8] mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Perfis de Investidores + Varredura ────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div style={{ width: 20, height: 2, background: "#C9A84C" }} />
            <h2 className="text-sm font-bold text-[#F0ECE4] uppercase tracking-wider">Varredura por Investidor</h2>
          </div>

          {investors.length === 0 ? (
            <div className="rounded-xl border border-[#243A66] bg-[#111F35] p-6 text-center">
              <Target className="w-8 h-8 text-[#243A66] mx-auto mb-2" />
              <p className="text-sm text-[#7A8FA8]">Nenhum investidor cadastrado ainda.</p>
              <p className="text-xs text-[#7A8FA8] mt-1">Acesse Mesa M&A → qualquer deal → aba Matches → Cadastrar Investidor</p>
            </div>
          ) : (
            investors.map(inv => (
              <Card key={inv.id} className={`border transition-all ${activeInvestor === inv.id ? "border-[#C9A84C]/40" : "border-[#243A66]"}`}>
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-[#F0ECE4]">{inv.nome}</CardTitle>
                      <p className="text-[10px] text-[#7A8FA8] mt-0.5">{inv.tipo} · {inv.setores.slice(0,3).join(", ")}{inv.setores.length > 3 ? "..." : ""}</p>
                    </div>
                    <Button size="sm" variant="outline"
                      className={`h-7 text-[10px] font-bold ${activeInvestor === inv.id ? "border-[#C9A84C]/50 text-[#C9A84C]" : "border-[#243A66] text-[#7A8FA8] hover:text-[#C9A84C]"}`}
                      onClick={() => handleBriefing(inv.id)}
                      disabled={briefingLoading && activeInvestor === inv.id}
                    >
                      {briefingLoading && activeInvestor === inv.id
                        ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Varrendo...</>
                        : <><Radar className="w-3 h-3 mr-1" />Varredura Completa</>
                      }
                    </Button>
                  </div>
                  {inv.ufs.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {inv.ufs.map(u => <span key={u} className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#162744] text-[#C9A84C] border border-[#C9A84C]/20">{u}</span>)}
                      <span className="text-[9px] text-[#7A8FA8]">
                        {inv.ticket_min || inv.ticket_max ? `· ${formatM(inv.ticket_min)}–${formatM(inv.ticket_max)}` : ""}
                      </span>
                    </div>
                  )}
                </CardHeader>

                {/* Briefing resultado */}
                {activeInvestor === inv.id && briefing && (
                  <CardContent className="pt-0 pb-3 space-y-3">
                    {briefingError ? (
                      <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{briefingError}</p>
                    ) : (
                      <>
                        {/* Resumo */}
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { label: "Pipeline M&A",   value: briefing.resumo.deals_pipeline,          color: "#C9A84C" },
                            { label: "Intakes W2",      value: briefing.resumo.intakes_w2,              color: "#10B981" },
                            { label: "Detectadas",      value: briefing.resumo.oportunidades_detectadas, color: "#60A5FA" },
                          ].map(s => (
                            <div key={s.label} className="rounded-lg bg-[#09081A] p-2 text-center border border-[#162744]">
                              <p className="text-[9px] text-[#7A8FA8] mb-1">{s.label}</p>
                              <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Deals do pipeline */}
                        {briefing.fontes.deals.length > 0 && (
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-[#C9A84C] mb-1">Pipeline M&A</p>
                            {briefing.fontes.deals.slice(0, 3).map((d, i) => (
                              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#162744] last:border-0">
                                <Building2 className="w-3 h-3 text-[#7A8FA8] flex-shrink-0" />
                                <span className="text-xs text-[#F0ECE4] flex-1 truncate">{String(d.empresa)}</span>
                                <span className="text-[10px] text-[#C9A84C] font-semibold">{String(d.valor)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Oportunidades detectadas */}
                        {briefing.fontes.oportunidades.length > 0 && (
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 mb-1">Detectadas em Relatórios</p>
                            {briefing.fontes.oportunidades.slice(0, 3).map((o, i) => (
                              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-[#162744] last:border-0">
                                <Zap className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                                <span className="text-xs text-[#F0ECE4] flex-1 truncate">{String(o.empresa)}</span>
                                <span className="text-[10px]" style={{ color: scoreColor(Number(o.score)) }}>{String(o.score)}/100</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {briefing.resumo.total_encontrado === 0 && (
                          <p className="text-xs text-[#7A8FA8] text-center py-2">
                            Nenhuma oportunidade compatível encontrada ainda.
                            {briefing.resumo.relatorios_nao_escaneados > 0 &&
                              ` Existem ${briefing.resumo.relatorios_nao_escaneados} relatório(s) não escaneados.`}
                          </p>
                        )}
                      </>
                    )}
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>

        {/* ── Oportunidades Detectadas + Scan de Relatórios ─────────────── */}
        <div className="space-y-4">

          {/* Relatórios pendentes de scan */}
          {unscannedReports.length > 0 && (
            <Card className="border-[#F59E0B]/20">
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] flex items-center gap-2">
                  <Bot className="w-3.5 h-3.5" />
                  {unscannedReports.length} Relatório{unscannedReports.length > 1 ? "s" : ""} Pendentes de Scan
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3 space-y-2">
                {unscannedReports.slice(0, 5).map(r => (
                  <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-[#162744] last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-[#F0ECE4] truncate">{r.squad_id}</p>
                      <p className="text-[9px] text-[#7A8FA8] truncate">{r.title?.slice(0, 60)}</p>
                    </div>
                    {scanResults[r.id] !== undefined ? (
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />{scanResults[r.id]} deal{scanResults[r.id] !== 1 ? "s" : ""}
                      </span>
                    ) : (
                      <Button size="sm" variant="outline"
                        className="h-6 text-[9px] border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/10"
                        disabled={scanningReport === r.id}
                        onClick={() => handleScanReport(r.id)}
                      >
                        {scanningReport === r.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <><Zap className="w-3 h-3 mr-1" />Scan</>
                        }
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Oportunidades detectadas */}
          <div className="flex items-center gap-2">
            <div style={{ width: 20, height: 2, background: "#10B981" }} />
            <h2 className="text-sm font-bold text-[#F0ECE4] uppercase tracking-wider">
              Oportunidades Detectadas ({opportunities.length})
            </h2>
          </div>

          {opportunities.length === 0 ? (
            <div className="rounded-xl border border-[#243A66] bg-[#111F35] p-6 text-center">
              <Zap className="w-8 h-8 text-[#243A66] mx-auto mb-2" />
              <p className="text-sm text-[#7A8FA8]">Nenhuma oportunidade detectada ainda.</p>
              <p className="text-xs text-[#7A8FA8] mt-1">Escaneie os relatórios acima para extrair oportunidades de negócio.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {opportunities.map(op => (
                <Card key={op.id}
                  className={`border cursor-pointer transition-all ${expandedOpp === op.id ? "border-emerald-500/30" : "border-[#243A66] hover:border-[#243A66]/80"}`}
                  onClick={() => setExpandedOpp(expandedOpp === op.id ? null : op.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${scoreColor(op.score_relevancia)}18`, border: `1px solid ${scoreColor(op.score_relevancia)}30` }}
                      >
                        <span className="text-[10px] font-bold" style={{ color: scoreColor(op.score_relevancia) }}>{op.score_relevancia}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-[#F0ECE4] truncate">{op.empresa_blind}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className="text-[8px] px-1 py-0 bg-[#162744] text-[#7A8FA8] border-[#243A66]">{op.setor}</Badge>
                          {op.uf && <span className="text-[9px] text-[#C9A84C]">{op.uf}</span>}
                          {op.valor_estimado && <span className="text-[9px] text-[#7A8FA8]">{formatM(op.valor_estimado)}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[9px] text-[#7A8FA8]">{op.tipo_operacao}</p>
                        {expandedOpp === op.id ? <ChevronUp className="w-3 h-3 text-[#7A8FA8] ml-auto" /> : <ChevronDown className="w-3 h-3 text-[#7A8FA8] ml-auto" />}
                      </div>
                    </div>

                    {expandedOpp === op.id && (
                      <div className="mt-3 pt-3 border-t border-[#162744] space-y-2">
                        <p className="text-[11px] text-[#C4CDD8] leading-relaxed">{op.descricao}</p>
                        {op.contexto && (
                          <div className="flex items-start gap-1.5 p-2 rounded bg-emerald-500/5 border border-emerald-500/15">
                            <TrendingUp className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-emerald-400">{op.contexto}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-[#7A8FA8]" />
                          <span className="text-[10px] text-[#7A8FA8]">Fonte: {op.source_type} · {new Date(op.created_at).toLocaleDateString("pt-BR")}</span>
                        </div>
                        <a href="/mesa-ma" className="inline-flex items-center gap-1 text-[10px] text-[#C9A84C] hover:underline">
                          <Building2 className="w-3 h-3" />Converter em Deal M&A →
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
