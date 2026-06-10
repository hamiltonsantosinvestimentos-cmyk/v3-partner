import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveIntakeSchema } from "@/lib/ma/bp-intake/engine/schema-registry";
import { fetchFxRate } from "@/lib/ma/bp-intake/engine/fx-service";
import { adaptGeneticaBovinaIntake } from "@/lib/ma/bp-intake/engine/adapter";
import type { GeneticaBovinaIntakeData } from "@/lib/ma/bp-intake/engine/adapter";

// Public endpoints — no auth cookie required, guarded by token.
// GET  /api/ma/bp-intake/[token] → returns schema definition + deal metadata (no PII)
// POST /api/ma/bp-intake/[token] → submits intake responses

interface RouteParams { params: Promise<{ token: string }> }

const serviceClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

async function resolveToken(token: string) {
  const sb = serviceClient();
  const { data } = await sb
    .from("ma_deals")
    .select("id, sector, asset_data, title")
    .contains("asset_data", { bp_intake_token: token })
    .single();

  if (!data) return null;

  const assetData = data.asset_data as Record<string, unknown>;
  const expiresAt = assetData.bp_intake_expires_at as string | undefined;
  if (expiresAt && new Date(expiresAt) < new Date()) return null; // expired

  return { deal: data, assetData };
}

// GET — return schema for this token
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  if (!resolved) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  }

  const { deal, assetData } = resolved;
  const subSector = (assetData.sub_sector as string | undefined) ?? undefined;
  const schema = resolveIntakeSchema(deal.sector, subSector);

  // Fetch FX for display (USD fields show BRL equivalent)
  const fx = await fetchFxRate();

  return NextResponse.json({
    schema_id: schema.id,
    schema_label: schema.label,
    deal_ref: (assetData.bp_intake_token as string).slice(0, 8), // no deal ID exposed
    expires_at: assetData.bp_intake_expires_at,
    fx_snapshot: fx,
    schema,
  });
}

// POST — submit intake responses
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const resolved = await resolveToken(token);
  if (!resolved) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  }

  const { deal, assetData } = resolved;

  let body: {
    responses: Record<string, unknown>;
    lgpd_consent: boolean;
    respondent_email?: string;
    respondent_ip?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // LGPD consent is mandatory before storing email/IP
  if (!body.lgpd_consent) {
    return NextResponse.json({ error: "LGPD consent required" }, { status: 422 });
  }

  // Fetch FX for adapter
  const fx = await fetchFxRate();

  // Build projections from intake data
  const subSector = (assetData.sub_sector as string | undefined) ?? undefined;
  const isGeneticaBovina =
    subSector?.toLowerCase().includes("genética") ||
    subSector?.toLowerCase().includes("genetica") ||
    deal.sector?.toLowerCase().includes("agro");

  let projections: Record<string, unknown> | null = null;
  if (isGeneticaBovina) {
    try {
      const intakeData = body.responses as GeneticaBovinaIntakeData;
      projections = adaptGeneticaBovinaIntake(intakeData, fx) as unknown as Record<string, unknown>;
    } catch {
      // non-fatal — save raw responses, projections computed later
    }
  }

  // Build submitter audit metadata from audit_preenchedor section + request headers
  const submitterMetadata = {
    submitted_by_name: String(body.responses.nome_operador ?? ""),
    submitted_by_role: String(body.responses.cargo_operador ?? ""),
    submitted_by_email: String(body.responses.email_operador ?? ""),
    ip_address:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "",
    user_agent: req.headers.get("user-agent") ?? "",
  };

  // email_operador (from audit section) takes precedence over separate respondent_email field
  const primaryEmail =
    submitterMetadata.submitted_by_email || body.respondent_email || "";

  // Persist into asset_data
  const sb = serviceClient();
  const updatedAssetData: Record<string, unknown> = {
    ...(assetData ?? {}),
    intake_responses: { ...body.responses, metadata: submitterMetadata },
    intake_submitted_at: new Date().toISOString(),
    intake_lgpd_consent: true,
    intake_lgpd_consent_at: new Date().toISOString(),
    ...(primaryEmail ? { intake_respondent_email: primaryEmail } : {}),
    ...(body.respondent_ip ? { intake_respondent_ip: body.respondent_ip } : {}),
    fx_snapshot: fx,
    ...(projections ? { financial_projections: projections } : {}),
  };

  const { error } = await sb
    .from("ma_deals")
    .update({ asset_data: updatedAssetData })
    .eq("id", deal.id);

  if (error) {
    return NextResponse.json({ error: "Failed to save responses" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    message: "Dados recebidos. Obrigado!",
    has_projections: projections !== null,
  });
}
