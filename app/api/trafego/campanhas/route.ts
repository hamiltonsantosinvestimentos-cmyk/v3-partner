import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createCampaign, listCampaigns, MetaAdsError, type CampaignObjective } from "@/lib/meta-ads";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) return null;
  return { user, profile };
}

// GET — lista campanhas: puxa da Meta ao vivo e sincroniza o cache local
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const metaCampanhas = await listCampaigns();

    // Sincroniza o cache local (upsert por meta_campaign_id) — não bloqueia
    // a resposta se falhar, a Meta continua sendo a fonte de verdade.
    const accountId = (process.env.META_ADS_ACCOUNT_ID ?? "").replace(/^act_/, "");
    if (metaCampanhas.length > 0) {
      await svc().from("trafego_campanhas").upsert(
        metaCampanhas.map((c) => ({
          meta_campaign_id: c.id,
          meta_ad_account_id: accountId,
          nome: c.name,
          objetivo: c.objective,
          status: c.status,
          orcamento_diario_centavos: c.daily_budget ? Number(c.daily_budget) : null,
          orcamento_vitalicio_centavos: c.lifetime_budget ? Number(c.lifetime_budget) : null,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "meta_campaign_id", ignoreDuplicates: false }
      );
    }

    return NextResponse.json({ campanhas: metaCampanhas });
  } catch (e) {
    const msg = e instanceof MetaAdsError ? e.message : "Erro ao consultar a Meta Ads API";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// POST — cria campanha (nasce pausada por padrão — nunca ativa sozinha)
export async function POST(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as { name?: string; objective?: CampaignObjective; vertical?: string };
  if (!body.name?.trim() || !body.objective) {
    return NextResponse.json({ error: "name e objective são obrigatórios" }, { status: 422 });
  }

  try {
    const result = await createCampaign({ name: body.name.trim(), objective: body.objective, status: "PAUSED" });

    const accountId = (process.env.META_ADS_ACCOUNT_ID ?? "").replace(/^act_/, "");
    const { data: campanha, error } = await svc()
      .from("trafego_campanhas")
      .insert({
        meta_campaign_id: result.id,
        meta_ad_account_id: accountId,
        nome: body.name.trim(),
        objetivo: body.objective,
        status: "PAUSED",
        vertical: body.vertical ?? null,
        created_by: auth.user.id,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ campanha });
  } catch (e) {
    const msg = e instanceof MetaAdsError ? e.message : "Erro ao criar campanha na Meta Ads";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
