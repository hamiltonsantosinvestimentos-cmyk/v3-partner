// lib/signer-email-change.ts
//
// "Alterar e-mail e reenviar" da Central de Contratos (BRIEF
// docs/briefs/2026-11-05_alterar-email-reenviar-contrato.md, go do Hamilton em 05/11/2026,
// com override das falhas de compliance B1 e B2 da rodada 6 do QA).
//
// Troca o e-mail de UMA parte na lista de signatários (`parties`) e, se o contrato
// estava enviado, cancela o envelope na ClickSign e envia de novo. O TEXTO do contrato
// (rendered_html / PDF estampado) nunca é alterado aqui: decisão do Hamilton, a troca
// vale só para o envio.
//
// Ordem (nada externo acontece antes de todas as validações e do pré-voo dos bloqueios
// do envio, rodado com as partes já trocadas em memória):
//   valida -> pré-voo -> (lê assinaturas -> cancela na ClickSign -> cancela no banco)
//   -> auditoria "solicitado" -> grava parties -> auditoria "concluido"
//   -> (reenvia) -> nota na linha do tempo
// As dependências externas entram por `ChangeDeps` para os testes simularem cada falha.
import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidEmail } from "@/lib/utils";
import type { CancelDbResult } from "@/lib/contract-envelope-cancel";
import type { GateError, SendContract, SendParty, SendResult } from "@/lib/contract-send";

export const NOTE_TYPE_EMAIL_CHANGE = "alteracao_email_signatario";
export const AUDIT_CHANGED = "contract_signer_email_changed";
export const AUDIT_FAILED = "contract_signer_email_change_failed";

/** Papéis que nunca são editados aqui: V3, estruturador e Head da Mesa vêm do cadastro interno. */
export const NON_EDITABLE_ROLES: ReadonlyArray<string> = ["v3_partners", "estruturador", "head_mesa"];

export const CHANGE_CONTRACT_COLUMNS =
  "id, template_id, vertical, contract_title, contract_code, status_signature, parties, signing_token, signature_message, signature_subject, is_master_agreement, stamped_document_path, loi_matching_status, loi_override_justification, rendered_html, external_envelope_id, external_document_id, esignature_provider";

export type ChangeContract = SendContract & {
  external_envelope_id: string | null;
  external_document_id: string | null;
  esignature_provider: "clicksign" | "certone" | null;
};

export type ChangeMode = "envio" | "rascunho";

export function isEditableRole(role: string | null | undefined): boolean {
  return !NON_EDITABLE_ROLES.includes((role ?? "").trim());
}

/** Tira todo espaço e passa para minúsculas. */
export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, "").toLowerCase();
}

/** Signatários editáveis, na ordem do array `parties` (o índice é o do array original). */
export function editableParties(parties: SendParty[] | null | undefined): Array<{ index: number; name: string; role: string; email: string }> {
  return (parties ?? [])
    .map((p, index) => ({ index, name: p.name ?? "", role: p.role, email: p.email ?? "" }))
    .filter((p) => isEditableRole(p.role));
}

export type EmailValidation = { ok: true; email: string } | { ok: false; error: string };

/** Mesmas mensagens que o modal mostra embaixo do campo. */
export function validateNewEmail(parties: SendParty[] | null | undefined, index: number, raw: string | null | undefined): EmailValidation {
  const list = parties ?? [];
  const party = Number.isInteger(index) ? list[index] : undefined;
  if (!party) return { ok: false, error: "Signatário não encontrado no contrato." };
  if (!isEditableRole(party.role)) return { ok: false, error: "O e-mail desta parte não pode ser alterado por aqui." };
  const email = normalizeEmail(raw);
  if (!email || !isValidEmail(email)) return { ok: false, error: "E-mail inválido" };
  if (email === normalizeEmail(party.email)) return { ok: false, error: "É o mesmo e-mail atual" };
  const other = list.find((p, i) => i !== index && normalizeEmail(p.email) === email);
  if (other) return { ok: false, error: `Este e-mail já é de outra parte do contrato: ${other.name ?? "sem nome"}` };
  return { ok: true, email };
}

/** "joao@gmail.com" -> "jo***@gmail.com". Usado na nota da linha do tempo. */
export function maskEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim();
  const at = e.lastIndexOf("@");
  if (at <= 0) return "***";
  return `${e.slice(0, Math.min(2, at))}***${e.slice(at)}`;
}

/**
 * Quantas vezes o texto do contrato cita o e-mail, com fronteira (não conta
 * "xjoao@gmail.com" nem "joao@gmail.com.br" ao procurar "joao@gmail.com"). Sem diferença de caixa.
 */
export function countEmailMentions(html: string | null | undefined, email: string | null | undefined): number {
  const e = (email ?? "").trim();
  if (!html || !e) return 0;
  const escaped = e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![A-Za-z0-9._%+-])${escaped}(?![A-Za-z0-9-]|\\.[A-Za-z0-9])`, "gi");
  return (html.match(re) ?? []).length;
}

export type BatchState = { open: boolean; any: boolean };

/**
 * Lote de qualificação aberto: existe lote do contrato com pelo menos uma parte
 * não excluída e ainda não preenchida. É a mesma condição que dispara a mescla de
 * `parties` em app/api/cm/qualificacao/[token]/route.ts, que reinseriria a parte com
 * o e-mail do lote. Erro de leitura sobe como exceção: na dúvida, nada é alterado.
 */
export async function qualificationBatchState(db: SupabaseClient, contractId: string): Promise<BatchState> {
  const { data: batches, error } = await db.from("cm_qualification_batches").select("id").eq("operation_contract_id", contractId);
  if (error) throw new Error(`falha ao ler os lotes de qualificação: ${error.message}`);
  const ids = ((batches as Array<{ id: string }> | null) ?? []).map((b) => b.id);
  if (ids.length === 0) return { open: false, any: false };
  const { data: pend, error: pErr } = await db
    .from("cm_party_qualifications")
    .select("id")
    .in("batch_id", ids)
    .is("deleted_at", null)
    .neq("status", "preenchido")
    .limit(1);
  if (pErr) throw new Error(`falha ao ler as partes em qualificação: ${pErr.message}`);
  return { open: ((pend as unknown[] | null) ?? []).length > 0, any: true };
}

export const OPEN_BATCH_ERROR = "Há qualificação de partes em andamento neste contrato. Conclua a qualificação antes de alterar o e-mail.";

/** Estado de partida do contrato; erro (status + mensagem) quando não aceita a troca. */
export function resolveMode(c: ChangeContract): { mode: ChangeMode } | GateError {
  if (c.status_signature === "assinado") return { status: 409, error: "Contrato já assinado: o e-mail dos signatários não pode mais ser alterado." };
  if (c.status_signature === "rascunho" || c.status_signature === "aprovado") return { mode: "rascunho" };
  if (c.status_signature === "enviado_assinatura") {
    if (!c.external_envelope_id) return { status: 409, error: "Este contrato está como enviado, mas sem envelope salvo. Fale com o administrador do sistema." };
    if (c.esignature_provider === "certone") return { status: 422, error: "Ainda não disponível para o CertOne." };
    if (!c.external_document_id) return { status: 422, error: "Este contrato não tem o documento da ClickSign salvo. Cancele manualmente no painel da ClickSign." };
    return { mode: "envio" };
  }
  return { status: 409, error: `Contrato em status "${c.status_signature}" não aceita alteração de e-mail.` };
}

export type SignEvent = { name: string; email: string; signedAt: string | null };

export interface ChangeDeps {
  db: SupabaseClient;
  listSignEvents(envelopeId: string): Promise<{ ok: true; envelopeStatus: string | null; events: SignEvent[] } | { ok: false; error: string }>;
  getDocumentStatus(envelopeId: string, documentId: string): Promise<{ ok: true; status: string } | { ok: false; error: string }>;
  cancelAtProvider(contract: ChangeContract, envelopeId: string, documentId: string): Promise<{ ok: boolean; error?: string }>;
  cancelInDb(db: SupabaseClient, p: { contractId: string; reason: string | null; actorId: string | null; actorName: string; origin: "manual" | "provedor" }): Promise<CancelDbResult>;
  checkGates(db: SupabaseClient, contract: SendContract): Promise<GateError | null>;
  send(db: SupabaseClient, contract: SendContract): Promise<SendResult>;
  batchState(db: SupabaseClient, contractId: string): Promise<BatchState>;
  formatDateTime(iso: string): string;
  now(): Date;
  uuid(): string;
}

export interface ChangeInput {
  party_index?: unknown;
  new_email?: unknown;
  reason?: unknown;
  contract_code_confirm?: unknown;
  ack_link_invalidated?: unknown;
  confirm_partial_signatures?: unknown;
}

export type ChangeResponse = { status: number; body: Record<string, unknown> };

const fail = (status: number, error: string, extra: Record<string, unknown> = {}): ChangeResponse => ({ status, body: { error, ...extra } });

function describeSignedEvents(events: SignEvent[], fmt: (iso: string) => string): string {
  return events.map((e) => `${e.name} (${e.signedAt ? fmt(e.signedAt) : "data não informada"})`).join("; ");
}

export async function executeSignerEmailChange(
  deps: ChangeDeps,
  caller: { userId: string; name: string },
  contractId: string,
  input: ChangeInput,
): Promise<ChangeResponse> {
  const { db } = deps;
  const requestId = deps.uuid();

  // 2. Validações (nada muda se falhar).
  const { data: row, error: readErr } = await db.from("operation_contracts").select(CHANGE_CONTRACT_COLUMNS).eq("id", contractId).maybeSingle();
  if (readErr) return fail(500, `Falha ao ler o contrato: ${readErr.message}`);
  if (!row) return fail(404, "Contrato não encontrado");
  const contract = row as unknown as ChangeContract;

  const m = resolveMode(contract);
  if ("error" in m) return fail(m.status, m.error);
  const mode = m.mode;

  let batch: BatchState;
  try {
    batch = await deps.batchState(db, contractId);
  } catch (e) {
    return fail(500, `Nada foi alterado: ${(e as Error).message}`);
  }
  if (batch.open) return fail(422, OPEN_BATCH_ERROR);

  const partyIndex = typeof input.party_index === "number" ? input.party_index : Number.NaN;
  const parties = contract.parties ?? [];
  const v = validateNewEmail(parties, partyIndex, typeof input.new_email === "string" ? input.new_email : "");
  if (!v.ok) return fail(422, v.error);
  const newEmail = v.email;
  const party = parties[partyIndex];
  const oldEmail = (party.email ?? "").trim();
  const partyName = party.name ?? oldEmail;

  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < 5) return fail(422, "Informe o motivo (mínimo 5 caracteres).");

  const code = typeof input.contract_code_confirm === "string" ? input.contract_code_confirm.trim().toUpperCase() : "";
  if (!contract.contract_code || code !== contract.contract_code.trim().toUpperCase())
    return fail(422, "O código digitado não confere com o código do contrato.");

  if (mode === "envio" && input.ack_link_invalidated !== true)
    return fail(422, "Confirme que o link de assinatura já enviado deixa de valer.");

  // 3. Pré-voo: os bloqueios do envio, com a parte já trocada em memória.
  const newParties: SendParty[] = parties.map((p, i) => (i === partyIndex ? { ...p, email: newEmail } : p));
  const gate = await deps.checkGates(db, { ...contract, parties: newParties });
  if (gate) return fail(gate.status, `Nada foi alterado. ${gate.error}`);

  let signed: SignEvent[] = [];
  let envelopeId: string | null = null;
  let alreadyCancelled = false;

  if (mode === "envio") {
    envelopeId = contract.external_envelope_id as string;
    const documentId = contract.external_document_id as string;

    // 4. Assinaturas já colhidas.
    const sig = await deps.listSignEvents(envelopeId);
    if (!sig.ok) return fail(502, `Falha ao consultar as assinaturas na ClickSign. Nada foi alterado: ${sig.error}`);
    if (sig.envelopeStatus === "closed" || sig.envelopeStatus === "auto_closed")
      return fail(409, "O envelope já foi fechado: todos assinaram. Use Atualizar status das assinaturas.");
    signed = sig.events;
    if (signed.length > 0 && input.confirm_partial_signatures !== true)
      return fail(409, "Já há assinatura neste envelope. Confirme que as assinaturas já feitas serão perdidas.", {
        code: "assinatura_parcial",
        signed: signed.map((s) => ({ name: s.name, email: s.email, signed_at: s.signedAt })),
      });

    // 5. Cancela na ClickSign só se o documento ainda estiver em aberto.
    const doc = await deps.getDocumentStatus(envelopeId, documentId);
    if (!doc.ok) return fail(502, `Falha ao ler o documento na ClickSign. Nada foi alterado: ${doc.error}`);
    if (doc.status === "running") {
      const r = await deps.cancelAtProvider(contract, envelopeId, documentId);
      if (!r.ok) return fail(502, `A ClickSign recusou o cancelamento. Nada foi alterado. Detalhe: ${r.error ?? "sem detalhe"}`);
    } else if (doc.status !== "canceled") {
      return fail(409, `O documento está com status "${doc.status}" na ClickSign e não pode ser cancelado por aqui. Nada foi alterado.`);
    }

    // 6. Cancela no banco (volta a rascunho, atômico, auditoria do cancelamento).
    const dbr = await deps.cancelInDb(db, {
      contractId,
      reason: `Alteração de e-mail do signatário: ${reason}`,
      actorId: caller.userId,
      actorName: caller.name,
      origin: "manual",
    });
    if (!dbr.ok)
      return fail(500, `O envelope foi cancelado na ClickSign, mas o banco não concluiu (${dbr.error}). Clique em Tentar de novo.`, { retry: true });
    alreadyCancelled = dbr.alreadyDone;
  }

  const expectedStatus = mode === "envio" ? "rascunho" : contract.status_signature;
  const stateAfterCancel = mode === "envio"
    ? "O envio antigo foi cancelado, mas o e-mail não foi trocado"
    : "Nada foi alterado: o e-mail não foi trocado";
  const tailAfterCancel = mode === "envio" ? " O contrato está em Rascunho. Abra Alterar e-mail do signatário de novo para concluir." : "";

  // 7. Auditoria do pedido (com await: sem auditoria, não troca).
  const oldData = { party_index: partyIndex, nome: party.name ?? null, role: party.role, email_antigo: oldEmail };
  const baseNew = { request_id: requestId, email_novo: newEmail, motivo: reason, envelope_id: envelopeId, modo: mode };
  const { error: auditErr } = await db.from("audit_logs").insert({
    user_id: caller.userId, user_name: caller.name, action: AUDIT_CHANGED, entity: "operation_contracts", entity_id: contractId,
    old_data: oldData, new_data: { ...baseNew, resultado: "solicitado" },
  });
  if (auditErr) return fail(500, `${stateAfterCancel} (falha ao gravar a auditoria: ${auditErr.message}).${tailAfterCancel}`);

  // 8. Grava a troca: relê as partes e só troca se a parte ainda tem o e-mail antigo.
  const recordFailure = async (motivo: string) => {
    const { error } = await db.from("audit_logs").insert({
      user_id: caller.userId, user_name: caller.name, action: AUDIT_FAILED, entity: "operation_contracts", entity_id: contractId,
      old_data: oldData, new_data: { ...baseNew, resultado: "falhou", erro: motivo },
    });
    if (error) console.error(`[signer-email-change] falha ao gravar ${AUDIT_FAILED} do contrato ${contractId}:`, error.message);
  };

  const { data: fresh, error: freshErr } = await db.from("operation_contracts").select("parties, status_signature").eq("id", contractId).maybeSingle();
  const freshParties = ((fresh as { parties?: SendParty[] | null } | null)?.parties ?? null);
  const freshParty = freshParties?.[partyIndex];
  if (freshErr || !freshParties || !freshParty || normalizeEmail(freshParty.email) !== normalizeEmail(oldEmail)) {
    const motivo = freshErr ? freshErr.message : "a lista de signatários mudou durante a operação";
    await recordFailure(motivo);
    return fail(409, `${stateAfterCancel} (${motivo}).${tailAfterCancel}`);
  }
  const updatedParties = freshParties.map((p, i) => (i === partyIndex ? { ...p, email: newEmail } : p));
  const { data: upd, error: updErr } = await db
    .from("operation_contracts")
    .update({ parties: updatedParties })
    .eq("id", contractId)
    .eq("status_signature", expectedStatus)
    .select("id");
  const updRows = ((upd as unknown[] | null) ?? []).length;
  if (updErr || updRows !== 1) {
    const motivo = updErr ? updErr.message : `nenhuma linha atualizada (status esperado "${expectedStatus}")`;
    await recordFailure(motivo);
    return fail(updErr ? 500 : 409, `${stateAfterCancel} (${motivo}).${tailAfterCancel}`);
  }

  const warnings: string[] = [];
  const { error: doneErr } = await db.from("audit_logs").insert({
    user_id: caller.userId, user_name: caller.name, action: AUDIT_CHANGED, entity: "operation_contracts", entity_id: contractId,
    old_data: oldData, new_data: { ...baseNew, resultado: "concluido" },
  });
  if (doneErr) warnings.push("O e-mail foi trocado, mas o registro de conclusão na auditoria não foi gravado (o pedido ficou registrado).");

  // 9. Reenvio (modo envio), com o contrato relido do banco.
  let reenviado = false;
  let signatarios = 0;
  let erroReenvio: string | null = null;
  if (mode === "envio") {
    const { data: again, error: againErr } = await db.from("operation_contracts").select(CHANGE_CONTRACT_COLUMNS).eq("id", contractId).maybeSingle();
    if (againErr || !again) {
      erroReenvio = againErr?.message ?? "contrato não encontrado ao reenviar";
    } else {
      const c2 = again as unknown as ChangeContract;
      const g2 = await deps.checkGates(db, c2);
      if (g2) erroReenvio = g2.error;
      else {
        const sent = await deps.send(db, c2);
        if (sent.ok) { reenviado = true; signatarios = sent.signatarios; }
        else erroReenvio = sent.error;
      }
    }
  }

  // 10. Nota na linha do tempo (com await; falha vira aviso).
  const when = deps.formatDateTime(deps.now().toISOString());
  let content = `E-mail de ${partyName} alterado por ${caller.name} em ${when}, de ${maskEmail(oldEmail)} para ${newEmail}, só para o envio (o texto do contrato não foi alterado). Motivo: ${reason}.`;
  if (mode === "envio") {
    content += alreadyCancelled ? " O envelope antigo já estava cancelado." : " Envelope antigo cancelado na ClickSign.";
    if (signed.length > 0) content += ` Assinaturas perdidas, confirmado pelo ADMIN: ${describeSignedEvents(signed, deps.formatDateTime)}.`;
    content += reenviado
      ? ` Reenviado para assinatura (${signatarios} signatário(s)).`
      : ` O reenvio falhou (${erroReenvio}); o contrato ficou em Rascunho.`;
  } else {
    content += " Sem envio nesta etapa.";
  }
  if (batch.any) content += " O registro da qualificação de partes mantém o e-mail antigo.";
  const { error: noteErr } = await db.from("contract_notes").insert({
    contract_id: contractId, author_id: caller.userId, author_name: caller.name, note_type: NOTE_TYPE_EMAIL_CHANGE, content,
  });
  if (noteErr) warnings.push("A troca foi concluída, mas a anotação na linha do tempo não foi gravada. O registro oficial está na auditoria.");

  // 11. Resposta.
  return {
    status: 200,
    body: {
      ok: true,
      modo: mode,
      reenviado,
      signatarios,
      party_name: partyName,
      new_email: newEmail,
      erro_reenvio: erroReenvio
        ? `O envio antigo foi cancelado e o e-mail foi corrigido, mas o reenvio falhou: ${erroReenvio}. Use Enviar para Assinatura.`
        : null,
      aviso_nota: warnings.length > 0 ? warnings.join(" ") : null,
    },
  };
}
