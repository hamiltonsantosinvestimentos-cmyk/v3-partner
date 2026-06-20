import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

async function getCallerRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ADMIN_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listing_id");
  const status = searchParams.get("status");

  let query = svc()
    .from("cm_escrow_operations")
    .select("*, cm_asset_listings:listing_id(anonymous_id, valor_face)")
    .order("created_at", { ascending: false });

  if (listingId) query = query.eq("listing_id", listingId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ escrow_operations: data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { listing_id, bid_id, escrow_provider, escrow_value, contract_url } = body;

  if (!listing_id || !escrow_value) {
    return NextResponse.json({ error: "Campos obrigatórios: listing_id, escrow_value" }, { status: 422 });
  }

  const { data: escrow, error } = await svc()
    .from("cm_escrow_operations")
    .insert({
      listing_id,
      bid_id: bid_id ?? null,
      escrow_provider: escrow_provider ?? null,
      escrow_value: Number(escrow_value),
      contract_url: contract_url ?? null,
      status: "aberto",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ escrow }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { escrow_id, action, contract_url } = body;

  if (!escrow_id || !action || !["liberar", "cancelar"].includes(action)) {
    return NextResponse.json({ error: "Campos: escrow_id, action (liberar|cancelar)" }, { status: 422 });
  }

  const updates: Record<string, unknown> = {
    status: action === "liberar" ? "liberado" : "cancelado",
    closed_at: new Date().toISOString(),
  };
  if (contract_url) updates.contract_url = contract_url;

  const { data, error } = await svc()
    .from("cm_escrow_operations")
    .update(updates)
    .eq("id", escrow_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (action === "liberar" && data) {
    await svc().rpc("transition_cm_listing_status", {
      p_listing_id: data.listing_id,
      p_new_status: "liquidado",
      p_reason: "Escrow liberado — operação liquidada",
      p_user_id: caller.userId,
    });
  }

  return NextResponse.json({ escrow: data, message: action === "liberar" ? "Escrow liberado. Ativo liquidado." : "Escrow cancelado." });
}
