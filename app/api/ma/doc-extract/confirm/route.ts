import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 30;

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCallerId(req: NextRequest): Promise<string | null> {
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    const { data: admin } = await serviceClient()
      .from("profiles").select("id").eq("role", "ADMIN").limit(1).single();
    return admin?.id ?? "00000000-0000-0000-0000-000000000000";
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await serviceClient()
    .from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role as typeof ALLOWED_ROLES[number])) return null;
  return user.id;
}

// POST /api/ma/doc-extract/confirm
// Persiste dados de uma extração aprovada em ma_deals.asset_data
// Requer dupla confirmação — o gate UI é no modal; este endpoint é a segunda linha
export async function POST(req: NextRequest) {
  const callerId = await getCallerId(req);
  if (!callerId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as {
    extraction_id: string;
    deal_id:        string;
    fields_to_merge?: string[];   // se omitido, mescla todos os campos
  };

  const { extraction_id, deal_id, fields_to_merge } = body;

  if (!extraction_id || !deal_id) {
    return NextResponse.json({ error: "extraction_id e deal_id são obrigatórios" }, { status: 400 });
  }

  const svc = serviceClient();

  // 1. Carrega a extração
  const { data: extraction, error: extErr } = await svc
    .from("ma_document_extractions")
    .select("id, deal_id, dados_extraidos, confiabilidade, status")
    .eq("id", extraction_id)
    .eq("deal_id", deal_id)
    .single();

  if (extErr || !extraction) {
    return NextResponse.json({ error: "Extração não encontrada" }, { status: 404 });
  }

  if (extraction.status === "confirmed") {
    return NextResponse.json({ error: "Extração já foi confirmada" }, { status: 422 });
  }

  if (extraction.status === "error" || extraction.status === "processing") {
    return NextResponse.json({ error: "Extração não está pronta para confirmação" }, { status: 422 });
  }

  // 2. Carrega asset_data atual do deal
  const { data: dealRow, error: dealErr } = await svc
    .from("ma_deals")
    .select("asset_data")
    .eq("id", deal_id)
    .single();

  if (dealErr || !dealRow) {
    return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });
  }

  const currentAssetData = (dealRow.asset_data ?? {}) as Record<string, unknown>;
  const dadosExtraidos   = (extraction.dados_extraidos ?? {}) as Record<string, unknown>;

  // 3. Mescla: extração tem prioridade sobre dados declarados
  const fieldsSource = fields_to_merge?.length ? fields_to_merge : Object.keys(dadosExtraidos);
  const mergedData: Record<string, unknown> = { ...currentAssetData };

  for (const field of fieldsSource) {
    const extracted = dadosExtraidos[field];
    if (extracted !== null && extracted !== undefined && extracted !== "") {
      mergedData[field] = extracted;
    }
  }

  // 4. Persiste no deal
  const { error: updateDealErr } = await svc
    .from("ma_deals")
    .update({ asset_data: mergedData })
    .eq("id", deal_id);

  if (updateDealErr) {
    return NextResponse.json({ error: updateDealErr.message }, { status: 500 });
  }

  // 5. Marca extração como confirmada
  const { error: updateExtErr } = await svc
    .from("ma_document_extractions")
    .update({
      status:       "confirmed",
      confirmed_at: new Date().toISOString(),
      confirmed_by: callerId,
    })
    .eq("id", extraction_id);

  if (updateExtErr) {
    return NextResponse.json({ error: updateExtErr.message }, { status: 500 });
  }

  // 6. Dispara matching de investidores (best-effort — não bloqueia a resposta)
  try {
    await svc.rpc("match_investors_for_deal", { p_deal_id: deal_id });
  } catch { /* matching é best-effort */ }

  return NextResponse.json({
    ok:            true,
    fields_merged: fieldsSource.length,
    confirmed_at:  new Date().toISOString(),
  });
}
