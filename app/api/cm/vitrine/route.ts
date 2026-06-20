import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function isCronCall(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return !!auth && auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!isCronCall(req)) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const assetType = searchParams.get("asset_type");
  const enteDevedor = searchParams.get("ente_devedor");
  const natureza = searchParams.get("natureza");
  const esfera = searchParams.get("esfera");
  const desagioMin = searchParams.get("desagio_min");
  const valorFaceMin = searchParams.get("valor_face_min");
  const valorFaceMax = searchParams.get("valor_face_max");

  // View anonimizada — NUNCA expoe seller_name, seller_cpf_cnpj, numero_processo
  let query = svc()
    .from("cm_vitrine_public")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (assetType) query = query.eq("asset_type", assetType);
  if (enteDevedor) query = query.ilike("ente_devedor", `%${enteDevedor}%`);
  if (natureza) query = query.eq("natureza", natureza);
  if (esfera) query = query.eq("esfera", esfera);
  if (desagioMin) query = query.gte("desagio_pretendido", Number(desagioMin));
  if (valorFaceMin) query = query.gte("valor_face", Number(valorFaceMin));
  if (valorFaceMax) query = query.lte("valor_face", Number(valorFaceMax));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ assets: data ?? [], total: data?.length ?? 0 });
}
