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

// Benchmark keys consumed by adaptGeneticaBovinaIntake() — sourced from market_benchmarks,
// never hardcoded in the adapter's business logic.
const AGRO_BENCHMARK_KEYS = [
  "crescimento_mercado_pct_aa",
  "crescimento_estabilizado_pct",
  "crescimento_pessimista_pct",
  "hedge_custo_ndf_pct",
  "hedge_custo_opcao_pct",
  "preco_arroba_boi_gordo_rs",
  "preco_medio_embriao_dom_brl",
  "preco_medio_embriao_exp_usd",
] as const;

async function fetchAgroBenchmarks(
  sb: ReturnType<typeof serviceClient>
): Promise<Record<string, number>> {
  const { data } = await sb
    .from("market_benchmarks")
    .select("benchmark_key, value_numeric")
    .eq("sector", "agronegocio")
    .eq("sub_sector", "genetica_bovina")
    .in("benchmark_key", AGRO_BENCHMARK_KEYS)
    .is("valid_until", null);

  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    if (row.value_numeric !== null) map[row.benchmark_key] = row.value_numeric;
  }
  return map;
}

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

  // Market benchmarks — used by the form to show reference values (e.g. CAGR placeholder, BGI price)
  const isGeneticaBovina =
    subSector?.toLowerCase().includes("genética") ||
    subSector?.toLowerCase().includes("genetica") ||
    deal.sector?.toLowerCase().includes("agro");
  const market_benchmarks = isGeneticaBovina
    ? await fetchAgroBenchmarks(serviceClient())
    : {};

  return NextResponse.json({
    schema_id: schema.id,
    schema_label: schema.label,
    deal_ref: (assetData.bp_intake_token as string).slice(0, 8), // no deal ID exposed
    expires_at: assetData.bp_intake_expires_at,
    fx_snapshot: fx,
    market_benchmarks,
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

  const sb = serviceClient();

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
      // market_benchmarks is the single source of truth for these fields —
      // never accepted from the public form (body.responses).
      const benchmarks = await fetchAgroBenchmarks(sb);
      const intakeData: GeneticaBovinaIntakeData = {
        ...(body.responses as GeneticaBovinaIntakeData),
        crescimento_mercado_pct_aa:
          (body.responses.crescimento_mercado_pct_aa as number | undefined) ??
          benchmarks.crescimento_mercado_pct_aa,
        benchmark_crescimento_estabilizado_pct: benchmarks.crescimento_estabilizado_pct,
        benchmark_crescimento_pessimista_pct: benchmarks.crescimento_pessimista_pct,
        benchmark_hedge_custo_ndf_pct: benchmarks.hedge_custo_ndf_pct,
        benchmark_hedge_custo_opcao_pct: benchmarks.hedge_custo_opcao_pct,
        benchmark_preco_arroba_boi_gordo_rs: benchmarks.preco_arroba_boi_gordo_rs,
        benchmark_preco_medio_embriao_dom_brl: benchmarks.preco_medio_embriao_dom_brl,
        benchmark_preco_medio_embriao_exp_usd: benchmarks.preco_medio_embriao_exp_usd,
      };
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
