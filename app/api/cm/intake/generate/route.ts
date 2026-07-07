import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string))
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { listing_id } = body;

  if (listing_id) {
    const { data: existing } = await svc()
      .from("cm_asset_listings")
      .select("id, cm_intake_token")
      .eq("id", listing_id)
      .single();

    if (!existing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

    if (existing.cm_intake_token) {
      const host = req.headers.get("host") ?? "app.v3partners.com.br";
      const protocol = host.includes("localhost") ? "http" : "https";
      return NextResponse.json({
        token: existing.cm_intake_token,
        url: `${protocol}://${host}/intake/cm/${existing.cm_intake_token}`,
        reused: true,
      });
    }

    const token = randomUUID().replace(/-/g, "");
    const { error } = await svc()
      .from("cm_asset_listings")
      .update({ cm_intake_token: token })
      .eq("id", listing_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const host = req.headers.get("host") ?? "app.v3partners.com.br";
    const protocol = host.includes("localhost") ? "http" : "https";
    return NextResponse.json({
      token,
      url: `${protocol}://${host}/intake/cm/${token}`,
      listing_id,
    });
  }

  const token = randomUUID().replace(/-/g, "");
  const { data: anonId } = await svc().rpc("generate_cm_anonymous_id", {
    p_asset_type: "precatorio",
    p_esfera: "Federal",
  });

  const { data: listing, error } = await svc()
    .from("cm_asset_listings")
    .insert({
      anonymous_id: anonId,
      asset_type: "precatorio",
      seller_name: "Pendente",
      valor_face: 0,
      listing_status: "reuniao_validada",
      meeting_validated_at: new Date().toISOString(),
      cm_intake_token: token,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const host = req.headers.get("host") ?? "app.v3partners.com.br";
  const protocol = host.includes("localhost") ? "http" : "https";
  return NextResponse.json({
    token,
    url: `${protocol}://${host}/intake/cm/${token}`,
    listing_id: listing.id,
    listing,
  }, { status: 201 });
}
