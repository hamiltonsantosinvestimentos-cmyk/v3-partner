import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { BUSINESS_PLAN_VIEW_ROLES } from "@/lib/ma/business-plan-roles";
import { resolveSchemaForSector } from "@/lib/ma/business-plan-schemas/registry";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!BUSINESS_PLAN_VIEW_ROLES.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: deal, error } = await svc()
    .from("ma_deals")
    .select("id, code, sector, asset_data")
    .eq("id", id)
    .single();
  if (error || !deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });

  const assetData = (deal.asset_data ?? {}) as Record<string, unknown>;
  const schemaId = resolveSchemaForSector(deal.sector ?? null);
  const businessPlan = (assetData.business_plan as Record<string, unknown> | undefined) ?? null;
  const projections = (assetData.financial_projections as Record<string, unknown> | undefined) ?? null;

  return NextResponse.json({
    success: true,
    deal_id: deal.id,
    deal_code: deal.code,
    sector: deal.sector,
    schema_id: schemaId,
    sector_supported: schemaId !== null,
    has_financial_projections: projections !== null,
    has_business_plan: businessPlan !== null,
    business_plan: businessPlan,
  });
}
