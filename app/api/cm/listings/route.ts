import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

async function getCallerRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const mine = searchParams.get("mine") === "true";

  let query = svc()
    .from("cm_asset_listings")
    .select("*, cm_bids(count), cm_listing_documents(count)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status) query = query.eq("listing_status", status);
  if (mine) query = query.eq("created_by", caller.userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listings: data ?? [] });
}

export async function POST(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    asset_type, seller_name, seller_cpf_cnpj,
    ente_devedor, esfera, tribunal, natureza, numero_processo,
    valor_face, valor_atualizado, desagio_pretendido, prazo_estimado_meses,
    allows_tranching, conditional_blocks, metadata, ma_deal_id,
    apelido, numero_interno,
  } = body;

  if (!asset_type || !seller_name || !valor_face) {
    return NextResponse.json({
      error: "Campos obrigatórios: asset_type, seller_name, valor_face"
    }, { status: 422 });
  }

  const { data: anonId } = await svc().rpc("generate_cm_anonymous_id", {
    p_asset_type: asset_type,
    p_esfera: esfera ?? "Federal",
  });

  const { data: listing, error } = await svc()
    .from("cm_asset_listings")
    .insert({
      anonymous_id: anonId,
      apelido: apelido ?? null,
      numero_interno: numero_interno ?? null,
      asset_type,
      seller_name,
      seller_cpf_cnpj: seller_cpf_cnpj ?? null,
      seller_profile_id: null,
      ma_deal_id: ma_deal_id ?? null,
      ente_devedor: ente_devedor ?? null,
      esfera: esfera ?? null,
      tribunal: tribunal ?? null,
      natureza: natureza ?? null,
      numero_processo: numero_processo ?? null,
      valor_face: Number(valor_face),
      valor_atualizado: valor_atualizado ? Number(valor_atualizado) : null,
      desagio_pretendido: desagio_pretendido ? Number(desagio_pretendido) : null,
      prazo_estimado_meses: prazo_estimado_meses ? Number(prazo_estimado_meses) : null,
      allows_tranching: allows_tranching ?? false,
      conditional_blocks: conditional_blocks ?? null,
      metadata: metadata ?? {},
      listing_status: "reuniao_validada",
      meeting_validated_at: new Date().toISOString(),
      created_by: caller.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing }, { status: 201 });
}
