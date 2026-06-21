"use client";

import React, { useState } from "react";
import { BarChart2, Calendar, Layers, TrendingUp, Bot, ExternalLink, Zap, CheckCircle2, Loader2, X, Users } from "lucide-react";

export interface Report {
  id: string;
  name: string;
  date: string;
  title: string;
  type: "diario" | "setor";
  rawUrl: string;
  folder: "root" | "historico";
}

export interface GeneratedReport {
  id: string;
  squad_id: string;
  title: string;
  created_at: string;
  opportunities_scanned_at?: string | null;
  opportunities_found?: number | null;
}

interface Props {
  reports: Report[];
  generatedReports?: GeneratedReport[];
  userRole: string;
  userName: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

const SQUAD_NAMES: Record<string, string> = {
  "analista-ma": "Analista M&A",
  "deal-hunter": "Deal Hunter",
  "estrategista": "Estrategista",
  "monitor-regulatorio": "Monitor Regulatório",
  "pesquisador": "Pesquisador de Mercado",
  "meeting-intel": "Inteligência de Reuniões",
  "w4-meetings": "Relatório Semanal de Reuniões",
};

const MEETING_SQUAD_IDS = new Set(["meeting-intel", "w4-meetings"]);

export function ReportosClient({ reports, generatedReports = [], userRole }: Props) {
  const [filter, setFilter] = useState<"todos" | "diario" | "setor" | "reunioes" | "gerados">("todos");

  const filtered = filter === "gerados" || filter === "reunioes" ? [] : (filter === "todos" ? reports : reports.filter(r => r.type === filter));
  const diarios = reports.filter(r => r.type === "diario").length;
  const setores = reports.filter(r => r.type === "setor").length;
  const meetingReports = generatedReports.filter(r => MEETING_SQUAD_IDS.has(r.squad_id));
  const squadReports = generatedReports.filter(r => !MEETING_SQUAD_IDS.has(r.squad_id));
  const showGenerated = filter === "todos" || filter === "gerados";
  const showMeetings = filter === "todos" || filter === "reunioes";

  return (
    <div className="min-h-screen bg-[#09081A] p-6">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="w-5 h-5 text-[#C9A84C]" />
          <span className="text-[#C9A84C] text-xs font-bold tracking-[2px] uppercase">Central de Inteligência</span>
        </div>
        <h1 className="text-[#F0ECE4] text-3xl font-bold">Relatórios V3</h1>
        <p className="text-[#7A8FA8] text-sm mt-1">
          {reports.length} relatórios disponíveis · {userRole === "ADMIN" ? "Visão completa" : "Visão interna"}
        </p>
      </div>

      {/* Stats + Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex gap-3">
          {[
            { key: "todos", label: `Todos (${reports.length + generatedReports.length})` },
            { key: "diario", label: `Diários (${diarios})` },
            { key: "setor", label: `Setoriais (${setores})` },
            { key: "reunioes", label: `Reuniões (${meetingReports.length})` },
            { key: "gerados", label: `Gerados por IA (${squadReports.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              className={`text-xs px-4 py-2 rounded-lg font-semibold transition-colors ${
                filter === key
                  ? "bg-[#C9A84C] text-[#09081A]"
                  : "bg-[#111F35] text-[#7A8FA8] hover:text-[#F0ECE4] border border-[#243A66]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 && !(showGenerated && squadReports.length > 0) && !(showMeetings && meetingReports.length > 0) ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <BarChart2 className="w-12 h-12 text-[#243A66] mb-4" />
          <p className="text-[#9BAFC5] text-sm">Nenhum relatório encontrado.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* CCR Reports */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(report => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          )}

          {/* Meeting Reports */}
          {showMeetings && meetingReports.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-[#C9A84C]" />
                <span className="text-[#C9A84C] text-[10px] font-bold tracking-[2px] uppercase">Inteligência de Reuniões</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {meetingReports.map(r => (
                  <GeneratedReportCard key={r.id} report={r} />
                ))}
              </div>
            </div>
          )}

          {/* Generated Reports — Squads IA */}
          {showGenerated && squadReports.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-4 h-4 text-[#C9A84C]" />
                <span className="text-[#C9A84C] text-[10px] font-bold tracking-[2px] uppercase">Gerados por IA — Squads V3</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {squadReports.map(r => (
                  <GeneratedReportCard key={r.id} report={r} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GeneratedReportCard({ report }: { report: GeneratedReport }) {
  const [scanning, setScanning]   = useState(false);
  const [scanResult, setScanResult] = useState<{ total: number; resumo: string } | null>(
    report.opportunities_scanned_at
      ? { total: report.opportunities_found ?? 0, resumo: "Já escaneado" }
      : null
  );
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScan = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScanning(true);
    setScanError(null);
    try {
      const res = await fetch("/api/ma/detect-opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: report.id, save: true }),
      });
      const data = await res.json() as { total?: number; resumo?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro no scan");
      setScanResult({ total: data.total ?? 0, resumo: data.resumo ?? "" });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Erro");
    } finally {
      setScanning(false);
    }
  };

  const alreadyScanned = !!scanResult;

  return (
    <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-5 hover:border-[#C9A84C]/40 hover:bg-[#162744] transition-all duration-200 group">
      <div className="flex items-start justify-between mb-4">
        <span className="text-[9px] font-bold uppercase tracking-[1.5px] px-2 py-1 rounded-full text-[#C9A84C] bg-[#C9A84C]/10">
          {SQUAD_NAMES[report.squad_id] ?? report.squad_id}
        </span>
        <div className="flex items-center gap-1 text-[#7A8FA8]">
          <Calendar className="w-3.5 h-3.5" />
          <span className="text-[10px]">{formatDate(report.created_at.slice(0, 10))}</span>
        </div>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#09081A] flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-[#C9A84C]" />
        </div>
        <h3 className="text-[#F0ECE4] font-semibold text-sm leading-snug pt-1 line-clamp-2">
          {report.title}
        </h3>
      </div>

      {/* Resultado do scan */}
      {scanResult && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-400">
              {scanResult.total} oportunidade{scanResult.total !== 1 ? "s" : ""} detectada{scanResult.total !== 1 ? "s" : ""}
            </span>
          </div>
          {scanResult.resumo && scanResult.resumo !== "Já escaneado" && (
            <p className="text-[9px] text-[#7A8FA8] mt-1 line-clamp-2">{scanResult.resumo}</p>
          )}
        </div>
      )}
      {scanError && (
        <p className="text-[10px] text-red-400 mb-3">{scanError}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        <a
          href={`/api/relatorios/generated?id=${report.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[#7A8FA8] hover:text-[#C9A84C] transition-colors text-[10px]"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          Abrir relatório
        </a>

        <button
          onClick={handleScan}
          disabled={scanning || alreadyScanned}
          className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
            alreadyScanned
              ? "text-emerald-400 bg-emerald-500/10 cursor-default"
              : "text-[#C9A84C] bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 border border-[#C9A84C]/30 disabled:opacity-50"
          }`}
        >
          {scanning
            ? <><Loader2 className="w-3 h-3 animate-spin" />Escaneando...</>
            : alreadyScanned
            ? <><CheckCircle2 className="w-3 h-3" />Escaneado</>
            : <><Zap className="w-3 h-3" />Detectar Deals</>
          }
        </button>
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  const Icon = report.type === "diario" ? BarChart2 : TrendingUp;
  const typeColor = report.type === "diario" ? "text-[#C9A84C] bg-[#C9A84C]/10" : "text-emerald-400 bg-emerald-900/30";
  const typeLabel = report.type === "diario" ? "Relatório Diário" : "Relatório Setorial";
  const contentUrl = `/api/relatorios/content?file=${encodeURIComponent(report.folder === "historico" ? `historico/${report.name}` : report.name)}`;

  return (
    <a
      href={contentUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-left bg-[#111F35] border border-[#243A66] rounded-xl p-5 hover:border-[#C9A84C] hover:bg-[#162744] transition-all duration-200 group w-full block"
    >
      <div className="flex items-start justify-between mb-4">
        <span className={`text-[9px] font-bold uppercase tracking-[1.5px] px-2 py-1 rounded-full ${typeColor}`}>
          {typeLabel}
        </span>
        <div className="flex items-center gap-1 text-[#7A8FA8] group-hover:text-[#C9A84C] transition-colors">
          <Calendar className="w-3.5 h-3.5" />
          <span className="text-[10px]">{formatDate(report.date)}</span>
        </div>
      </div>

      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#09081A] flex items-center justify-center shrink-0 group-hover:bg-[#C9A84C]/10 transition-colors">
          <Icon className="w-4 h-4 text-[#C9A84C]" />
        </div>
        <h3 className="text-[#F0ECE4] font-semibold text-sm leading-snug group-hover:text-[#C9A84C] transition-colors pt-1">
          {report.title}
        </h3>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Layers className="w-3 h-3 text-[#7A8FA8]" />
          <span className="text-[#7A8FA8] text-[10px]">V3 Intelligence</span>
        </div>
        <span className="text-[#C9A84C] text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
          Abrir ↗
        </span>
      </div>
    </a>
  );
}

function ReportModal({ report, onClose }: { report: Report; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#09081A]">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#243A66] bg-[#111F35] shrink-0">
        <div className="flex items-center gap-3">
          <BarChart2 className="w-4 h-4 text-[#C9A84C]" />
          <div>
            <span className="text-[#C9A84C] text-[9px] font-bold tracking-[2px] uppercase block">
              {report.type === "diario" ? "Relatório Diário" : "Relatório Setorial"}
            </span>
            <span className="text-[#F0ECE4] text-sm font-semibold">{report.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={report.rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#7A8FA8] hover:text-[#C9A84C] transition-colors px-3 py-1.5 rounded-lg border border-[#243A66] hover:border-[#C9A84C]"
          >
            <ExternalLink className="w-3 h-3" />
            Abrir original
          </a>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#162744] hover:bg-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Iframe via proxy — evita CSP e carrega server-side */}
      <div className="flex-1 overflow-hidden">
        <iframe
          src={`/api/relatorios/content?file=${encodeURIComponent(report.folder === "historico" ? `historico/${report.name}` : report.name)}`}
          title={report.title}
          className="w-full h-full border-0"
          sandbox="allow-same-origin allow-scripts allow-forms"
        />
      </div>
    </div>
  );
}
