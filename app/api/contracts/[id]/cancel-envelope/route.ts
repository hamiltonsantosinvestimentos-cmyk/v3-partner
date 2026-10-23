import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getProvider } from "@/lib/esignature";
import { getClickSignDocumentStatus, listClickSignSignEvents } from "@/lib/esignature/clicksign-provider";
import { cancelEnvelopeInDb, describeSigned, recordCancelNote } from "@/lib/contract-envelope-cancel";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Só ADMIN e GESTAO (decisão do João, 22/10/2026): a mesa operacional não cancela envio.
async function requireRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("full_name, role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return { userId: user.id, name: profile.full_name ?? "Usuário", role: profile.role as string };
}

const CONTRACT_COLUMNS = "id, contract_code, contract_title, status_signature, external_envelope_id, external_document_id, esignature_provider, parties";

type Party = { name?: string | null; email?: string | null; role?: string | null };

// GET /api/contracts/[id]/cancel-envelope: o que o modal mostra antes de confirmar.
// Somente leitura: estado do contrato e quem já assinou no envelope.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireRole();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const { data: contract } = await svc().from("operation_contracts").select(CONTRACT_COLUMNS).eq("id", id).single();
  if (!contract) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (contract.status_signature !== "enviado_assinatura" || !contract.external_envelope_id)
    return NextResponse.json({ error: "Este contrato não está enviado para assinatura." }, { status: 409 });
  if (contract.esignature_provider === "certone")
    return NextResponse.json({ error: "Cancelamento de envio ainda não está disponível para o CertOne." }, { status: 422 });

  const sig = await listClickSignSignEvents(contract.external_envelope_id);
  if (!sig.ok) return NextResponse.json({ error: `Falha ao consultar as assinaturas na ClickSign: ${sig.error}` }, { status: 502 });

  const signers = ((contract.parties as Party[] | null) ?? []).filter((p) => p.email?.trim()).map((p) => ({ name: p.name ?? p.email, email: p.email }));
  return NextResponse.json({
    ok: true,
    contract_code: contract.contract_code,
    contract_title: contract.contract_title,
    envelope_status: sig.envelopeStatus,
    signers,
    signed: sig.events.map((e) => ({ name: e.name, email: e.email, signed_at: e.signedAt })),
    can_cancel_partial: caller.role === "ADMIN",
  });
}

// POST /api/contracts/[id]/cancel-envelope: cancela o envio para assinatura e volta o contrato a
// rascunho (BRIEF 22/10/2026). Ordem: confere estado e assinaturas, cancela o documento na
// ClickSign, depois muda o banco numa transação (RPC). O banco só muda se o provedor confirmar;
// se o provedor cancelou e o banco falhou, repetir a chamada pula o cancelamento (a leitura do
// status do documento mostra "canceled") e conclui só o banco.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireRole();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { reason?: string; confirm_partial_signatures?: boolean };
  const reason = (body.reason ?? "").trim();
  if (reason.length < 5) return NextResponse.json({ error: "Informe o motivo do cancelamento (mínimo 5 caracteres)." }, { status: 422 });

  const db = svc();
  const { data: contract } = await db.from("operation_contracts").select(CONTRACT_COLUMNS).eq("id", id).single();
  if (!contract) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (contract.status_signature === "assinado")
    return NextResponse.json({ error: "Contrato já assinado: não é possível cancelar o envio. Use Atualizar status das assinaturas." }, { status: 409 });
  if (contract.status_signature !== "enviado_assinatura" || !contract.external_envelope_id)
    return NextResponse.json({ error: "Este contrato não está enviado para assinatura." }, { status: 409 });
  if (contract.esignature_provider === "certone")
    return NextResponse.json({ error: "Cancelamento de envio ainda não está disponível para o CertOne." }, { status: 422 });
  if (!contract.external_document_id)
    return NextResponse.json({ error: "Este contrato não tem o documento da ClickSign salvo. Cancele manualmente no painel da ClickSign." }, { status: 422 });

  const envelopeId: string = contract.external_envelope_id;
  const documentId: string = contract.external_document_id;

  // Assinaturas já colhidas (leitura; funciona também com o documento já cancelado).
  const sig = await listClickSignSignEvents(envelopeId);
  if (!sig.ok) return NextResponse.json({ error: `Falha ao consultar as assinaturas na ClickSign. Nada foi cancelado: ${sig.error}` }, { status: 502 });
  if (sig.envelopeStatus === "closed" || sig.envelopeStatus === "auto_closed")
    return NextResponse.json({ error: "O envelope já foi fechado: todos assinaram. Use Atualizar status das assinaturas." }, { status: 409 });

  const signed = sig.events.map((e) => ({ name: e.name, email: e.email, signed_at: e.signedAt }));
  if (signed.length > 0) {
    if (caller.role !== "ADMIN")
      return NextResponse.json({ error: "Já há assinatura neste envelope. Só o ADMIN pode cancelar com assinatura parcial.", code: "assinatura_parcial", signed }, { status: 403 });
    if (!body.confirm_partial_signatures)
      return NextResponse.json({ error: "Já há assinatura neste envelope. Confirme o cancelamento com assinatura parcial.", code: "assinatura_parcial", signed }, { status: 409 });
  }

  // Provedor: lê o status do DOCUMENTO e só chama cancel() se ainda estiver em aberto.
  const doc = await getClickSignDocumentStatus(envelopeId, documentId);
  if (!doc.ok) return NextResponse.json({ error: `Falha ao ler o documento na ClickSign. Nada foi cancelado: ${doc.error}` }, { status: 502 });

  let providerCancelled = false;
  if (doc.status === "running") {
    const result = await (await getProvider({ contractId: id, provider: contract.esignature_provider ?? undefined })).cancel(envelopeId, documentId);
    if (!result.ok)
      return NextResponse.json({ error: `A ClickSign recusou o cancelamento. O contrato não foi alterado. Cancele manualmente no painel da ClickSign. Detalhe: ${result.error}` }, { status: 502 });
    providerCancelled = true;
  } else if (doc.status === "canceled") {
    providerCancelled = true; // já cancelado lá: repetição só do banco
  } else {
    return NextResponse.json({ error: `O documento está com status "${doc.status}" na ClickSign e não pode ser cancelado por aqui.` }, { status: 409 });
  }

  const dbResult = await cancelEnvelopeInDb(db, { contractId: id, reason, actorId: caller.userId, actorName: caller.name, origin: "manual" });
  if (!dbResult.ok)
    return NextResponse.json({
      error: `O documento foi cancelado na ClickSign, mas o banco não concluiu: ${dbResult.error}. Use Concluir cancelamento (só o banco).`,
      provider_cancelled: providerCancelled,
      retry_database_only: true,
    }, { status: 500 });

  const parcial = signed.length > 0 ? ` Cancelado com assinatura parcial, confirmado pelo ADMIN; ${describeSigned(sig.events)}.` : "";
  const noteContent = dbResult.alreadyDone
    ? `Motivo do cancelamento do envio, informado por ${caller.name}: ${reason}.${parcial}`
    : `Envio para assinatura cancelado por ${caller.name}: ${reason}. Envelope ${envelopeId.slice(0, 8)} cancelado na ClickSign.${parcial}`;
  const noteError = await recordCancelNote(db, { contractId: id, authorId: caller.userId, authorName: caller.name, content: noteContent });

  return NextResponse.json({
    ok: true,
    contract_code: contract.contract_code,
    status: "rascunho",
    already_done: dbResult.alreadyDone,
    previously_signed: signed,
    note_warning: noteError ? "O cancelamento foi concluído, mas a anotação na linha do tempo não foi gravada. O registro oficial está na auditoria." : null,
  });
}
