import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { MESA_OPERACIONAL_VERTICALS } from "@/lib/contract-verticals";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Cancelar rascunho e requalificar (30/09/2026, pedido de João): contrato ainda
// não enviado para assinatura vai para a Lixeira (30 dias) e o lote de
// qualificação que ele consumia volta a ficar disponível para regerar o
// contrato (ex: em outra mesa). O gatilho trg_operation_contracts_batch_lifecycle
// libera o lote e grava a auditoria na mesma transação do UPDATE.
// Não passa pela governança de exclusão porque rascunho não tem envelope.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role as string | undefined;
  if (!role || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const { reason } = await req.json().catch(() => ({ reason: "" }));
  if (typeof reason !== "string" || reason.trim().length < 5) {
    return NextResponse.json({ error: "Motivo obrigatório: mínimo 5 caracteres" }, { status: 422 });
  }

  const { data: contract } = await db
    .from("operation_contracts")
    .select("id, contract_code, vertical, status_signature, external_envelope_id, sent_to_signature_at, deleted_at, qualification_batch_id")
    .eq("id", id)
    .single();
  if (!contract) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (role === "MESA_OPERACIONAL" && !MESA_OPERACIONAL_VERTICALS.includes(contract.vertical as string)) {
    return NextResponse.json({ error: "Este contrato não pertence às verticais da Mesa Operacional." }, { status: 403 });
  }
  if (contract.deleted_at) return NextResponse.json({ error: "Contrato já está na Lixeira" }, { status: 409 });
  if (contract.status_signature !== "rascunho" || contract.external_envelope_id || contract.sent_to_signature_at) {
    return NextResponse.json({ error: "Só é possível cancelar contrato em rascunho, que nunca foi enviado para assinatura." }, { status: 409 });
  }

  // Lote afetado, para a tela informar o que foi liberado.
  let batchInfo: { id: string; parties: number } | null = null;
  if (contract.qualification_batch_id) {
    const { count } = await db
      .from("cm_party_qualifications")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", contract.qualification_batch_id)
      .is("deleted_at", null);
    batchInfo = { id: contract.qualification_batch_id as string, parties: count ?? 0 };
  }

  // UPDATE condicional: só cancela se continua rascunho, sem envelope e fora da Lixeira.
  const { data: updated, error } = await db
    .from("operation_contracts")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: user.id,
      deletion_reason: `Cancelado para requalificar: ${reason.trim()}`,
      deletion_status: "approved",
    })
    .eq("id", id)
    .eq("status_signature", "rascunho")
    .is("external_envelope_id", null)
    .is("sent_to_signature_at", null)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "O contrato mudou de estado. Recarregue a tela." }, { status: 409 });

  // Confirma no banco que o lote realmente foi liberado pelo gatilho
  // (a migration 20260930a pode ainda não estar aplicada): a tela nunca
  // promete a liberação sem prova.
  let batchReleased = false;
  if (batchInfo) {
    const { data: b } = await db
      .from("cm_qualification_batches")
      .select("consumido_por_contract_id")
      .eq("id", batchInfo.id)
      .maybeSingle();
    batchReleased = !!b && b.consumido_por_contract_id === null;
  }

  return NextResponse.json({
    ok: true,
    contract_code: contract.contract_code,
    released_batch: batchInfo && batchReleased ? batchInfo : null,
    batch_still_linked: !!batchInfo && !batchReleased,
  });
}
