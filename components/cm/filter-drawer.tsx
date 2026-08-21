"use client";

// Busca fuzzy + drawer de filtros facetados da Mesa de Capitais (21/08/2026).
// Os campos aqui batem 1:1 com o schema real de cm_asset_listings (asset_type,
// esfera, tribunal, valor_face, desagio_pretendido, listing_status) -- nao existe
// campo "Advogado" na tabela, entao esse facet foi deixado de fora deliberadamente
// (ver BRIEF da Etapa 6, secao "Alternativa descartada").

import { useEffect, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CmListingFilters {
  search: string;
  assetTypes: string[];
  esferas: string[];
  statuses: string[];
  valorFaceBuckets: string[];
  desagioMin: string;
  desagioMax: string;
  tribunais: string[];
}

export const EMPTY_CM_FILTERS: CmListingFilters = {
  search: "",
  assetTypes: [],
  esferas: [],
  statuses: [],
  valorFaceBuckets: [],
  desagioMin: "",
  desagioMax: "",
  tribunais: [],
};

export function isCmFiltersEmpty(f: CmListingFilters): boolean {
  return (
    f.search.trim() === "" &&
    f.assetTypes.length === 0 &&
    f.esferas.length === 0 &&
    f.statuses.length === 0 &&
    f.valorFaceBuckets.length === 0 &&
    f.desagioMin === "" &&
    f.desagioMax === "" &&
    f.tribunais.length === 0
  );
}

export const CM_ASSET_TYPE_LABELS: Record<string, string> = {
  precatorio: "Precatório",
  direito_creditorio: "Direito Creditório",
  cgi: "CGI",
  cri: "CRI",
  fidc: "FIDC",
  ipi: "IPI",
  icms: "ICMS",
  imovel: "Imóvel",
  outros: "Outros",
};

export const CM_ESFERA_LABELS: Record<string, string> = {
  federal: "Federal",
  estadual: "Estadual",
  municipal: "Municipal",
};

export const CM_STATUS_LABELS: Record<string, string> = {
  reuniao_validada: "Reunião Validada",
  formulario_preenchido: "Formulário Preenchido",
  nda_assinado: "NDA Assinado",
  em_analise: "Em Análise",
  aprovado_head: "Aprovado pela Diretoria",
  ativo_vitrine: "Ativo na Vitrine",
  proposta_recebida: "Proposta Recebida",
  em_escrow_due_diligence: "Escrow / Due Diligence",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

export const CM_VALOR_FACE_BUCKETS: { key: string; label: string; test: (v: number) => boolean }[] = [
  { key: "ate1m", label: "Até R$ 1M", test: (v) => v <= 1_000_000 },
  { key: "1a10m", label: "R$ 1M – 10M", test: (v) => v > 1_000_000 && v <= 10_000_000 },
  { key: "10a50m", label: "R$ 10M – 50M", test: (v) => v > 10_000_000 && v <= 50_000_000 },
  { key: "acima50m", label: "R$ 50M+", test: (v) => v > 50_000_000 },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function activeFilterCount(f: CmListingFilters): number {
  return (
    f.assetTypes.length +
    f.esferas.length +
    f.statuses.length +
    f.valorFaceBuckets.length +
    f.tribunais.length +
    (f.desagioMin !== "" ? 1 : 0) +
    (f.desagioMax !== "" ? 1 : 0)
  );
}

function FacetGroup({
  title, options, selected, onToggle,
}: {
  title: string;
  options: { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div className="mb-5">
      <div className="text-[9px] font-bold uppercase tracking-wider text-[#C9A84C] mb-2">{title}</div>
      <div className="flex flex-col gap-1.5">
        {options.map((o) => (
          <label
            key={o.key}
            className="flex items-center gap-2 min-h-[40px] sm:min-h-0 px-1 py-1.5 rounded cursor-pointer hover:bg-[#F5F1E8]/5 transition"
          >
            <input
              type="checkbox"
              checked={selected.includes(o.key)}
              onChange={() => onToggle(o.key)}
              className="w-4 h-4 accent-[#C9A84C]"
            />
            <span className="text-xs text-[#F5F1E8]">{o.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function CmSearchFilterBar({
  filters, onChange, availableTribunals,
}: {
  filters: CmListingFilters;
  onChange: (f: CmListingFilters) => void;
  availableTribunals: string[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Rascunho local: so aplica no banco de filtros ativo quando "Aplicar Filtros" e clicado,
  // pedido explicito do BRIEF (botoes Aplicar/Limpar). A busca por texto continua instantanea
  // (nao passa pelo rascunho), so os facets do drawer sao represados ate o Aplicar.
  const [draft, setDraft] = useState<CmListingFilters>(filters);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (drawerOpen) setDraft(filters); }, [drawerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = activeFilterCount(filters);

  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="relative flex-1 max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BAFC5]" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Buscar por processo, titular, código do deal ou partner..."
          className="w-full min-h-[44px] sm:min-h-0 sm:h-9 pl-9 pr-3 bg-[#12112A] border border-[#9BAFC5]/15 rounded-lg text-xs text-[#F5F1E8] placeholder:text-[#9BAFC5]/60 focus:outline-none focus:border-[#C9A84C]/40"
        />
      </div>

      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className={cn(
          "relative flex items-center gap-1.5 min-h-[44px] sm:min-h-0 sm:h-9 px-3.5 rounded-lg border text-xs font-bold transition",
          count > 0
            ? "bg-[#C9A84C]/10 border-[#C9A84C]/40 text-[#C9A84C]"
            : "bg-[#12112A] border-[#9BAFC5]/15 text-[#9BAFC5] hover:text-[#F5F1E8]"
        )}
      >
        <SlidersHorizontal size={13} />
        Filtros
        {count > 0 && (
          <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#C9A84C] text-[#09081A] text-[9px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {drawerOpen && (
        <div className="fixed inset-0 z-[120] flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDrawerOpen(false)} />
          <div
            ref={drawerRef}
            className="relative w-full max-w-xs sm:max-w-sm h-full bg-[#0D0C22] border-l border-[#C9A84C]/20 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-[#9BAFC5]/10 flex-shrink-0">
              <div className="text-sm font-bold text-[#F5F1E8]">Filtros</div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full text-[#9BAFC5] hover:text-[#F5F1E8] hover:bg-[#F5F1E8]/10 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <FacetGroup
                title="Tipo de Ativo"
                options={Object.entries(CM_ASSET_TYPE_LABELS).map(([key, label]) => ({ key, label }))}
                selected={draft.assetTypes}
                onToggle={(key) => setDraft((d) => ({ ...d, assetTypes: toggle(d.assetTypes, key) }))}
              />
              <FacetGroup
                title="Esfera"
                options={Object.entries(CM_ESFERA_LABELS).map(([key, label]) => ({ key, label }))}
                selected={draft.esferas}
                onToggle={(key) => setDraft((d) => ({ ...d, esferas: toggle(d.esferas, key) }))}
              />
              <FacetGroup
                title="Valor de Face"
                options={CM_VALOR_FACE_BUCKETS.map((b) => ({ key: b.key, label: b.label }))}
                selected={draft.valorFaceBuckets}
                onToggle={(key) => setDraft((d) => ({ ...d, valorFaceBuckets: toggle(d.valorFaceBuckets, key) }))}
              />

              <div className="mb-5">
                <div className="text-[9px] font-bold uppercase tracking-wider text-[#C9A84C] mb-2">Deságio (%)</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text" inputMode="decimal" placeholder="Mín"
                    value={draft.desagioMin}
                    onChange={(e) => setDraft((d) => ({ ...d, desagioMin: e.target.value.replace(/[^0-9.,]/g, "") }))}
                    className="w-full min-h-[40px] sm:min-h-0 sm:h-8 px-2 bg-[#12112A] border border-[#9BAFC5]/15 rounded text-xs text-[#F5F1E8] focus:outline-none focus:border-[#C9A84C]/40"
                  />
                  <span className="text-[#9BAFC5] text-xs">–</span>
                  <input
                    type="text" inputMode="decimal" placeholder="Máx"
                    value={draft.desagioMax}
                    onChange={(e) => setDraft((d) => ({ ...d, desagioMax: e.target.value.replace(/[^0-9.,]/g, "") }))}
                    className="w-full min-h-[40px] sm:min-h-0 sm:h-8 px-2 bg-[#12112A] border border-[#9BAFC5]/15 rounded text-xs text-[#F5F1E8] focus:outline-none focus:border-[#C9A84C]/40"
                  />
                </div>
              </div>

              <FacetGroup
                title="Status na Esteira"
                options={Object.entries(CM_STATUS_LABELS).map(([key, label]) => ({ key, label }))}
                selected={draft.statuses}
                onToggle={(key) => setDraft((d) => ({ ...d, statuses: toggle(d.statuses, key) }))}
              />

              {availableTribunals.length > 0 && (
                <FacetGroup
                  title="Tribunal / Jurisdição"
                  options={availableTribunals.map((t) => ({ key: t, label: t }))}
                  selected={draft.tribunais}
                  onToggle={(key) => setDraft((d) => ({ ...d, tribunais: toggle(d.tribunais, key) }))}
                />
              )}
            </div>

            <div className="flex gap-2 p-4 border-t border-[#9BAFC5]/10 flex-shrink-0">
              <button
                type="button"
                onClick={() => { setDraft(EMPTY_CM_FILTERS); onChange({ ...EMPTY_CM_FILTERS, search: filters.search }); }}
                className="flex-1 min-h-[44px] sm:min-h-0 sm:h-9 rounded-lg border border-[#9BAFC5]/20 text-xs font-bold text-[#9BAFC5] hover:text-[#F5F1E8] transition"
              >
                Limpar Filtros
              </button>
              <button
                type="button"
                onClick={() => { onChange(draft); setDrawerOpen(false); }}
                className="flex-1 min-h-[44px] sm:min-h-0 sm:h-9 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold hover:bg-[#D4B96A] transition"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
