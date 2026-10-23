// lib/contract-envelope-cancel.ts
//
// Cancelamento do envio para assinatura de um contrato (BRIEF 22/10/2026, QA de governança
// liberado na rodada 5). Compartilhado pela rota POST /api/contracts/[id]/cancel-envelope
// (botão, origem "manual") e pela detecção de cancelamento feito direto na ClickSign
// (cron clicksign-sync e "Atualizar status das assinaturas", origem "provedor").
//
// Cancelar o envio NÃO exclui o contrato: ele volta a rascunho, mantém o lote de qualificação
// e o texto. A volta é atômica na função de banco cancel_signature_envelope().
import type { SupabaseClient } from "@supabase/supabase-js";
import { SYSTEM_USER_ID } from "@/lib/contract-signature-timeline";
import { getClickSignDocumentStatus, listClickSignSignEvents } from "@/lib/esignature/clicksign-provider";

export const SYSTEM_ACTOR_NAME = "Sistema (sincronização ClickSign)";
const NOTE_TYPE = "cancelamento_envelope";

export interface EnvelopeContract {
  id: string;
  contract_code: string | null;
  contract_title?: string | null;
  external_envelope_id: string;
  external_document_id: string | null;
  esignature_provider: "clicksign" | "certone" | null;
}

export function formatBrDateTime(iso: string | null | undefined): string {
  if (!iso) return "data não informada";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "data não informada";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")} ${p("hour")}:${p("minute")}`;
}

export function describeSigned(events: Array<{ name: string; signedAt: string | null }>): string {
  if (events.length === 0) return "ninguém havia assinado";
  return `já haviam assinado: ${events.map((e) => `${e.name} (${formatBrDateTime(e.signedAt)})`).join("; ")}`;
}

export type CancelDbResult = { ok: true; alreadyDone: boolean } | { ok: false; error: string };

/**
 * Chama a função de banco. Se outro caminho (por exemplo o cron) já voltou o contrato a
 * rascunho entre o cancelamento no provedor e esta chamada, a função recusa por estado;
 * nesse caso relê o contrato e trata como sucesso idempotente (alreadyDone).
 */
export async function cancelEnvelopeInDb(
  db: SupabaseClient,
  p: { contractId: string; reason: string | null; actorId: string | null; actorName: string; origin: "manual" | "provedor" },
): Promise<CancelDbResult> {
  const { error } = await db.rpc("cancel_signature_envelope", {
    p_contract_id: p.contractId,
    p_reason: p.reason,
    p_actor_id: p.actorId,
    p_actor_name: p.actorName,
    p_origin: p.origin,
  });
  if (!error) return { ok: true, alreadyDone: false };

  const { data: now } = await db
    .from("operation_contracts")
    .select("status_signature, external_envelope_id")
    .eq("id", p.contractId)
    .maybeSingle();
  if (now && now.status_signature === "rascunho" && !now.external_envelope_id) return { ok: true, alreadyDone: true };
  return { ok: false, error: error.message };
}

/** Nota na linha do tempo, com await. Devolve a mensagem de erro, ou null se gravou. */
export async function recordCancelNote(
  db: SupabaseClient,
  p: { contractId: string; authorId: string | null; authorName: string; content: string },
): Promise<string | null> {
  const { error } = await db.from("contract_notes").insert({
    contract_id: p.contractId,
    author_id: p.authorId ?? SYSTEM_USER_ID,
    author_name: p.authorName,
    note_type: NOTE_TYPE,
    content: p.content,
  });
  if (error) {
    console.error(`[contract-envelope-cancel] falha ao gravar nota do contrato ${p.contractId}:`, error.message);
    return error.message;
  }
  return null;
}

/** Notificação interna (in-app, sem e-mail) a ADMIN e GESTAO. Best-effort, nunca derruba o fluxo. */
export async function notifyAdminsGestao(db: SupabaseClient, p: { title: string; message: string; contractId: string }): Promise<void> {
  const { data: profiles, error: readError } = await db.from("profiles").select("id").in("role", ["ADMIN", "GESTAO"]);
  if (readError || !profiles?.length) {
    if (readError) console.error("[contract-envelope-cancel] falha ao ler ADMIN/GESTAO:", readError.message);
    return;
  }
  const actionUrl = `https://app.v3partners.com.br/juridico/contratos?contract_id=${p.contractId}`;
  const { error } = await db.from("notifications").insert(
    profiles.map((u) => ({ user_id: u.id, title: p.title, message: p.message, type: "contrato_envio_cancelado", action_url: actionUrl, read: false })),
  );
  if (error) console.error("[contract-envelope-cancel] falha ao gravar notificações:", error.message);
}

export type ExternalCancelResult = "cancelado" | "expirado_avisado" | "nada" | "erro";

/**
 * Detecta cancelamento (ou vencimento) feito direto na ClickSign. Só lê a ClickSign; se o
 * documento estiver cancelado lá, volta o contrato a rascunho (origem "provedor", ator
 * Sistema), registra quem já havia assinado e avisa ADMIN e GESTAO. Não envia e-mail aos
 * signatários: o sistema não sabe por que cancelaram. Envelope vencido só gera aviso.
 */
export async function detectExternalCancel(
  db: SupabaseClient,
  contract: EnvelopeContract,
  triggeredBy?: string,
): Promise<ExternalCancelResult> {
  if (contract.esignature_provider === "certone" || !contract.external_document_id) return "nada";

  const doc = await getClickSignDocumentStatus(contract.external_envelope_id, contract.external_document_id);
  if (!doc.ok) {
    console.error(`[contract-envelope-cancel] falha ao ler o documento do contrato ${contract.id}: ${doc.error}`);
    return "erro";
  }

  const label = contract.contract_code ?? contract.id;
  const quem = triggeredBy ? ` Verificação acionada por ${triggeredBy}.` : "";

  if (doc.status === "canceled") {
    const sig = await listClickSignSignEvents(contract.external_envelope_id);
    const assinaturas = sig.ok ? describeSigned(sig.events) : "não foi possível consultar as assinaturas";
    const r = await cancelEnvelopeInDb(db, { contractId: contract.id, reason: null, actorId: null, actorName: SYSTEM_ACTOR_NAME, origin: "provedor" });
    if (!r.ok) {
      console.error(`[contract-envelope-cancel] falha ao voltar ${label} a rascunho: ${r.error}`);
      return "erro";
    }
    if (r.alreadyDone) return "nada";

    const noteError = await recordCancelNote(db, {
      contractId: contract.id,
      authorId: null,
      authorName: SYSTEM_ACTOR_NAME,
      content: `Cancelado direto na ClickSign, detectado em ${formatBrDateTime(new Date().toISOString())}. Motivo não informado. No momento do cancelamento, ${assinaturas}. O contrato voltou a rascunho.${quem}`,
    });
    if (noteError) console.error(`[contract-envelope-cancel] nota do cancelamento externo de ${label} não gravada: ${noteError}`);
    await notifyAdminsGestao(db, {
      title: `Envio cancelado na ClickSign: ${label}`,
      message: `O envelope do contrato ${label} foi cancelado direto na ClickSign e o contrato voltou a rascunho. Nenhum signatário foi avisado pelo sistema: cabe a quem atende o contrato avisá-los, por e-mail ou WhatsApp.`,
      contractId: contract.id,
    });
    return "cancelado";
  }

  if (doc.status === "expired") {
    const content = `Prazo do envelope vencido na ClickSign. O contrato continua como enviado para assinatura; cancele o envio ou reenvie.${quem}`;
    const { data: jaTem } = await db
      .from("contract_notes")
      .select("id")
      .eq("contract_id", contract.id)
      .eq("note_type", NOTE_TYPE)
      .like("content", "Prazo do envelope vencido na ClickSign%")
      .limit(1);
    if (jaTem && jaTem.length > 0) return "nada";
    await recordCancelNote(db, { contractId: contract.id, authorId: null, authorName: SYSTEM_ACTOR_NAME, content });
    await notifyAdminsGestao(db, {
      title: `Envelope vencido na ClickSign: ${label}`,
      message: `O prazo do envelope do contrato ${label} venceu na ClickSign. O contrato segue como enviado; decida entre cancelar o envio e reenviar.`,
      contractId: contract.id,
    });
    return "expirado_avisado";
  }

  return "nada";
}
