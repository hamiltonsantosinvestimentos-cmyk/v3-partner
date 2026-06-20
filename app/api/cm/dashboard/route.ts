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
  const view = searchParams.get("view") ?? "head";

  if (view === "head" && !["ADMIN", "GESTAO"].includes(caller.role)) {
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO" }, { status: 403 });
  }

  const db = svc();

  if (view === "head") {
    const [listings, bids, matches, commissions, escrows] = await Promise.all([
      db.from("cm_asset_listings").select("id, anonymous_id, asset_type, valor_face, listing_status, risk_score, created_at"),
      db.from("cm_bids").select("id, listing_id, bid_value, desagio_oferecido, status, created_at").eq("status", "pendente"),
      db.from("demand_matches").select("id, score, listing_id, status").not("listing_id", "is", null).eq("status", "novo"),
      db.from("cm_commission_splits").select("id, commission_total_value, split_buy_value, split_platform_value, split_sell_value, status"),
      db.from("cm_escrow_operations").select("id, listing_id, escrow_value, status").eq("status", "aberto"),
    ]);

    const allListings = listings.data ?? [];
    const totalVolume = allListings.reduce((s, l) => s + Number(l.valor_face), 0);
    const byStatus: Record<string, number> = {};
    allListings.forEach(l => { byStatus[l.listing_status] = (byStatus[l.listing_status] ?? 0) + 1; });

    const totalCommissions = (commissions.data ?? []).reduce((s, c) => s + Number(c.commission_total_value), 0);

    return NextResponse.json({
      view: "head",
      kpis: {
        total_ativos: allListings.length,
        na_vitrine: (byStatus["ativo_vitrine"] ?? 0) + (byStatus["proposta_recebida"] ?? 0),
        propostas_pendentes: (bids.data ?? []).length,
        volume_pipeline: totalVolume,
        matches_novos: (matches.data ?? []).length,
        escrows_abertos: (escrows.data ?? []).length,
        comissoes_total: totalCommissions,
      },
      status_breakdown: byStatus,
      pending_bids: bids.data ?? [],
      new_matches: matches.data ?? [],
    });
  }

  if (view === "seller") {
    const { data: myListings } = await db
      .from("cm_asset_listings")
      .select("id, anonymous_id, asset_type, valor_face, listing_status, risk_score, created_at, cm_bids(count)")
      .eq("created_by", caller.userId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      view: "seller",
      listings: myListings ?? [],
      total: (myListings ?? []).length,
    });
  }

  if (view === "buyer") {
    const { data: mandates } = await db
      .from("investor_demands")
      .select("id, nome_contato, setores, ticket_min, ticket_max, jurisdicao_alvo, desagio_min, alerta_ativo, demand_matches(count)")
      .eq("created_by", caller.userId)
      .eq("alerta_ativo", true)
      .order("created_at", { ascending: false });

    const { data: myBids } = await db
      .from("cm_bids")
      .select("id, listing_id, bid_value, status, created_at, cm_asset_listings(anonymous_id, asset_type, valor_face)")
      .eq("created_by", caller.userId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      view: "buyer",
      mandates: mandates ?? [],
      bids: myBids ?? [],
    });
  }

  return NextResponse.json({ error: "view deve ser: head, seller ou buyer" }, { status: 422 });
}
