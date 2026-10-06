import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isKycDocumentValid, kycValidUntil, KYC_DOCUMENT_KIND_LABELS, type KycDocumentKind } from "@/lib/kyc-documents";

// Resumo do Cliente 360 para a ficha da parte (05/10/2026). Devolve SÓ agregados: nenhum documento,
// nenhum nome de arquivo, nenhuma URL. Quem quiser o detalhe abre /clientes?cliente=<uuid>.
// Toda consulta grava log de leitura em audit_logs com await, antes da resposta.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const NO_STORE = { "Cache-Control": "no-store" };
// Ordem fixa dos documentos KYC no bloco.
const KYC_KINDS: KycDocumentKind[] = ["identificacao_foto", "contrato_social"];

/** Data no fuso de Brasília como DD/MM/AAAA, calculada aqui para a tela não deslocar o dia. */
function dateBr(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_STORE });
  }

  const { id } = await params;
  const { data: q } = await db
    .from("cm_party_qualifications")
    .select("id, v3_client_id, deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (!q || q.deleted_at) return NextResponse.json({ error: "Qualificação não encontrada" }, { status: 404, headers: NO_STORE });
  if (!q.v3_client_id) return NextResponse.json({ linked: false }, { headers: NO_STORE });

  const clientId = q.v3_client_id as string;
  const { data: client } = await db
    .from("v3_clients")
    .select("id, first_seen_vertical, first_seen_at")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return NextResponse.json({ linked: false }, { headers: NO_STORE });

  // Qualificações preenchidas e não excluídas do mesmo cliente, mais recentes primeiro.
  const { data: quals } = await db
    .from("cm_party_qualifications")
    .select("id, batch_id")
    .eq("v3_client_id", clientId)
    .eq("status", "preenchido")
    .is("deleted_at", null)
    .order("filled_at", { ascending: false });
  const batchIds = Array.from(new Set((quals ?? []).map((x) => x.batch_id).filter(Boolean))) as string[];

  // Contratos distintos ligados a esses lotes (só lotes com contrato da Central).
  let contratos = 0;
  if (batchIds.length) {
    const { data: batches } = await db.from("cm_qualification_batches").select("operation_contract_id").in("id", batchIds);
    contratos = new Set((batches ?? []).map((b) => b.operation_contract_id).filter(Boolean)).size;
  }

  // KYC: o documento mais recente de cada tipo. Só tipo, rótulo, validade e se está válido.
  const kyc: { kind: KycDocumentKind; label: string; valid: boolean; valid_until: string }[] = [];
  for (const kind of KYC_KINDS) {
    const { data: doc } = await db
      .from("cm_party_qualification_documents")
      .select("uploaded_at")
      .eq("v3_client_id", clientId)
      .eq("document_kind", kind)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!doc) continue;
    kyc.push({
      kind,
      label: KYC_DOCUMENT_KIND_LABELS[kind],
      valid: isKycDocumentValid(doc.uploaded_at),
      valid_until: dateBr(kycValidUntil(doc.uploaded_at)),
    });
  }

  // Log de leitura ANTES da resposta. Falhou, nada sai.
  const { error: logError } = await db.from("audit_logs").insert({
    user_id: user.id,
    action: "cliente_360_resumo_ficha",
    entity: "v3_clients",
    entity_id: clientId,
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
  });
  if (logError) {
    console.error("[cliente-360 ficha] falha ao gravar log de leitura", { client_id: clientId, code: logError.code });
    return NextResponse.json({ error: "Não foi possível registrar a consulta, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({
    linked: true,
    client_id: clientId,
    first_seen_vertical: client.first_seen_vertical,
    first_seen_at: dateBr(client.first_seen_at),
    qualificacoes: quals?.length ?? 0,
    contratos,
    kyc,
  }, { headers: NO_STORE });
}
