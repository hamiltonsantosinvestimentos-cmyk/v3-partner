import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") return null;
  return { userId: user.id, role: profile.role as string };
}

const TRASH_RETENTION_DAYS = 30;

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN acessa a lixeira" }, { status: 403 });

  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id, asset_type, valor_face, deleted_at, deletion_reason, deleted_by, profiles!deleted_by(full_name)")
    .not("deleted_at", "is", null)
    .gte("deleted_at", cutoff)
    .order("deleted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []).map((item) => {
    const deletedAt = new Date(item.deleted_at as string);
    const daysElapsed = Math.floor((Date.now() - deletedAt.getTime()) / (24 * 60 * 60 * 1000));
    return { ...item, days_remaining: Math.max(0, TRASH_RETENTION_DAYS - daysElapsed) };
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN restaura ativos" }, { status: 403 });

  const { listing_id } = await req.json();
  if (!listing_id) return NextResponse.json({ error: "listing_id obrigatório" }, { status: 422 });

  const { data, error } = await svc()
    .from("cm_asset_listings")
    .update({
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
      deletion_status: "none",
      deletion_requested_by: null,
      deletion_requested_at: null,
    })
    .eq("id", listing_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing: data });
}
