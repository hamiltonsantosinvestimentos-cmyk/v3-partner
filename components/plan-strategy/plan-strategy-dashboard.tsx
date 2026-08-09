"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { SECTORS, SECTOR_LABELS, type Sector } from "@/lib/sector-goals";
import { CADENCES, CADENCE_LABELS, STATUS_LABELS, type Cadence, type CheckinStatus } from "@/lib/plan-strategy";

interface DashboardSector {
  sector: Sector;
  meta_mensal: number;
  realizado_mensal: number;
  pct_mensal: number;
  meta_anual: number;
  mrr: number | null;
  cadence: Record<Cadence, { status: CheckinStatus; period_label: string }>;
}

interface DashboardData {
  year: number;
  month: number;
  periods: Record<Cadence, string>;
  sectors: DashboardSector[];
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function pctColor(pct: number) {
  if (pct >= 100) return "text-emerald-400";
  if (pct >= 70) return "text-amber-400";
  return "text-red-400";
}

function pctBarColor(pct: number) {
  if (pct >= 100) return "bg-emerald-400";
  if (pct >= 70) return "bg-amber-400";
  return "bg-red-400";
}

function statusDotClass(status: CheckinStatus) {
  if (status === "CONCLUIDO") return "bg-emerald-400";
  if (status === "EM_ANDAMENTO") return "bg-amber-400";
  return "bg-[#3A5070]";
}

function CadencePill({ cadence, entry }: { cadence: Cadence; entry: { status: CheckinStatus; period_label: string } }) {
  return (
    <div className="flex flex-col items-center gap-1" title={`${CADENCE_LABELS[cadence]} · ${entry.period_label} · ${STATUS_LABELS[entry.status]}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${statusDotClass(entry.status)}`} />
      <span className="text-[8px] text-[#7A8FA8] uppercase tracking-wide">{CADENCE_LABELS[cadence].slice(0, 3)}</span>
    </div>
  );
}

export function PlanStrategyDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plan-strategy/dashboard").then(r => r.json());
      setData(res);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-[#C9A84C]" /></div>;
  }
  if (!data) return null;

  const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#7A8FA8]">
          Metas de <span className="text-[#F0ECE4] font-semibold">{MESES[data.month - 1]}/{data.year}</span> (fonte: Projeto)
          {" "}cruzadas com status de cadência do período corrente
        </p>
        <button onClick={load} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#3A5070] transition-colors">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </button>
      </div>

      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl overflow-x-auto">
        <table className="w-full text-xs min-w-[760px]">
          <thead>
            <tr className="border-b border-[#243A66]">
              <th className="text-left px-4 py-3 text-[#7A8FA8] font-semibold uppercase text-[10px] tracking-wide">Vertical</th>
              <th className="text-right px-3 py-3 text-[#7A8FA8] font-semibold uppercase text-[10px] tracking-wide">Meta do mês</th>
              <th className="text-right px-3 py-3 text-[#7A8FA8] font-semibold uppercase text-[10px] tracking-wide">Realizado</th>
              <th className="px-3 py-3 text-[#7A8FA8] font-semibold uppercase text-[10px] tracking-wide">% Meta</th>
              <th className="text-right px-3 py-3 text-[#7A8FA8] font-semibold uppercase text-[10px] tracking-wide">MRR</th>
              {CADENCES.map(c => (
                <th key={c} className="px-2 py-3 text-[#7A8FA8] font-semibold uppercase text-[10px] tracking-wide">
                  {CADENCE_LABELS[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.sectors.map(row => (
              <tr key={row.sector} className="border-b border-[#243A66]/50 last:border-0 hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-semibold text-[#F0ECE4] whitespace-nowrap">{SECTOR_LABELS[row.sector]}</td>
                <td className="px-3 py-3 text-right text-[#7A8FA8] font-mono">{row.meta_mensal > 0 ? moeda(row.meta_mensal) : "—"}</td>
                <td className="px-3 py-3 text-right text-[#F0ECE4] font-mono">{moeda(row.realizado_mensal)}</td>
                <td className="px-3 py-3">
                  {row.meta_mensal > 0 ? (
                    <div className="flex items-center gap-2 min-w-[90px]">
                      <div className="flex-1 h-1.5 rounded-full bg-[#0A1628] overflow-hidden">
                        <div className={`h-full rounded-full ${pctBarColor(row.pct_mensal)}`} style={{ width: `${Math.min(row.pct_mensal, 100)}%` }} />
                      </div>
                      <span className={`font-bold font-mono text-[11px] ${pctColor(row.pct_mensal)}`}>{row.pct_mensal}%</span>
                    </div>
                  ) : <span className="text-[#3A5070]">sem meta</span>}
                </td>
                <td className="px-3 py-3 text-right text-[#C9A84C] font-mono">{row.mrr !== null ? moeda(row.mrr) : "—"}</td>
                {CADENCES.map(c => (
                  <td key={c} className="px-2 py-3">
                    <div className="flex justify-center">
                      <CadencePill cadence={c} entry={row.cadence[c]} />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-[#7A8FA8]">
        Metas editáveis na aba <span className="text-[#C9A84C]">Projeto</span>. Check-ins de cadência editáveis abaixo, na aba <span className="text-[#C9A84C]">Cadência</span>.
      </p>
    </div>
  );
}
