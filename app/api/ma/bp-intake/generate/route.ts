import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

// Authenticated endpoint: Mesa generates a token-based intake link for a deal.
// POST /api/ma/bp-intake/generate
// Body: { deal_id: string; expires_days?: number }
// Response: { token: string; url: string; expires_at: string }

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA"] as const;
const DEFAULT_EXPIRES_DAYS = 30;

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!ALLOWED_ROLES.includes(profile?.role as (typeof ALLOWED_ROLES)[number])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { deal_id?: string; expires_days?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { deal_id, expires_days = DEFAULT_EXPIRES_DAYS } = body;
  if (!deal_id) return NextResponse.json({ error: "deal_id required" }, { status: 422 });

  // Verify deal exists and get current asset_data
  const { data: deal, error: dealErr } = await supabase
    .from("ma_deals")
    .select("id, asset_data")
    .eq("id", deal_id)
    .single();

  if (dealErr || !deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const token = randomBytes(24).toString("hex");
  const expires_at = new Date();
  expires_at.setDate(expires_at.getDate() + expires_days);

  const updatedAssetData = {
    ...(deal.asset_data as Record<string, unknown> ?? {}),
    bp_intake_token: token,
    bp_intake_expires_at: expires_at.toISOString(),
    bp_intake_generated_by: user.id,
    bp_intake_generated_at: new Date().toISOString(),
  };

  const { error: updateErr } = await supabase
    .from("ma_deals")
    .update({ asset_data: updatedAssetData })
    .eq("id", deal_id);

  if (updateErr) {
    return NextResponse.json({ error: "Failed to save token" }, { status: 500 });
  }

  const host = req.headers.get("host") ?? "app.v3partners.com.br";
  const protocol = host.includes("localhost") ? "http" : "https";
  const url = `${protocol}://${host}/intake/bp/${token}`;

  return NextResponse.json({ token, url, expires_at: expires_at.toISOString() });
}
