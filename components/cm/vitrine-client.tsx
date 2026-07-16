"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  SlidersHorizontal, Gavel, Calculator, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BidModal } from "./bid-modal";
import { CalculadoraWidget } from "./calculadora-widget";

interface Listing {
  anonymous_id: string;
  asset_type: string;
  ente_devedor: string | null;
  esfera: string | null;
  tribunal: string | null;
  natureza: string | null;
  valor_face: number;
  valor_atualizado: number | null;
  desagio_pretendido: number | null;
  tir_estimada: number | null;
  vpl: number | null;
  prazo_estimado_meses: number | null;
  risk_score: number | null;
  allows_tranching: boolean;
  listing_status: string;
  created_at: string;
  id: string;
}

const ASSET_LABELS: Record<string, string> = {
  precatorio: "Precatório",
  direito_creditorio: "Dir. Creditório",
  ipi: "IPI",
  icms: "ICMS",
  outros: "Outros",
};

const ASSET_COLORS: Record<string, string> = {
  precatorio: "bg-[#C9A84C] text-[#09081A]",
  direito_creditorio: "bg-blue-500 text-white",
  ipi: "bg-emerald-500 text-white",
  icms: "bg-purple-500 text-white",
  outros: "bg-[#9BAFC5] text-[#09081A]",
};

function scoreColor(score: number | null) {
  if (!score) return "text-[#9BAFC5]";
  if (score >= 70) return "text-emerald-400";
  if (score >= 50) return "text-[#C9A84C]";
  return "text-red-400";
}

function formatBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

export function VitrineClient({ userRole = "PARTNER" }: { userRole?: string }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const calcRef = React.useRef<HTMLDivElement>(null);
  const filtersRef = React.useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState({
    asset_type: "",
    natureza: "",
    esfera: "",
    desagio_min: "",
    valor_face_min: "",
    valor_face_max: "",
  });

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    try {
      const res = await fetch(`/api/cm/vitrine?${params}`);
      const json = await res.json();
      setListings(json.assets ?? []);
    } catch (err) {
      console.error("[Vitrine] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F1E8]">Marketplace de Ativos</h1>
          <p className="text-sm text-[#9BAFC5]">Bolsa de Precatórios e Direitos Creditórios</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              if (calcRef.current) {
                const isHidden = calcRef.current.style.display === "none";
                calcRef.current.style.display = isHidden ? "block" : "none";
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#C9A84C]/30 text-[#C9A84C] text-sm font-medium hover:bg-[#C9A84C]/10 transition"
          >
            <Calculator size={16} /> Calculadora
          </button>
          <button
            onClick={() => {
              if (filtersRef.current) {
                const isHidden = filtersRef.current.style.display === "none";
                filtersRef.current.style.display = isHidden ? "grid" : "none";
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#9BAFC5]/20 text-[#9BAFC5] text-sm font-medium hover:bg-[#162744] transition"
          >
            <SlidersHorizontal size={16} /> Filtros
          </button>
        </div>
      </div>

      {/* Calculadora */}
      <div ref={calcRef} style={{ display: "none" }} className="mb-6">
        <CalculadoraWidget userRole={userRole} />
      </div>

      {/* Filtros */}
      <div ref={filtersRef} style={{ display: "none" }} className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6 p-4 bg-[#12112A] rounded-lg border border-[#9BAFC5]/10">
          <select
            value={filters.asset_type}
            onChange={(e) => setFilters({ ...filters, asset_type: e.target.value })}
            className="bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]"
          >
            <option value="">Tipo de Ativo</option>
            {Object.entries(ASSET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select
            value={filters.esfera}
            onChange={(e) => setFilters({ ...filters, esfera: e.target.value })}
            className="bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]"
          >
            <option value="">Esfera</option>
            <option value="Federal">Federal</option>
            <option value="Estadual">Estadual</option>
            <option value="Municipal">Municipal</option>
          </select>
          <select
            value={filters.natureza}
            onChange={(e) => setFilters({ ...filters, natureza: e.target.value })}
            className="bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]"
          >
            <option value="">Natureza</option>
            <option value="Alimentar">Alimentar</option>
            <option value="Comum">Comum</option>
          </select>
          <input
            type="number" placeholder="Deságio mín (%)"
            value={filters.desagio_min}
            onChange={(e) => setFilters({ ...filters, desagio_min: e.target.value })}
            className="bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8] placeholder:text-[#9BAFC5]/50"
          />
          <input
            type="number" placeholder="Valor mín (R$)"
            value={filters.valor_face_min}
            onChange={(e) => setFilters({ ...filters, valor_face_min: e.target.value })}
            className="bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8] placeholder:text-[#9BAFC5]/50"
          />
          <input
            type="number" placeholder="Valor máx (R$)"
            value={filters.valor_face_max}
            onChange={(e) => setFilters({ ...filters, valor_face_max: e.target.value })}
            className="bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8] placeholder:text-[#9BAFC5]/50"
          />
      </div>

      {/* Contador */}
      <div className="text-xs text-[#9BAFC5] mb-4">{listings.length} ativo(s) na vitrine</div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-[#C9A84C]" size={32} />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-[#9BAFC5]">
          <Gavel size={48} className="mx-auto mb-4 opacity-30" />
          <p>Nenhum ativo disponível na vitrine</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((l) => {
            const custo = l.desagio_pretendido
              ? l.valor_face * (1 - l.desagio_pretendido / 100)
              : null;
            return (
              <div key={l.anonymous_id} className="bg-[#12112A] border border-[#C9A84C]/20 rounded-lg p-5 hover:border-[#C9A84C]/40 transition">
                {/* Badge + Score */}
                <div className="flex justify-between items-center mb-3">
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", ASSET_COLORS[l.asset_type] ?? ASSET_COLORS.outros)}>
                    {ASSET_LABELS[l.asset_type] ?? l.asset_type}
                  </span>
                  <span className={cn("text-xs font-bold", scoreColor(l.risk_score))}>
                    {l.risk_score ? `Score ${l.risk_score}` : "—"}
                  </span>
                </div>

                {/* ID */}
                <div className="text-[10px] text-[#C9A84C] font-bold tracking-wider mb-2">{l.anonymous_id}</div>

                {/* Dados */}
                <div className="space-y-1 text-[11px] text-[#9BAFC5]">
                  <div>Ente: <span className="text-[#F5F1E8]">{l.ente_devedor ?? "—"}</span></div>
                  <div>Natureza: <span className="text-[#F5F1E8]">{l.natureza ?? "—"}</span></div>
                  <div>Tribunal: <span className="text-[#F5F1E8]">{l.tribunal ?? "—"}</span></div>
                </div>

                {/* Financeiro */}
                <div className="border-t border-[#9BAFC5]/10 mt-3 pt-3 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#9BAFC5]">Valor de Face</span>
                    <span className="text-[#F5F1E8] font-bold text-xs">{formatBRL(l.valor_face)}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-[#9BAFC5]">Deságio</span>
                    <span className="text-[#C9A84C] font-bold text-xs">{l.desagio_pretendido ? `${l.desagio_pretendido}%` : "—"}</span>
                  </div>
                  {custo && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-[#9BAFC5]">Custo Estimado</span>
                      <span className="text-emerald-400 font-bold text-xs">{formatBRL(custo)}</span>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setSelectedListing(l)}
                    className="flex-1 py-2 bg-[#C9A84C] text-[#09081A] rounded-md text-xs font-bold hover:bg-[#D4B96A] transition"
                  >
                    FAZER OFERTA
                  </button>
                  {l.allows_tranching && (
                    <button className="px-3 py-2 border border-[#C9A84C] text-[#C9A84C] rounded-md text-xs font-bold hover:bg-[#C9A84C]/10 transition">
                      TRANCHES
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bid Modal */}
      {selectedListing && (
        <BidModal
          listing={selectedListing}
          onClose={() => setSelectedListing(null)}
          onSuccess={() => { setSelectedListing(null); fetchListings(); }}
        />
      )}
    </div>
  );
}
