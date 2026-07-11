import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — landing page publica de um ativo especifico. Sem autenticacao.
// Le a view anonimizada; nunca expoe seller_name/cpf/numero_processo.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ anonymous_id: string }> }
) {
  const { anonymous_id } = await params;

  const { data: row, error } = await svc()
    .from("cm_vitrine_publica_imoveis")
    .select("*")
    .eq("anonymous_id", anonymous_id)
    .single();

  if (error || !row) return NextResponse.json({ error: "Ativo não encontrado ou não disponível" }, { status: 404 });

  const gallery: { storage_path: string; caption?: string; order?: number }[] = Array.isArray(row.public_gallery)
    ? row.public_gallery
    : [];

  const galleryWithUrls = await Promise.all(
    gallery
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(async (item) => {
        const { data: signed } = await svc().storage.from("documents").createSignedUrl(item.storage_path, 3600);
        return { url: signed?.signedUrl ?? null, caption: item.caption ?? "" };
      })
  );

  return NextResponse.json({
    anonymous_id: row.anonymous_id,
    asset_type: row.asset_type,
    uf: row.uf,
    municipio: row.municipio,
    natureza: row.natureza,
    valor_face: row.valor_face,
    valor_atualizado: row.valor_atualizado,
    risk_score: row.risk_score,
    gallery: galleryWithUrls.filter((g) => g.url),
    listing_status: row.listing_status,
  });
}
