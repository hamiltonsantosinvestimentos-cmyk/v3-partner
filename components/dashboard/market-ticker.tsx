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
    <span className="inline-flex items-center gap-1.5 px-4 shrink-0">
      <span className="text-[#7A8FA8] text-[10px] font-bold uppercase tracking-widest leading-none">
        {label}
      </span>
      <span className="text-[#F0ECE4] font-bold text-xs leading-none">
        {unit && <span className="text-[#7A8FA8] font-normal mr-0.5 text-[10px]">{unit}</span>}
        {value}
      </span>
      {sublabel && (
        <span className="text-[#5A7490] text-[9px] leading-none">{sublabel}</span>
      )}
      {change && (
        <span
          className={`inline-flex items-center gap-0.5 text-[10px] font-semibold leading-none ${
            positive ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {positive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
          {change}
        </span>
      )}
      <span className="text-[#1E2F4A] text-sm select-none mx-1">·</span>
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
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const items = data
    ? [
        { label: "SELIC",  value: data.selic.value, sublabel: "a.a. · COPOM" },
        { label: "CDI",    value: data.cdi.value,   sublabel: "a.a." },
        { label: "USD",    value: data.usd.value,   unit: "R$", change: data.usd.change, positive: data.usd.positive },
        { label: "EUR",    value: data.eur.value,   unit: "R$", change: data.eur.change, positive: data.eur.positive },
        { label: "OURO",   value: data.gold.value,  unit: "R$", sublabel: "B3/g" },
      ]
    : [];

  // Triplica para loop contínuo
  const allItems = [...items, ...items, ...items];

  return (
    <div className="relative flex items-center bg-[#09081A] border border-[#122036] rounded-xl overflow-hidden h-11 mb-5">
      {/* Label esquerda */}
      <div className="flex items-center gap-1.5 px-3 bg-[#C9A84C] h-full shrink-0 z-10 min-w-[110px]">
        <Activity className="w-3 h-3 text-[#09081A]" />
        <span className="text-[#09081A] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
          Mercado ao vivo
        </span>
      </div>

      {/* Área de scroll */}
      <div className="flex-1 overflow-hidden relative h-full flex items-center">
        {loading ? (
          <div className="flex items-center gap-2 px-4 text-[#7A8FA8] text-xs animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Carregando cotações...
          </div>
        ) : error || !data ? (
          <div className="flex items-center gap-2 px-4 text-[#7A8FA8] text-xs">
            Cotações indisponíveis no momento
          </div>
        ) : (
          <div className="flex animate-ticker whitespace-nowrap items-center h-full">
            {allItems.map((item, i) => (
              <TickerItem key={i} {...item} />
            ))}
          </div>
        )}
      </div>

      {/* Timestamp + refresh */}
      {data && !loading && (
        <div className="flex items-center gap-2 px-3 shrink-0 border-l border-[#122036] h-full">
          <span className="text-[#5A7490] text-[10px] leading-none">{data.updatedAt}</span>
          <button
            onClick={fetchData}
            title="Atualizar"
            className="text-[#5A7490] hover:text-[#C9A84C] transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Fade nas bordas */}
      <div className="absolute left-[110px] top-0 w-8 h-full bg-gradient-to-r from-[#09081A] to-transparent pointer-events-none z-10" />
      <div className="absolute right-[72px] top-0 w-8 h-full bg-gradient-to-l from-[#09081A] to-transparent pointer-events-none z-10" />
    </div>
  );
}
