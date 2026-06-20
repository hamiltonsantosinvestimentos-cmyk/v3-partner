import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCallerRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listing_id");
  const status = searchParams.get("status");

  let query = svc()
    .from("cm_bids")
    .select("*, cm_asset_listings(anonymous_id, asset_type, valor_face, listing_status)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (listingId) query = query.eq("listing_id", listingId);
  if (status) query = query.eq("status", status);

  if (!["ADMIN", "GESTAO"].includes(caller.role)) {
    query = query.eq("created_by", caller.userId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bids: data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { listing_id, bid_value, desagio_oferecido, tir_pretendida, payment_type, payment_details, notes, buyer_profile_id } = body;

  if (!listing_id || !bid_value) {
    return NextResponse.json({ error: "Campos obrigatórios: listing_id, bid_value" }, { status: 422 });
  }

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, listing_status, valor_face")
    .eq("id", listing_id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

  if (!["ativo_vitrine", "proposta_recebida"].includes(listing.listing_status)) {
    return NextResponse.json({ error: "Listing não está disponível para propostas" }, { status: 422 });
  }

  const { data: bid, error } = await svc()
    .from("cm_bids")
    .insert({
      listing_id,
      buyer_profile_id: buyer_profile_id ?? null,
      bid_value: Number(bid_value),
      desagio_oferecido: desagio_oferecido ? Number(desagio_oferecido) : null,
      tir_pretendida: tir_pretendida ? Number(tir_pretendida) : null,
      payment_type: payment_type ?? "a_vista",
      payment_details: payment_details ?? {},
      notes: notes ?? null,
      created_by: caller.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (listing.listing_status === "ativo_vitrine") {
    await svc().rpc("transition_cm_listing_status", {
      p_listing_id: listing_id,
      p_new_status: "proposta_recebida",
      p_reason: `Bid recebido: R$ ${Number(bid_value).toLocaleString("pt-BR")}`,
      p_user_id: caller.userId,
    });
  }

  return NextResponse.json({ bid }, { status: 201 });
}
