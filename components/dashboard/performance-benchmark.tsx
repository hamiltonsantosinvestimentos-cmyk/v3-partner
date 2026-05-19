"use client";

import React from "react";
import { TrendingUp, TrendingDown, Trophy } from "lucide-react";

export interface BenchmarkData {
  partnerDeals: number;
  avgDeals: number;
  partnerVolume: number;
  avgVolume: number;
  partnerLeads: number;
  avgLeads: number;
  partnerCommission: number;
  avgCommission: number;
}

interface PerformanceBenchmarkProps {
  benchmarkData: BenchmarkData;
}

function pct(partner: number, avg: number): number {
  if (avg === 0) return 0;
  return Math.round(((partner - avg) / avg) * 100);
}

function fmtVal(value: number, isCurrency: boolean): string {
  if (isCurrency) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return value.toString();
}

interface BenchmarkRowProps {
  label: string;
  partnerValue: number;
  avgValue: number;
  isCurrency?: boolean;
}

function BenchmarkRow({ label, partnerValue, avgValue, isCurrency = false }: BenchmarkRowProps) {
  const diff = pct(partnerValue, avgValue);
  const isAbove = diff >= 0;
  const barWidth = avgValue === 0 ? 0 : Math.min(100, Math.round((partnerValue / Math.max(partnerValue, avgValue)) * 100));
  const avgBarWidth = avgValue === 0 ? 0 : Math.min(100, Math.round((avgValue / Math.max(partnerValue, avgValue)) * 100));

  return (
    <div className="py-3 border-b border-[#243A66]/50 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#7A8FA8] font-medium">{label}</span>
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            isAbove
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-amber-500/15 text-amber-400"
          }`}
        >
          {isAbove ? (
            <TrendingUp className="w-2.5 h-2.5" />
          ) : (
            <TrendingDown className="w-2.5 h-2.5" />
          )}
          {diff > 0 ? "+" : ""}{diff}% {isAbove ? "acima" : "abaixo"} da média
        </span>
      </div>

      {/* Bars */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#C9A84C] w-10 flex-shrink-0 font-bold uppercase">Você</span>
          <div className="flex-1 h-2 rounded-full bg-[#09081A] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#C9A84C] transition-all duration-500"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-[#F0ECE4] w-16 text-right flex-shrink-0">
            {fmtVal(partnerValue, isCurrency)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#7A8FA8] w-10 flex-shrink-0 uppercase">Média</span>
          <div className="flex-1 h-2 rounded-full bg-[#09081A] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#7A8FA8]/40 transition-all duration-500"
              style={{ width: `${avgBarWidth}%` }}
            />
          </div>
          <span className="text-[10px] text-[#7A8FA8] w-16 text-right flex-shrink-0">
            {fmtVal(avgValue, isCurrency)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PerformanceBenchmark({ benchmarkData }: PerformanceBenchmarkProps) {
  const {
    partnerDeals, avgDeals,
    partnerVolume, avgVolume,
    partnerLeads, avgLeads,
    partnerCommission, avgCommission,
  } = benchmarkData;

  const dealsAbove   = pct(partnerDeals, avgDeals) > 20;
  const volumeAbove  = pct(partnerVolume, avgVolume) > 20;
  const leadsAbove   = pct(partnerLeads, avgLeads) > 20;
  const commAbove    = pct(partnerCommission, avgCommission) > 20;
  const isTopPerformer = dealsAbove && volumeAbove && leadsAbove && commAbove;

  return (
    <div className="rounded-xl border border-[#243A66] bg-[#111F35] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest">
          Seu desempenho vs. média da plataforma
        </p>
        {isTopPerformer && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30">
            <Trophy className="w-3 h-3" />
            Top performer!
          </span>
        )}
      </div>

      {/* Rows */}
      <div>
        <BenchmarkRow
          label="Deals fechados"
          partnerValue={partnerDeals}
          avgValue={avgDeals}
        />
        <BenchmarkRow
          label="Volume total"
          partnerValue={partnerVolume}
          avgValue={avgVolume}
          isCurrency
        />
        <BenchmarkRow
          label="Leads marketplace"
          partnerValue={partnerLeads}
          avgValue={avgLeads}
        />
        <BenchmarkRow
          label="Comissão média"
          partnerValue={partnerCommission}
          avgValue={avgCommission}
          isCurrency
        />
      </div>
    </div>
  );
}
