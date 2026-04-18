import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

// POST — salva resultado FORJA ou libera/bloqueia KIT (apenas admin/gestao/mesa)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas gestores podem executar esta ação" }, { status: 403 });
  }

  const body = await req.json();
  const { deal_id, action, forja_result } = body;

  if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const { data: deal } = await svc.from("ma_deals").select("asset_data").eq("id", deal_id).single();
  const currentAssetData = (deal?.asset_data ?? {}) as Record<string, unknown>;

  let newAssetData: Record<string, unknown> = { ...currentAssetData };

  if (action === "save_forja") {
    if (!forja_result) return NextResponse.json({ error: "forja_result obrigatório" }, { status: 400 });
    newAssetData = {
      ...currentAssetData,
      forja_result,
      forja_status: forja_result.recommendation,
      forja_score: forja_result.score,
      forja_validated_at: new Date().toISOString(),
    };
  } else if (action === "liberar_kit") {
    newAssetData = {
      ...currentAssetData,
      kit_liberado: true,
      kit_liberado_at: new Date().toISOString(),
    };
  } else if (action === "bloquear_kit") {
    newAssetData = {
      ...currentAssetData,
      kit_liberado: false,
    };
  } else {
    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  }

  const { data, error } = await svc
    .from("ma_deals")
    .update({ asset_data: newAssetData, updated_at: new Date().toISOString() })
    .eq("id", deal_id)
    .select("asset_data")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, asset_data: data.asset_data });
}
