"use client";

import React, { useState } from "react";
import { BarChart2, Calendar, Layers, TrendingUp } from "lucide-react";

export interface Report {
  id: string;
  name: string;
  date: string;
  title: string;
  type: "diario" | "setor";
  rawUrl: string;
  folder: "root" | "historico";
}

interface Props {
  reports: Report[];
  userRole: string;
  userName: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}

export function ReportosClient({ reports, userRole }: Props) {
  const [filter, setFilter] = useState<"todos" | "diario" | "setor">("todos");

  const filtered = filter === "todos" ? reports : reports.filter(r => r.type === filter);
  const diarios = reports.filter(r => r.type === "diario").length;
  const setores = reports.filter(r => r.type === "setor").length;

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
            { key: "todos", label: `Todos (${reports.length})` },
            { key: "diario", label: `Diários (${diarios})` },
            { key: "setor", label: `Setoriais (${setores})` },
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
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <BarChart2 className="w-12 h-12 text-[#243A66] mb-4" />
          <p className="text-[#7A8FA8] text-sm">Nenhum relatório encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(report => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
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
