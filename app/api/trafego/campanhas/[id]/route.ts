import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { setStatus, setDailyBudget, MetaAdsError, type EntityStatus } from "@/lib/meta-ads";

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

// PATCH — pausar/ativar e/ou mudar orçamento diário de uma campanha.
// { id } no path é o meta_campaign_id (não o uuid local).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: metaCampaignId } = await params;
  const body = await req.json() as { status?: EntityStatus; daily_budget_centavos?: number };

  try {
    if (body.status) await setStatus(metaCampaignId, body.status);
    if (body.daily_budget_centavos !== undefined) await setDailyBudget(metaCampaignId, body.daily_budget_centavos);

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status) update.status = body.status;
    if (body.daily_budget_centavos !== undefined) update.orcamento_diario_centavos = body.daily_budget_centavos;
    await svc().from("trafego_campanhas").update(update).eq("meta_campaign_id", metaCampaignId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof MetaAdsError ? e.message : "Erro ao atualizar campanha na Meta Ads";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
