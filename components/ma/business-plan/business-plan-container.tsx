"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { EmptyState } from "./empty-state";
import { IncompleteDataState } from "./incomplete-data-state";
import { UnsupportedSectorState } from "./unsupported-sector-state";
import { RealEstatePanel } from "./panels/real-estate-panel";
import { AgronegocionPanel } from "./panels/agronegocio-panel";
import { canGenerateBusinessPlan } from "@/lib/ma/business-plan-roles";
import type { GeneratedPlan } from "@/lib/ma/business-plan-engine/generate";
import type { RealEstateFinancialProjections } from "@/lib/ma/business-plan-schemas/real-estate-v1";
import type { AgronegocioFinancialProjections } from "@/lib/ma/business-plan-schemas/agronegocio-v1";

const C = { nc: "#162744", nm: "#243A66", go: "#C9A84C", mu: "#9BAFC5" };

interface BusinessPlanResponse {
  success: boolean;
  deal_id: string;
  deal_code?: string;
  sector?: string | null;
  schema_id?: string | null;
  sector_supported: boolean;
  has_financial_projections: boolean;
  has_business_plan: boolean;
  business_plan: GeneratedPlan | null;
}

interface GenerateErrorResponse {
  error: string;
  missing_fields?: string[];
}

interface Props {
  dealId: string;
  sector?: string | null;
  dealCode?: string;
  userRole: string;
}

function PanelSkeleton() {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border px-8 py-16" style={{ background: C.nc, borderColor: C.nm }}>
      <Loader2 size={16} className="animate-spin" color={C.go} />
      <span className="text-xs" style={{ color: C.mu }}>Carregando business plan...</span>
    </div>
  );
}

export function BusinessPlanContainer({ dealId, sector, dealCode, userRole }: Props) {
  const [data, setData] = useState<BusinessPlanResponse | null>(null);
  const [missingFields, setMissingFields] = useState<string[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const canGenerate = canGenerateBusinessPlan(userRole);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/ma/business-plan/${dealId}`, { signal: controller.signal });
        const json = (await res.json()) as BusinessPlanResponse;
        if (controller.signal.aborted) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        setData(json);
        setMissingFields(null);
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    })();
    return () => controller.abort();
  }, [dealId, refreshKey]);

  const fetchPlan = useCallback(() => setRefreshKey((k) => k + 1), []);

  async function handleRegenerate() {
    const res = await fetch(`/api/ma/business-plan/${dealId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force_regenerate: true }),
    });
    const json = (await res.json()) as GenerateErrorResponse | { success: true };
    if (!res.ok && "error" in json) {
      if (json.error === "incomplete_financial_data" && json.missing_fields) {
        setMissingFields(json.missing_fields);
      }
      return;
    }
    await fetchPlan();
  }

  if (status === "loading") return <PanelSkeleton />;
  if (status === "error") {
    return (
      <div className="rounded-2xl border px-8 py-10 text-center text-xs" style={{ background: C.nc, borderColor: C.nm, color: C.mu }}>
        Não foi possível carregar o business plan deste deal. Tente novamente.
      </div>
    );
  }
  if (!data) return null;

  if (!data.sector_supported) {
    return <UnsupportedSectorState sector={data.sector ?? sector} />;
  }

  if (missingFields) {
    return <IncompleteDataState fields={missingFields} dealId={dealId} />;
  }

  if (!data.has_business_plan || !data.business_plan) {
    return <EmptyState dealId={dealId} canGenerate={canGenerate} onGenerated={fetchPlan} />;
  }

  if (data.schema_id === "real-estate-v1") {
    return (
      <RealEstatePanelLoader
        plan={data.business_plan as GeneratedPlan}
        dealId={dealId}
        dealCode={data.deal_code ?? dealCode}
        canGenerate={canGenerate}
        onRegenerate={handleRegenerate}
      />
    );
  }

  if (data.schema_id === "agronegocio-v1") {
    return (
      <AgronegocionPanelLoader
        plan={data.business_plan as GeneratedPlan}
        dealId={dealId}
        dealCode={data.deal_code ?? dealCode}
        canGenerate={canGenerate}
        onRegenerate={handleRegenerate}
      />
    );
  }

  return <UnsupportedSectorState sector={data.sector ?? sector} />;
}

/**
 * Carrega financial_projections (fonte real dos números) para alimentar o
 * painel — o claim_trace audita contra esses dados, nunca contra o texto gerado.
 */
function RealEstatePanelLoader({
  plan,
  dealId,
  dealCode,
  canGenerate,
  onRegenerate,
}: {
  plan: GeneratedPlan;
  dealId: string;
  dealCode?: string;
  canGenerate: boolean;
  onRegenerate: () => Promise<void>;
}) {
  const [projections, setProjections] = useState<RealEstateFinancialProjections | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/ma/projections/${dealId}`);
      const json = await res.json();
      if (!cancelled) {
        setProjections((json.projections ?? null) as RealEstateFinancialProjections | null);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) return <PanelSkeleton />;
  if (!projections) {
    return (
      <div className="rounded-2xl border px-8 py-10 text-center text-xs" style={{ background: C.nc, borderColor: C.nm, color: C.mu }}>
        Dados financeiros não encontrados para auditoria do plano.
      </div>
    );
  }

  return (
    <RealEstatePanel
      plan={plan}
      dealId={dealId}
      dealCode={dealCode}
      financialProjections={projections}
      canGenerate={canGenerate}
      onRegenerate={onRegenerate}
    />
  );
}

function AgronegocionPanelLoader({
  plan,
  dealId,
  dealCode,
  canGenerate,
  onRegenerate,
}: {
  plan: GeneratedPlan;
  dealId: string;
  dealCode?: string;
  canGenerate: boolean;
  onRegenerate: () => Promise<void>;
}) {
  const [projections, setProjections] = useState<AgronegocioFinancialProjections | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch(`/api/ma/projections/${dealId}`);
      const json = await res.json();
      if (!cancelled) {
        setProjections((json.projections ?? null) as AgronegocioFinancialProjections | null);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) return <PanelSkeleton />;
  if (!projections) {
    return (
      <div className="rounded-2xl border px-8 py-10 text-center text-xs" style={{ background: C.nc, borderColor: C.nm, color: C.mu }}>
        Dados financeiros não encontrados para auditoria do plano.
      </div>
    );
  }

  return (
    <AgronegocionPanel
      plan={plan}
      dealId={dealId}
      dealCode={dealCode}
      financialProjections={projections}
      canGenerate={canGenerate}
      onRegenerate={onRegenerate}
    />
  );
}
