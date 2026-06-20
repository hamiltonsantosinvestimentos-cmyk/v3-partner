import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: access } = await svc()
    .from("cm_deal_room_access")
    .select("*, cm_asset_listings(id, anonymous_id, asset_type, ente_devedor, esfera, tribunal, natureza, valor_face, valor_atualizado, desagio_pretendido, prazo_estimado_meses, listing_status)")
    .eq("access_token", token)
    .eq("revoked", false)
    .single();

  if (!access)
    return NextResponse.json({ error: "Link inválido ou revogado" }, { status: 404 });

  if (access.expires_at && new Date(access.expires_at) < new Date())
    return NextResponse.json({ error: "Link expirado. Solicite novo acesso à V3 Partners." }, { status: 410 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
  await svc().from("cm_deal_room_access").update({
    last_accessed_at: new Date().toISOString(),
    first_accessed_at: access.first_accessed_at ?? new Date().toISOString(),
    access_count: (access.access_count ?? 0) + 1,
  }).eq("id", access.id);

  if (!access.nda_accepted) {
    return NextResponse.json({
      nda_required: true,
      listing: {
        anonymous_id: (access.cm_asset_listings as any)?.anonymous_id,
        asset_type: (access.cm_asset_listings as any)?.asset_type,
      },
    });
  }

  const listing = access.cm_asset_listings as any;
  const { data: docs } = await svc()
    .from("cm_listing_documents")
    .select("id, document_type, original_filename, file_size, validation_status, created_at")
    .eq("listing_id", listing.id)
    .order("created_at", { ascending: false });

  const docsWithUrls = await Promise.all(
    (docs ?? []).map(async (doc: any) => {
      const { data: signedUrl } = await svc().storage
        .from("cm-documents")
        .createSignedUrl(doc.id, 3600);
      return { ...doc, download_url: signedUrl?.signedUrl ?? null };
    })
  );

  return NextResponse.json({
    nda_required: false,
    listing: {
      anonymous_id: listing.anonymous_id,
      asset_type: listing.asset_type,
      ente_devedor: listing.ente_devedor,
      esfera: listing.esfera,
      tribunal: listing.tribunal,
      natureza: listing.natureza,
      valor_face: listing.valor_face,
      desagio_pretendido: listing.desagio_pretendido,
      prazo_estimado_meses: listing.prazo_estimado_meses,
    },
    documents: docsWithUrls,
    access: {
      buyer_name: access.buyer_name,
      nda_accepted_at: access.nda_accepted_at,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { action } = await req.json();

  if (action !== "accept_nda")
    return NextResponse.json({ error: "Ação inválida" }, { status: 422 });

  const { data: access } = await svc()
    .from("cm_deal_room_access")
    .select("id, nda_accepted, revoked, expires_at")
    .eq("access_token", token)
    .single();

  if (!access || access.revoked)
    return NextResponse.json({ error: "Link inválido ou revogado" }, { status: 404 });

  if (access.expires_at && new Date(access.expires_at) < new Date())
    return NextResponse.json({ error: "Link expirado" }, { status: 410 });

  if (access.nda_accepted)
    return NextResponse.json({ success: true, message: "NDA já aceito" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const { error } = await svc()
    .from("cm_deal_room_access")
    .update({
      nda_accepted: true,
      nda_accepted_at: new Date().toISOString(),
      nda_ip_address: ip,
    })
    .eq("id", access.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, message: "NDA aceito. Documentos liberados." });
}
