import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getInsights, MetaAdsError } from "@/lib/meta-ads";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) return null;
  return { user };
}

// GET — métricas da campanha (impressões, cliques, gasto, CTR, CPC), com
// cache local de 15 min pra não estourar rate limit da Graph API.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: metaCampaignId } = await params;
  const datePreset = req.nextUrl.searchParams.get("date_preset") ?? "last_7d";

  try {
    const { data: cached } = await svc()
      .from("trafego_campanhas")
      .select("insights_cache, insights_synced_at")
      .eq("meta_campaign_id", metaCampaignId)
      .maybeSingle();

    const cacheAgeMs = cached?.insights_synced_at ? Date.now() - new Date(cached.insights_synced_at).getTime() : Infinity;
    if (cached?.insights_cache && cacheAgeMs < 15 * 60 * 1000) {
      return NextResponse.json({ insights: cached.insights_cache, cached: true });
    }

    const insights = await getInsights(metaCampaignId, { datePreset });
    await svc()
      .from("trafego_campanhas")
      .update({ insights_cache: insights, insights_synced_at: new Date().toISOString() })
      .eq("meta_campaign_id", metaCampaignId);

    return NextResponse.json({ insights, cached: false });
  } catch (e) {
    const msg = e instanceof MetaAdsError ? e.message : "Erro ao consultar métricas na Meta Ads";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
