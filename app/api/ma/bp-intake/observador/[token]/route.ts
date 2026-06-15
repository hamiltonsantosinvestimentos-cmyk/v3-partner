import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveIntakeSchema } from "@/lib/ma/bp-intake/engine/schema-registry";

// Public endpoint — no auth cookie required, guarded by bp_observer_token.
// GET /api/ma/bp-intake/observador/[token]
//
// Acesso de leitura ("Observador Ilimitado") aos dados já submetidos via
// bp-intake. Token separado do token de preenchimento (bp_intake_token).
// Gate: só retorna dados quando ma_deals.contract_status === 'SIGNED'.
// Antes da assinatura, retorna locked:true com mensagem institucional.

interface RouteParams { params: Promise<{ token: string }> }

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const sb = serviceClient();

  const { data: deal } = await sb
    .from("ma_deals")
    .select("id, title, sector, contract_status, asset_data")
    .contains("asset_data", { bp_observer_token: token })
    .single();

  if (!deal) {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }

  if (deal.contract_status !== "SIGNED") {
    return NextResponse.json({
      locked: true,
      message:
        "Acesso de observador será liberado após a formalização do contrato com a V3 Partners.",
    });
  }

  const assetData = deal.asset_data as Record<string, unknown>;
  const subSector = (assetData.sub_sector as string | undefined) ?? undefined;
  const schema = resolveIntakeSchema(deal.sector, subSector);

  return NextResponse.json({
    locked: false,
    deal_title: deal.title,
    schema_label: schema.label,
    schema,
    intake_responses: assetData.intake_responses ?? null,
    financial_projections: assetData.financial_projections ?? null,
    submitted_at: assetData.intake_submitted_at ?? null,
  });
}
