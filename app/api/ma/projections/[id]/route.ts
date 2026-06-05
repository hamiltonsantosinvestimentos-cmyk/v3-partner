import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
const VIEW_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const EDIT_ROLES = ["ADMIN", "GESTAO"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!VIEW_ROLES.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data: deal, error } = await svc().from("ma_deals").select("id, sector, asset_data").eq("id", id).single();
  if (error || !deal) return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  const projections = (deal.asset_data as Record<string, unknown>)?.financial_projections ?? null;
  return NextResponse.json({ success: true, deal_id: deal.id, sector: deal.sector, has_structured_data: projections !== null, projections });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await svc().from("profiles").select("role, full_name, email").eq("id", user.id).single();
  if (!EDIT_ROLES.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const projections = { ...body.projections, meta: { last_updated: new Date().toISOString(), updated_by: profile?.full_name ?? profile?.email ?? user.id } };
  const { data: deal } = await svc().from("ma_deals").select("asset_data").eq("id", id).single();
  const newAssetData = { ...((deal?.asset_data ?? {}) as Record<string, unknown>), financial_projections: projections };
  const { error } = await svc().from("ma_deals").update({ asset_data: newAssetData, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, has_structured_data: true, projections });
}