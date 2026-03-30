"use client";

import React, { useEffect, useState, useCallback } from "react";
import { TrendingUp, TrendingDown, RefreshCw, Activity } from "lucide-react";
import type { MarketData } from "@/app/api/market-data/route";

function TickerItem({
  label,
  value,
  unit,
  change,
  positive,
  sublabel,
}: {
  label: string;
  value: string;
  unit?: string;
  change?: string;
  positive?: boolean;
  sublabel?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 px-5 shrink-0">
      <span className="text-[#5A7490] text-xs font-semibold uppercase tracking-widest">{label}</span>
      <span className="text-white font-bold text-sm">
        {unit && <span className="text-[#5A7490] font-normal mr-0.5">{unit}</span>}
        {value}
      </span>
      {sublabel && (
        <span className="text-[#5A7490] text-[10px]">{sublabel}</span>
      )}
      {change && (
        <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${positive ? "text-emerald-400" : "text-red-400"}`}>
          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {change}
        </span>
      )}
      <span className="text-[#122036] text-base select-none">|</span>
    </span>
  );
}

export function MarketTicker() {
  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/market-data");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const items = data
    ? [
        { label: "SELIC Meta", value: data.selic.value, sublabel: "a.a. · COPOM" },
        { label: "CDI", value: data.cdi.value, sublabel: "a.a." },
        { label: "USD", value: data.usd.value, unit: "R$", change: data.usd.change, positive: data.usd.positive },
        { label: "EUR", value: data.eur.value, unit: "R$", change: data.eur.change, positive: data.eur.positive },
      ]
    : [];

  // Duplicate for seamless loop
  const allItems = [...items, ...items, ...items];

  return (
    <div className="relative flex items-center bg-[#050C18] border border-[#122036] rounded-xl overflow-hidden h-10 mb-5">
      {/* Left label */}
      <div className="flex items-center gap-2 px-3 bg-[#C4922E] h-full shrink-0 z-10">
        <Activity className="w-3.5 h-3.5 text-white" />
        <span className="text-white text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
          Mercado ao vivo
        </span>
      </div>

      {/* Scrolling area */}
      <div className="flex-1 overflow-hidden relative">
        {loading ? (
          <div className="flex items-center gap-2 px-4 text-[#5A7490] text-xs animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Carregando cotações...
          </div>
        ) : error || !data ? (
          <div className="flex items-center gap-2 px-4 text-[#5A7490] text-xs">
            Cotações indisponíveis no momento
          </div>
        ) : (
          <div className="flex animate-ticker whitespace-nowrap">
            {allItems.map((item, i) => (
              <TickerItem key={i} {...item} />
            ))}
          </div>
        )}
      </div>

      {/* Right: timestamp + refresh */}
      {data && !loading && (
        <div className="flex items-center gap-2 px-3 shrink-0 border-l border-[#122036]">
          <span className="text-[#5A7490] text-[10px]">
            {data.updatedAt}
          </span>
          <button
            onClick={fetchData}
            title="Atualizar"
            className="text-[#5A7490] hover:text-[#C4922E] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Fade edges */}
      <div className="absolute left-[112px] top-0 w-6 h-full bg-gradient-to-r from-[#050C18] to-transparent pointer-events-none z-10" />
      <div className="absolute right-[72px] top-0 w-6 h-full bg-gradient-to-l from-[#050C18] to-transparent pointer-events-none z-10" />
    </div>
  );
}
