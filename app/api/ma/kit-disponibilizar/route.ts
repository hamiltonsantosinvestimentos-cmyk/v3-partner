import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

// PATCH — toggle disponibilidade de um arquivo criativo para partners
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin) return NextResponse.json({ error: "Apenas gestores podem disponibilizar criativos" }, { status: 403 });

  const { deal_id, file_key, available } = await req.json();
  // file_key = "cim_pt-br" | "cim_en" | "teaser_pt-br" | etc.
  if (!deal_id || !file_key || typeof available !== "boolean") {
    return NextResponse.json({ error: "deal_id, file_key e available são obrigatórios" }, { status: 400 });
  }

  const { data: deal } = await svc.from("ma_deals").select("asset_data").eq("id", deal_id).single();
  const ad = (deal?.asset_data ?? {}) as Record<string, unknown>;
  const current = (ad.kit_files_available ?? {}) as Record<string, boolean>;

  const updated = { ...current, [file_key]: available };

  // Se pelo menos um arquivo está disponível, kit_liberado = true automaticamente
  const anyAvailable = Object.values(updated).some(Boolean);
  const newAssetData: Record<string, unknown> = {
    ...ad,
    kit_files_available: updated,
    kit_liberado: anyAvailable ? true : (ad.kit_liberado ?? false),
  };

  const { error } = await svc.from("ma_deals").update({
    asset_data: newAssetData,
    updated_at: new Date().toISOString(),
  }).eq("id", deal_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, kit_files_available: updated, kit_liberado: newAssetData.kit_liberado });
}
