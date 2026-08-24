import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getAccountInsights, listCampaigns, MetaAdsError } from "@/lib/meta-ads";

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

// GET — resumo geral pros cards do topo do dashboard: métricas agregadas de
// TODA a conta (todas as campanhas) + contagem de campanhas por status.
export async function GET(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const datePreset = req.nextUrl.searchParams.get("date_preset") ?? "last_7d";

  try {
    const [insights, campanhas] = await Promise.all([
      getAccountInsights({ datePreset }),
      listCampaigns(),
    ]);

    const porStatus = campanhas.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      insights,
      total_campanhas: campanhas.length,
      ativas: porStatus.ACTIVE ?? 0,
      pausadas: porStatus.PAUSED ?? 0,
    });
  } catch (e) {
    const msg = e instanceof MetaAdsError ? e.message : "Erro ao consultar resumo na Meta Ads";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
