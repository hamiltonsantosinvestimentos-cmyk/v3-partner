import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET — vitrine publica de imoveis e ativos alternativos, sem autenticacao.
// Le exclusivamente a view cm_vitrine_publica_imoveis (ja anonimizada e
// ja filtrada por allow_public_listing = true no banco). Nunca consulta
// cm_asset_listings direto, para nao correr risco de vazar seller_name/cpf.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const uf = searchParams.get("uf");
  const natureza = searchParams.get("natureza");
  const valorMin = searchParams.get("valor_min");
  const valorMax = searchParams.get("valor_max");

  let query = svc()
    .from("cm_vitrine_publica_imoveis")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60);

  if (uf) query = query.eq("uf", uf);
  if (natureza) query = query.eq("natureza", natureza);
  if (valorMin) query = query.gte("valor_face", Number(valorMin));
  if (valorMax) query = query.lte("valor_face", Number(valorMax));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const assets = await Promise.all(
    (data ?? []).map(async (row: any) => {
      const gallery: { storage_path: string; caption?: string }[] = Array.isArray(row.public_gallery)
        ? row.public_gallery
        : [];
      const first = gallery[0];
      let thumbnail_url: string | null = null;
      if (first?.storage_path) {
        const { data: signed } = await svc().storage.from("documents").createSignedUrl(first.storage_path, 3600);
        thumbnail_url = signed?.signedUrl ?? null;
      }
      return {
        anonymous_id: row.anonymous_id,
        uf: row.uf,
        municipio: row.municipio,
        natureza: row.natureza,
        valor_face: row.valor_face,
        valor_atualizado: row.valor_atualizado,
        risk_score: row.risk_score,
        thumbnail_url,
        created_at: row.created_at,
      };
    })
  );

  return NextResponse.json({ assets, total: assets.length });
}
