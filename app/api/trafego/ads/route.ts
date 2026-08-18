import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createAd, createAdCreative, MetaAdsError } from "@/lib/meta-ads";

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

// GET — lista os anúncios criados pela plataforma pra um ad set.
export async function GET(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const adSetLocalId = req.nextUrl.searchParams.get("ad_set_local_id");
  if (!adSetLocalId) return NextResponse.json({ error: "ad_set_local_id obrigatório" }, { status: 422 });

  const { data, error } = await svc()
    .from("trafego_ads")
    .select("*")
    .eq("ad_set_id", adSetLocalId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ads: data ?? [] });
}

// POST — cria o criativo e o anúncio numa tacada só. ad_set_id no body é o
// meta_adset_id (não o uuid local).
export async function POST(req: NextRequest) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    ad_set_id?: string;
    ad_set_local_id?: string;
    name?: string;
    page_id?: string;
    message?: string;
    link?: string;
    link_title?: string;
    image_hash?: string;
  };

  if (!body.ad_set_id || !body.name?.trim() || !body.page_id || !body.message || !body.link) {
    return NextResponse.json({ error: "ad_set_id, name, page_id, message e link são obrigatórios" }, { status: 422 });
  }

  try {
    const creative = await createAdCreative({
      name: `${body.name.trim()} — criativo`,
      pageId: body.page_id,
      message: body.message,
      link: body.link,
      linkTitle: body.link_title,
      imageHash: body.image_hash,
    });

    const ad = await createAd({
      name: body.name.trim(),
      adSetId: body.ad_set_id,
      creativeId: creative.id,
      status: "PAUSED",
    });

    if (body.ad_set_local_id) {
      const { data: adRow, error } = await svc()
        .from("trafego_ads")
        .insert({
          ad_set_id: body.ad_set_local_id,
          meta_ad_id: ad.id,
          nome: body.name.trim(),
          status: "PAUSED",
          criativo: { creative_id: creative.id, message: body.message, link: body.link, link_title: body.link_title ?? null },
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ad: adRow });
    }

    return NextResponse.json({ ad: { meta_ad_id: ad.id, creative_id: creative.id } });
  } catch (e) {
    const msg = e instanceof MetaAdsError ? e.message : "Erro ao criar anúncio na Meta Ads";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
