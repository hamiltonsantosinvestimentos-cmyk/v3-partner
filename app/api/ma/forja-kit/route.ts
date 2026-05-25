import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { mapMissingToDocRequests } from "@/lib/ma/document-request-mapper";
import { extractUF, extractMatchingFields, type ValidatedField } from "@/lib/ma/forja-utils";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

// POST — salva resultado FORJA ou libera/bloqueia KIT (apenas admin/gestao/mesa)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  if (!isAdmin) {
    return NextResponse.json({ error: "Apenas gestores podem executar esta ação" }, { status: 403 });
  }

  const body = await req.json();
  const { deal_id, action, forja_result } = body;

  if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const { data: deal } = await svc
    .from("ma_deals")
    .select("asset_data, location, sector")
    .eq("id", deal_id).single();
  const currentAssetData = (deal?.asset_data ?? {}) as Record<string, unknown>;

  let newAssetData: Record<string, unknown> = { ...currentAssetData };
  const dealColumnUpdates: Record<string, unknown> = {};

  if (action === "save_forja") {
    if (!forja_result) return NextResponse.json({ error: "forja_result obrigatório" }, { status: 400 });

    // Extrair dados para matching a partir dos campos validated
    const validated: ValidatedField[] = Array.isArray(forja_result.validated) ? forja_result.validated : [];
    const extracted = extractMatchingFields(validated);

    newAssetData = {
      ...currentAssetData,
      forja_result,
      forja_status:       forja_result.recommendation,
      forja_score:        forja_result.score,
      forja_validated_at: new Date().toISOString(),
      // Dados de matching extraídos pelo FORJA
      ...(extracted.uf          && { uf_extraido:             extracted.uf }),
      ...(extracted.tipoOperacao && { tipo_operacao_extraida: extracted.tipoOperacao }),
    };

    // Atualizar colunas diretas do deal se estiverem vazias
    if (!deal?.location && extracted.location) dealColumnUpdates.location = extracted.location;
    if (!deal?.sector   && extracted.sector)   dealColumnUpdates.sector   = extracted.sector;

  } else if (action === "save_forja_with_request") {
    // Igual a save_forja, mas cria pedido de documentos automaticamente para campos ALTA/MEDIA
    if (!forja_result) return NextResponse.json({ error: "forja_result obrigatório" }, { status: 400 });

    const validated: ValidatedField[] = Array.isArray(forja_result.validated) ? forja_result.validated : [];
    const extracted = extractMatchingFields(validated);
    const forjaTs = new Date().toISOString();

    newAssetData = {
      ...currentAssetData,
      forja_result,
      forja_status:       forja_result.recommendation,
      forja_score:        forja_result.score,
      forja_validated_at: forjaTs,
      ...(extracted.uf          && { uf_extraido:             extracted.uf }),
      ...(extracted.tipoOperacao && { tipo_operacao_extraida: extracted.tipoOperacao }),
    };

    if (!deal?.location && extracted.location) dealColumnUpdates.location = extracted.location;
    if (!deal?.sector   && extracted.sector)   dealColumnUpdates.sector   = extracted.sector;

    // Auto-gera pedido de documentos se houver campos ALTA/MEDIA ausentes
    const missing = Array.isArray(forja_result.missing) ? forja_result.missing : [];
    const relevantMissing = missing.filter(
      (m: { priority: string }) => m.priority === "ALTA" || m.priority === "MEDIA"
    );

    if (relevantMissing.length > 0) {
      // Verifica se já existe pedido ativo para não duplicar
      const { data: existing } = await svc
        .from("ma_document_requests")
        .select("id")
        .eq("deal_id", deal_id)
        .in("status", ["pending", "sent", "partial"])
        .maybeSingle();

      if (!existing) {
        const docItems = mapMissingToDocRequests(relevantMissing);
        if (docItems.length > 0) {
          await svc.from("ma_document_requests").insert({
            deal_id,
            forja_snapshot_at: forjaTs,
            requested_by:      user.id,
            documents:         docItems,
            status:            "pending",
          });
        }
      }
    }

  } else if (action === "liberar_kit") {
    newAssetData = { ...currentAssetData, kit_liberado: true, kit_liberado_at: new Date().toISOString() };
  } else if (action === "bloquear_kit") {
    newAssetData = { ...currentAssetData, kit_liberado: false };
  } else {
    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  }

  const { data, error } = await svc
    .from("ma_deals")
    .update({
      asset_data:  newAssetData,
      updated_at:  new Date().toISOString(),
      ...dealColumnUpdates,
    })
    .eq("id", deal_id)
    .select("asset_data, location, sector")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Verifica se houve criação de pedido de documentos (para feedback no frontend)
  let docRequestId: string | null = null;
  if (action === "save_forja_with_request") {
    const { data: req } = await svc
      .from("ma_document_requests")
      .select("id")
      .eq("deal_id", deal_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    docRequestId = req?.id ?? null;
  }

  return NextResponse.json({
    ok:              true,
    asset_data:      data.asset_data,
    updated_columns: dealColumnUpdates,
    ...(docRequestId && { doc_request_id: docRequestId }),
  });
}
