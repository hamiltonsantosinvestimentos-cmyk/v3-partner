import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { BUSINESS_PLAN_GENERATE_ROLES } from "@/lib/ma/business-plan-roles";
import { getSchemaDefinition, resolveSchemaForSector } from "@/lib/ma/business-plan-schemas/registry";
import { generateBusinessPlan, BusinessPlanGenerationError } from "@/lib/ma/business-plan-engine/generate";
import { enrichREProjections } from "@/lib/ma/business-plan-engine/enrich";

export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();
  if (!BUSINESS_PLAN_GENERATE_ROLES.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode"); // "model3s" = análise 3-Statement sem persistência
  const body = (await req.json().catch(() => ({}))) as { force_regenerate?: boolean };
  const forceRegenerate = body.force_regenerate === true || mode === "model3s";

  const { data: deal, error } = await svc()
    .from("ma_deals")
    .select("id, code, sector, asset_data")
    .eq("id", id)
    .single();
  if (error || !deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const schemaId = resolveSchemaForSector(deal.sector ?? null);
  if (!schemaId) {
    return NextResponse.json(
      { error: "sector_not_supported", sector: deal.sector },
      { status: 400 }
    );
  }

  const schema = getSchemaDefinition(schemaId);
  if (!schema) {
    return NextResponse.json(
      { error: "sector_not_supported", sector: deal.sector, schema_id: schemaId },
      { status: 400 }
    );
  }

  const assetData = (deal.asset_data ?? {}) as Record<string, unknown>;
  const financialProjections = assetData.financial_projections as Record<string, unknown> | undefined;

  const validation = schema.validate(financialProjections);
  if (!validation.valid || !validation.data) {
    return NextResponse.json(
      {
        error: "incomplete_financial_data",
        missing_fields: validation.missingFields ?? [],
        action_required: "Complete os dados financeiros do ativo antes de gerar o business plan.",
      },
      { status: 422 }
    );
  }

  const existingPlan = assetData.business_plan as Record<string, unknown> | undefined;
  if (existingPlan && !forceRegenerate) {
    return NextResponse.json({
      success: true,
      cached: true,
      deal_id: deal.id,
      schema_id: schemaId,
      business_plan: existingPlan,
    });
  }

  const generatedBy = profile?.full_name ?? profile?.email ?? user.id;

  // No modo 3-Statement: enriquecer o payload com DRE/DFC/Indicadores derivados
  const projectionsForEngine =
    mode === "model3s"
      ? (enrichREProjections(validation.data as unknown as Parameters<typeof enrichREProjections>[0]) as unknown as Record<string, unknown>)
      : (validation.data as unknown as Record<string, unknown>);

  let plan;
  try {
    plan = await generateBusinessPlan({
      sector: deal.sector ?? "",
      schemaId,
      dealReference: deal.code ?? deal.id,
      financialProjections: projectionsForEngine,
      generatedBy,
    });
  } catch (err) {
    if (err instanceof BusinessPlanGenerationError) {
      const status = err.code === "claim_trace_mismatch" ? 500 : 500;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }

  // Modo 3-Statement: retornar análise sem persistir (exercício de modelagem)
  if (mode === "model3s") {
    const cachedPlan = assetData.business_plan as { claim_trace?: unknown[] } | undefined;
    return NextResponse.json({
      success: true,
      cached: false,
      enriched: true,
      deal_id: deal.id,
      schema_id: schemaId,
      business_plan: plan,
      comparison: {
        original_sections: cachedPlan
          ? (cachedPlan as { narrative_sections?: unknown[] }).narrative_sections?.length ?? 0
          : 0,
        enriched_sections: plan.narrative_sections.length,
        original_claims: cachedPlan?.claim_trace?.length ?? 0,
        enriched_claims: plan.claim_trace.length,
      },
    });
  }

  const newAssetData = { ...assetData, business_plan: plan };
  const { error: updateError } = await svc()
    .from("ma_deals")
    .update({ asset_data: newAssetData, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    cached: false,
    deal_id: deal.id,
    schema_id: schemaId,
    business_plan: plan,
  });
}
