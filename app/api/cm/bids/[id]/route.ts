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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { data: bid, error } = await svc()
    .from("cm_bids")
    .select("*, cm_asset_listings(anonymous_id, asset_type, valor_face, listing_status, seller_name)")
    .eq("id", id)
    .single();

  if (error || !bid) return NextResponse.json({ error: "Bid não encontrado" }, { status: 404 });
  return NextResponse.json({ bid });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado — apenas ADMIN/GESTAO" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { action, commission_percent, reason } = body;

  if (!action || !["aceitar", "recusar", "contra_proposta"].includes(action)) {
    return NextResponse.json({ error: "action obrigatório: aceitar, recusar ou contra_proposta" }, { status: 422 });
  }

  const { data: bid } = await svc().from("cm_bids")
    .select("*, cm_asset_listings(id, valor_face, anonymous_id)")
    .eq("id", id).single();

  if (!bid) return NextResponse.json({ error: "Bid não encontrado" }, { status: 404 });
  if (bid.status !== "pendente") {
    return NextResponse.json({ error: `Bid já processado (status: ${bid.status})` }, { status: 422 });
  }

  const newStatus = action === "aceitar" ? "aceita" : action === "recusar" ? "recusada" : "contra_proposta";

  await svc().from("cm_bids").update({
    status: newStatus,
    reviewed_by: caller.userId,
    reviewed_at: new Date().toISOString(),
    notes: reason ? `${bid.notes ?? ""}\n[Head] ${reason}`.trim() : bid.notes,
  }).eq("id", id);

  let commission = null;

  if (action === "aceitar") {
    const commPercent = commission_percent ?? 5;
    const listing = bid.cm_asset_listings as any;

    const { data: splitResult } = await svc().rpc("calculate_cm_commission_split", {
      p_valor_face: Number(listing.valor_face),
      p_commission_percent: Number(commPercent),
    });

    if (splitResult?.error) {
      return NextResponse.json({
        error: splitResult.message,
        requires_head_review: splitResult.requires_head_review,
      }, { status: 422 });
    }

    const { error: commError } = await svc().from("cm_commission_splits").insert({
      listing_id: listing.id,
      bid_id: id,
      valor_face: Number(listing.valor_face),
      commission_total_percent: splitResult.commission_total_percent,
      commission_total_value: splitResult.commission_total_value,
      split_buy_value: splitResult.split_buy_value,
      split_platform_value: splitResult.split_platform_value,
      split_sell_value: splitResult.split_sell_value,
      minimum_enforced: splitResult.minimum_enforced,
      status: "aprovado",
    });

    if (commError) {
      return NextResponse.json({ error: `Erro ao registrar comissão: ${commError.message}` }, { status: 500 });
    }

    commission = splitResult;

    await svc().rpc("transition_cm_listing_status", {
      p_listing_id: listing.id,
      p_new_status: "em_escrow_due_diligence",
      p_reason: `Bid aceito: R$ ${Number(bid.bid_value).toLocaleString("pt-BR")} (${commPercent}% comissão)`,
      p_user_id: caller.userId,
    });
  }

  return NextResponse.json({
    success: true,
    bid: { id, status: newStatus },
    commission,
  });
}
