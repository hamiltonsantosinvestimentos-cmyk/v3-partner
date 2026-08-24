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

// GET — métricas de QUALQUER objeto da Meta Ads (campanha, ad set ou
// anúncio — o edge /insights funciona igual pros três níveis). Genérico,
// usado pelo dashboard pra métricas de ad set/anúncio (o nível de campanha
// continua usando /api/trafego/campanhas/[id]/insights, que tem cache de
// 15min por já ser o mais consultado).
export async function GET(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const objectId = req.nextUrl.searchParams.get("object_id");
  if (!objectId) return NextResponse.json({ error: "object_id obrigatório" }, { status: 422 });
  const datePreset = req.nextUrl.searchParams.get("date_preset") ?? "last_7d";

  try {
    const insights = await getInsights(objectId, { datePreset });
    return NextResponse.json({ insights });
  } catch (e) {
    const msg = e instanceof MetaAdsError ? e.message : "Erro ao consultar métricas na Meta Ads";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
