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

  let query = svc()
    .from("cm_tranches")
    .select("*, cm_asset_listings:parent_listing_id(anonymous_id, valor_face)")
    .order("created_at", { ascending: true });

  if (listingId) query = query.eq("parent_listing_id", listingId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tranches: data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado — apenas ADMIN/GESTAO" }, { status: 401 });

  const body = await req.json();
  const { listing_id, num_tranches, values } = body;

  if (!listing_id) {
    return NextResponse.json({ error: "Campo obrigatório: listing_id" }, { status: 422 });
  }

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id, valor_face, allows_tranching")
    .eq("id", listing_id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });
  if (!listing.allows_tranching) {
    return NextResponse.json({ error: "Este ativo não permite fatiamento (allows_tranching = false)" }, { status: 422 });
  }

  const valorFace = Number(listing.valor_face);
  let trancheValues: number[] = [];

  if (values && Array.isArray(values)) {
    trancheValues = values.map(Number);
  } else if (num_tranches && num_tranches > 0) {
    const perTranche = Math.floor(valorFace / num_tranches);
    const remainder = valorFace - perTranche * num_tranches;
    trancheValues = Array(num_tranches).fill(perTranche);
    trancheValues[0] += remainder;
  } else {
    return NextResponse.json({ error: "Informe num_tranches OU values[]" }, { status: 422 });
  }

  const totalTranches = trancheValues.reduce((s, v) => s + v, 0);
  if (totalTranches > valorFace) {
    return NextResponse.json({
      error: `Soma dos tranches (R$ ${totalTranches.toLocaleString("pt-BR")}) excede valor de face (R$ ${valorFace.toLocaleString("pt-BR")})`,
    }, { status: 422 });
  }

  const inserts = trancheValues.map((val, i) => ({
    parent_listing_id: listing_id,
    tranche_code: `${listing.anonymous_id}-T${String(i + 1).padStart(2, "0")}`,
    tranche_value: val,
    percentage: Number(((val / valorFace) * 100).toFixed(2)),
    status: "disponivel",
  }));

  const { data: tranches, error } = await svc()
    .from("cm_tranches")
    .insert(inserts)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tranches, total_value: totalTranches, parent_value: valorFace }, { status: 201 });
}
