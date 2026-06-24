import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createHash } from "crypto";

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
    .select("*, cm_asset_listings(id, anonymous_id, asset_type, ente_devedor, esfera, tribunal, natureza, valor_face, valor_atualizado, desagio_pretendido, prazo_estimado_meses, listing_status, seller_name, numero_processo)")
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
  const tier = access.access_tier ?? "nda_only";

  const baseListing = {
    anonymous_id: listing.anonymous_id,
    asset_type: listing.asset_type,
    ente_devedor: listing.ente_devedor,
    esfera: listing.esfera,
    tribunal: listing.tribunal,
    natureza: listing.natureza,
    valor_face: listing.valor_face,
    desagio_pretendido: listing.desagio_pretendido,
    prazo_estimado_meses: listing.prazo_estimado_meses,
  };

  if (tier === "nda_only") {
    return NextResponse.json({
      nda_required: false,
      access_tier: "nda_only",
      qualification_status: access.qualification_status,
      listing: baseListing,
      documents: [],
      access: {
        buyer_name: access.buyer_name,
        nda_accepted_at: access.nda_accepted_at,
      },
      actions: {
        can_qualify: access.qualification_status === "pendente",
        can_accept_mandato: false,
      },
    });
  }

  const { data: docs } = await svc()
    .from("cm_listing_documents")
    .select("id, document_type, original_filename, file_size, storage_path, validation_status, created_at")
    .eq("listing_id", listing.id)
    .order("created_at", { ascending: false });

  const docsWithUrls = await Promise.all(
    (docs ?? []).map(async (doc: any) => {
      const { data: signedUrl } = await svc().storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 3600);
      return { ...doc, download_url: signedUrl?.signedUrl ?? null };
    })
  );

  const enrichedListing = tier === "full_dd"
    ? { ...baseListing, seller_name: listing.seller_name, numero_processo: listing.numero_processo }
    : baseListing;

  return NextResponse.json({
    nda_required: false,
    access_tier: tier,
    qualification_status: access.qualification_status,
    mandato_v3_accepted: access.mandato_v3_accepted,
    listing: enrichedListing,
    documents: docsWithUrls,
    access: {
      buyer_name: access.buyer_name,
      nda_accepted_at: access.nda_accepted_at,
      mandato_v3_accepted_at: access.mandato_v3_accepted_at,
    },
    actions: {
      can_qualify: false,
      can_accept_mandato: tier === "qualified" && !access.mandato_v3_accepted,
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
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const timestamp = new Date().toISOString();

  const hashPayload = `${access.id}|${token}|${ip}|${userAgent}|${timestamp}|nda_accepted`;
  const ndaHash = createHash("sha256").update(hashPayload).digest("hex");

  const { error } = await svc()
    .from("cm_deal_room_access")
    .update({
      nda_accepted: true,
      nda_accepted_at: timestamp,
      nda_ip_address: ip,
      nda_hash: ndaHash,
      geo_location: req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country") ?? null,
    })
    .eq("id", access.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, message: "NDA aceito. Documentos liberados.", nda_hash: ndaHash });
}
