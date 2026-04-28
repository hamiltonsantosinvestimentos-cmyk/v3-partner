"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Search, Briefcase, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PortfolioLinha {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  publico_alvo: string | null;
  prazo_pagamento: string | null;
  taxas: string | null;
  outras_despesas: string | null;
  limite_credito: string | null;
  comprometimento_renda: string | null;
  aporte: string | null;
  amortizacao: string | null;
  perfil_garantia: string | null;
  destinacao: string | null;
  tempo_estruturacao: string | null;
  custo_estruturacao: string | null;
  diferenciais: string | null;
  ativo: boolean;
  ordem: number;
}

const CAT_COLORS: Record<string, string> = {
  "Imobiliário":    "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Auto":           "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Capital de Giro":"bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Consórcio":      "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Construção":     "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Agro":           "bg-lime-500/20 text-lime-400 border-lime-500/30",
  "Internacional":  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "Seguros":        "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "M&A":            "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

const FIELDS: { key: keyof PortfolioLinha; label: string }[] = [
  { key: "publico_alvo",        label: "Público-Alvo" },
  { key: "prazo_pagamento",     label: "Prazo de Pagamento" },
  { key: "taxas",               label: "Taxas" },
  { key: "outras_despesas",     label: "Outras Despesas" },
  { key: "limite_credito",      label: "Limite de Crédito" },
  { key: "comprometimento_renda", label: "Comprometimento de Renda" },
  { key: "aporte",              label: "Aporte" },
  { key: "amortizacao",         label: "Amortização" },
  { key: "perfil_garantia",     label: "Perfil da Garantia" },
  { key: "destinacao",          label: "Destinação" },
  { key: "tempo_estruturacao",  label: "Tempo de Estruturação" },
  { key: "custo_estruturacao",  label: "Custo de Estruturação" },
  { key: "diferenciais",        label: "Diferenciais" },
];

function LinhaCard({ linha }: { linha: PortfolioLinha }) {
  const [open, setOpen] = useState(false);
  const catCls = CAT_COLORS[linha.categoria ?? ""] ?? "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30";

  return (
    <div className={cn(
      "rounded-2xl border transition-all duration-200 overflow-hidden",
      open ? "border-[#C9A84C]/30 bg-[#0C1929]" : "border-[#1B3050] bg-[#0A1628] hover:border-[#243A66]"
    )}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-4 p-5 text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/15 border border-[#C9A84C]/25 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Briefcase className="w-4 h-4 text-[#C9A84C]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-bold text-white">{linha.nome}</p>
            {linha.categoria && (
              <span className={cn("text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wide", catCls)}>
                {linha.categoria}
              </span>
            )}
          </div>
          {linha.descricao && (
            <p className={cn("text-xs text-muted-foreground leading-relaxed line-clamp-2 transition-all", open && "line-clamp-none")}>
              {linha.descricao}
            </p>
          )}
          {/* Preview chips */}
          {!open && (
            <div className="flex flex-wrap gap-2 mt-2">
              {linha.taxas && (
                <span className="text-[10px] bg-[#162744] border border-[#243A66] rounded-lg px-2 py-0.5 text-muted-foreground">
                  <strong className="text-[#C9A84C]">Taxa:</strong> {linha.taxas}
                </span>
              )}
              {linha.aporte && (
                <span className="text-[10px] bg-[#162744] border border-[#243A66] rounded-lg px-2 py-0.5 text-muted-foreground">
                  <strong className="text-[#C9A84C]">Aporte:</strong> {linha.aporte}
                </span>
              )}
              {linha.prazo_pagamento && (
                <span className="text-[10px] bg-[#162744] border border-[#243A66] rounded-lg px-2 py-0.5 text-muted-foreground">
                  <strong className="text-[#C9A84C]">Prazo:</strong> {linha.prazo_pagamento}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-muted-foreground mt-1">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-5 pb-5 border-t border-[#1B3050]">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-0 mt-4">
            {FIELDS.map(({ key, label }) => {
              const val = linha[key] as string | null;
              if (!val) return null;
              return (
                <div key={key} className="py-2.5 border-b border-[#1B3050]/50 last:border-0">
                  <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-xs text-[#F0ECE4] leading-relaxed">{val}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function PortfolioViewer() {
  const [linhas, setLinhas] = useState<PortfolioLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("Todos");

  useEffect(() => {
    fetch("/api/portfolio")
      .then(r => r.json())
      .then(d => setLinhas(d.linhas ?? []))
      .finally(() => setLoading(false));
  }, []);

  const categorias = ["Todos", ...Array.from(new Set(linhas.map(l => l.categoria).filter(Boolean) as string[]))];

  const filtered = linhas.filter(l => {
    const matchCat = catFilter === "Todos" || l.categoria === catFilter;
    const matchSearch = !search || l.nome.toLowerCase().includes(search.toLowerCase()) || (l.descricao ?? "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Carregando portfólio…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar produto…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-[#243A66] bg-[#111F35] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A84C]/50"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all",
                catFilter === cat
                  ? "bg-[#C9A84C] text-[#09081A] border-[#C9A84C]"
                  : "bg-[#111F35] text-muted-foreground border-[#243A66] hover:border-[#C9A84C]/40"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {filtered.length} produto{filtered.length !== 1 ? "s" : ""} — PORTFÓLIO V3 PARTNERS 2026
      </p>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
          <Briefcase className="w-8 h-8 opacity-20" />
          <p className="text-sm">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(l => <LinhaCard key={l.id} linha={l} />)}
        </div>
      )}
    </div>
  );
}
