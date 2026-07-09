import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getCaller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

/** GET /api/cm/deal-intermediaries?listing_id=X — lista cadeia de intermediarios do ativo */
export async function GET(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const listingId = new URL(req.url).searchParams.get("listing_id");
  if (!listingId) return NextResponse.json({ error: "listing_id obrigatório" }, { status: 422 });

  const { data, error } = await svc()
    .from("cm_deal_intermediaries")
    .select("*, profiles!cm_deal_intermediaries_mandatario_partner_id_fkey(full_name, email)")
    .eq("listing_id", listingId)
    .order("side")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ intermediaries: data ?? [] });
}

/** POST /api/cm/deal-intermediaries — adiciona intermediario a cadeia */
export async function POST(req: NextRequest) {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { listing_id, side, mandatario_partner_id, intermediary_name, intermediary_document, percentage } = await req.json();

  if (!listing_id || !side || !mandatario_partner_id || !intermediary_name || !percentage)
    return NextResponse.json({ error: "listing_id, side, mandatario_partner_id, intermediary_name e percentage são obrigatórios" }, { status: 422 });

  if (!["compra", "venda"].includes(side))
    return NextResponse.json({ error: "side deve ser 'compra' ou 'venda'" }, { status: 422 });

  const { data, error } = await svc()
    .from("cm_deal_intermediaries")
    .insert({
      listing_id,
      side,
      mandatario_partner_id,
      intermediary_name,
      intermediary_document: intermediary_document ?? null,
      percentage,
      created_by: caller.userId,
    })
    .select("*, profiles!cm_deal_intermediaries_mandatario_partner_id_fkey(full_name, email)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ intermediary: data }, { status: 201 });
}
