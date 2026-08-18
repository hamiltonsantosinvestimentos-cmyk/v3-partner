import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createAdSet, MetaAdsError } from "@/lib/meta-ads";

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

// GET — lista os ad sets criados pela plataforma pra uma campanha (cache
// local; não busca ad sets criados fora da plataforma, direto no Meta).
export async function GET(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const campanhaLocalId = req.nextUrl.searchParams.get("campanha_local_id");
  if (!campanhaLocalId) return NextResponse.json({ error: "campanha_local_id obrigatório" }, { status: 422 });

  const { data, error } = await svc()
    .from("trafego_ad_sets")
    .select("*")
    .eq("campanha_id", campanhaLocalId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ad_sets: data ?? [] });
}

// POST — cria um conjunto de anúncios (ad set) dentro de uma campanha já
// existente. campaign_id no body é o meta_campaign_id.
export async function POST(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    campaign_id?: string;
    campanha_local_id?: string;
    name?: string;
    daily_budget_centavos?: number;
    targeting?: Record<string, unknown>;
    billing_event?: "IMPRESSIONS" | "LINK_CLICKS";
    optimization_goal?: string;
  };

  if (!body.campaign_id || !body.name?.trim() || !body.daily_budget_centavos || !body.targeting) {
    return NextResponse.json({ error: "campaign_id, name, daily_budget_centavos e targeting são obrigatórios" }, { status: 422 });
  }

  try {
    const result = await createAdSet({
      campaignId: body.campaign_id,
      name: body.name.trim(),
      dailyBudgetCentavos: body.daily_budget_centavos,
      targeting: body.targeting,
      billingEvent: body.billing_event,
      optimizationGoal: body.optimization_goal,
      status: "PAUSED",
    });

    if (body.campanha_local_id) {
      const { data: adSet, error } = await svc()
        .from("trafego_ad_sets")
        .insert({
          campanha_id: body.campanha_local_id,
          meta_adset_id: result.id,
          nome: body.name.trim(),
          status: "PAUSED",
          orcamento_diario_centavos: body.daily_budget_centavos,
          segmentacao: body.targeting,
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ad_set: adSet });
    }

    return NextResponse.json({ ad_set: { meta_adset_id: result.id } });
  } catch (e) {
    const msg = e instanceof MetaAdsError ? e.message : "Erro ao criar conjunto de anúncios na Meta Ads";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
