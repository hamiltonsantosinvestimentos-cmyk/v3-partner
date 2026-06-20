import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO"];

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return user.id;
}

export async function POST(req: NextRequest) {
  const userId = await getCaller(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { listing_id, buyer_name, buyer_email, buyer_company, expires_days } = await req.json();
  if (!listing_id) return NextResponse.json({ error: "listing_id obrigatório" }, { status: 422 });

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id, deal_room_enabled")
    .eq("id", listing_id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

  if (!listing.deal_room_enabled) {
    await svc().from("cm_asset_listings").update({ deal_room_enabled: true }).eq("id", listing_id);
  }

  const token = randomUUID().replace(/-/g, "");
  const expiresAt = expires_days
    ? new Date(Date.now() + expires_days * 86400000).toISOString()
    : null;

  const { data: access, error } = await svc()
    .from("cm_deal_room_access")
    .insert({
      listing_id,
      access_token: token,
      buyer_name: buyer_name ?? null,
      buyer_email: buyer_email ?? null,
      buyer_company: buyer_company ?? null,
      expires_at: expiresAt,
      created_by: userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const host = req.headers.get("host") ?? "app.v3partners.com.br";
  const protocol = host.includes("localhost") ? "http" : "https";
  const url = `${protocol}://${host}/vdr/cm/${listing.anonymous_id}/${token}`;

  return NextResponse.json({ access, url }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const userId = await getCaller(req);
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const listingId = new URL(req.url).searchParams.get("listing_id");
  if (!listingId) return NextResponse.json({ error: "listing_id obrigatório" }, { status: 422 });

  const { data, error } = await svc()
    .from("cm_deal_room_access")
    .select("*")
    .eq("listing_id", listingId)
    .eq("revoked", false)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invites: data ?? [] });
}
