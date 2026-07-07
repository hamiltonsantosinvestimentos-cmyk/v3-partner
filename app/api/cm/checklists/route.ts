import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role, full_name").eq("id", user.id).single();
  if (!profile) return null;
  return { userId: user.id, role: profile.role as string, name: profile.full_name as string };
}

export async function GET(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listing_id");
  const bidId = searchParams.get("bid_id");
  const type = searchParams.get("type");

  let query = svc()
    .from("cm_operation_checklists")
    .select("*, cm_checklist_items(*)")
    .order("created_at", { ascending: false });

  if (listingId) query = query.eq("listing_id", listingId);
  if (bidId) query = query.eq("bid_id", bidId);
  if (type) query = query.eq("checklist_type", type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ checklists: data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await getCaller(req);
  if (!caller || !ADMIN_ROLES.includes(caller.role))
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });

  const { listing_id, bid_id, checklist_type } = await req.json();
  if (!listing_id || !checklist_type)
    return NextResponse.json({ error: "listing_id e checklist_type obrigatórios" }, { status: 422 });

  const valid = ["pre_aceite", "pre_fechamento", "pos_cessao"];
  if (!valid.includes(checklist_type))
    return NextResponse.json({ error: `Tipo inválido. Use: ${valid.join(", ")}` }, { status: 422 });

  const { data: existing } = await svc()
    .from("cm_operation_checklists")
    .select("id")
    .eq("listing_id", listing_id)
    .eq("checklist_type", checklist_type)
    .maybeSingle();

  if (existing)
    return NextResponse.json({ error: "Checklist deste tipo já existe para este listing", checklist_id: existing.id }, { status: 409 });

  const { data: result, error } = await svc().rpc("create_cm_checklist", {
    p_listing_id: listing_id,
    p_bid_id: bid_id ?? null,
    p_type: checklist_type,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: checklist } = await svc()
    .from("cm_operation_checklists")
    .select("*, cm_checklist_items(*)")
    .eq("id", result)
    .single();

  return NextResponse.json({ checklist }, { status: 201 });
}
