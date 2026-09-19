"use client";

import { useState, useEffect } from "react";
import { Loader2, Flame, RefreshCw } from "lucide-react";

// Fase 5, sub-entrega 5.2 (19/09/2026, pedido de Joao): mapa de calor sobre
// o motor de match ja existente (match_cm_listings_to_demands()). Mesmo
// padrao de modal ja usado no resto da Mesa (fixed inset-0, nunca fecha no
// backdrop, ver CommissionCalculatorPanel).

interface Props {
  onClose: () => void;
}

interface HeatListing {
  id: string;
  label: string;
  asset_type: string;
  valor_face: number;
}
interface HeatDemand {
  id: string;
  label: string;
}
interface HeatMatch {
  listing_id: string;
  demand_id: string;
  score: number;
}

function scoreColor(score: number | undefined): { bg: string; fg: string } {
  if (score === undefined) return { bg: "#1A2438", fg: "#5C6B85" };
  if (score >= 70) return { bg: "#3FB56A", fg: "#09081A" };
  if (score >= 50) return { bg: "#E0B04C", fg: "#09081A" };
  return { bg: "#3A2E2E", fg: "#9BAFC5" };
}

export function MatchHeatmapPanel({ onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<HeatListing[]>([]);
  const [demands, setDemands] = useState<HeatDemand[]>([]);
  const [matches, setMatches] = useState<HeatMatch[]>([]);
  const [runningNow, setRunningNow] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/cm/matches/heatmap");
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erro ao carregar o mapa de calor"); return; }
      setListings(json.listings ?? []);
      setDemands(json.demands ?? []);
      setMatches(json.matches ?? []);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunningNow(true);
    try {
      await fetch("/api/cm/matches/run", { method: "POST" });
      await load();
    } catch {
      setError("Erro ao rodar o motor de match");
    } finally {
      setRunningNow(false);
    }
  };

  const scoreOf = (listingId: string, demandId: string): number | undefined =>
    matches.find((m) => m.listing_id === listingId && m.demand_id === demandId)?.score;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-4xl max-h-[85vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-xl flex flex-col">
        <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-[#C9A84C]" />
            <div>
              <div className="text-sm font-bold text-[#F5F1E8]">Mapa de Calor de Match</div>
              <div className="text-[10px] text-[#9BAFC5]">Ativos na Vitrine × Demandas ativas, score do motor já existente</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={runNow} disabled={runningNow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C]/30 text-[#C9A84C] text-[11px] font-bold hover:bg-[#C9A84C]/10 transition disabled:opacity-50">
              {runningNow ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Rodar agora
            </button>
            <button onClick={onClose} className="text-[#9BAFC5] hover:text-[#F5F1E8] text-xl">&times;</button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-[#C9A84C]" />
            </div>
          ) : error ? (
            <p className="text-[12px] text-red-400">{error}</p>
          ) : listings.length === 0 || demands.length === 0 ? (
            <p className="text-[12px] text-[#9BAFC5]">
              {listings.length === 0 ? "Nenhum ativo na Vitrine no momento." : "Nenhuma demanda de compra ativa no momento."}
              {" "}O motor roda em ciclo (cron diário), não em tempo real. Clique em "Rodar agora" para forçar um ciclo novo.
            </p>
          ) : (
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  <th className="text-left p-2 bg-[#12112A] border border-[#243A66] text-[#C9A84C] sticky left-0">Ativo \ Demanda</th>
                  {demands.map((d) => (
                    <th key={d.id} className="p-2 bg-[#12112A] border border-[#243A66] text-[#C9A84C] font-bold whitespace-nowrap">{d.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listings.map((l) => (
                  <tr key={l.id}>
                    <th className="text-left p-2 bg-[#12112A] border border-[#243A66] text-[#F5F1E8] font-semibold whitespace-nowrap sticky left-0">{l.label}</th>
                    {demands.map((d) => {
                      const score = scoreOf(l.id, d.id);
                      const { bg, fg } = scoreColor(score);
                      return (
                        <td key={d.id} className="p-2 border border-[#243A66] text-center font-bold" style={{ background: bg, color: fg }}>
                          {score ?? "-"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-3 border-t border-[#243A66] flex items-center gap-4 text-[9px] text-[#9BAFC5]">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#3FB56A" }} /> 70 a 100</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#E0B04C" }} /> 50 a 69 (piso do motor)</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#3A2E2E" }} /> Sem match registrado</span>
        </div>
      </div>
    </div>
  );
}
