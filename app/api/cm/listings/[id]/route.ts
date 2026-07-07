import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  // Campos negociados: calibrados manualmente pela Mesa, separados do historico de OCR
  // (cm_asset_listings.valores_ocr, populado via trigger — nunca escrito por esta rota)
  const allowed = [
    "ask_price_floor", "auto_accept_enabled", "mandato_v3_template_id",
    "valor_face", "valor_atualizado", "desagio_pretendido",
    "prazo_estimado_meses", "tir_estimada", "vpl",
    "apelido", "originator_profile_id", "originator_referral_id",
    "uf_ente_devedor", "municipio_ente_devedor", "tranche_valor_minimo",
  ];
  const update: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) update[key] = body[key];
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 422 });

  const { data, error } = await svc()
    .from("cm_asset_listings")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing: data });
}
