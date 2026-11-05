// "Alterar e-mail e reenviar" (BRIEF docs/briefs/2026-11-05_alterar-email-reenviar-contrato.md).
// Banco falso em memória e ClickSign simulada: cada estado de falha do BRIEF tem um teste.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AUDIT_CHANGED, AUDIT_FAILED, NOTE_TYPE_EMAIL_CHANGE, OPEN_BATCH_ERROR,
  countEmailMentions, editableParties, executeSignerEmailChange, maskEmail, normalizeEmail,
  qualificationBatchState, resolveMode, validateNewEmail,
  type ChangeContract, type ChangeDeps,
} from "../../lib/signer-email-change";
import { checkSendGates, type SendContract } from "../../lib/contract-send";

// ---------------------------------------------------------------------------
// Banco falso
type Row = Record<string, unknown>;
type FailFn = (table: string, op: string, nth: number) => string | null;

function fakeDb(tables: Record<string, Row[]>, failOn: FailFn = () => null) {
  const calls: Record<string, number> = {};
  const log: Array<{ table: string; op: string; payload?: unknown }> = [];
  const db = {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      let op = "select";
      let payload: Row | Row[] | null = null;
      let wantRows = false;
      let limitN: number | null = null;
      const run = () => {
        const key = `${table}.${op}`;
        calls[key] = (calls[key] ?? 0) + 1;
        log.push({ table, op, payload });
        const err = failOn(table, op, calls[key]);
        if (err) return { data: null, error: { message: err } };
        const rows = (tables[table] ??= []);
        if (op === "insert") {
          for (const r of Array.isArray(payload) ? payload : [payload as Row]) rows.push({ ...r });
          return { data: null, error: null };
        }
        let matched = rows.filter((r) => filters.every((f) => f(r)));
        if (op === "update") {
          for (const r of matched) Object.assign(r, structuredClone(payload));
          return { data: wantRows ? matched.map((r) => ({ id: r.id })) : null, error: null };
        }
        if (limitN !== null) matched = matched.slice(0, limitN);
        return { data: structuredClone(matched), error: null };
      };
      const q = {
        select() { if (op !== "select") wantRows = true; return q; },
        insert(p: Row | Row[]) { op = "insert"; payload = p; return q; },
        update(p: Row) { op = "update"; payload = p; return q; },
        eq(c: string, v: unknown) { filters.push((r) => r[c] === v); return q; },
        neq(c: string, v: unknown) { filters.push((r) => r[c] !== v); return q; },
        is(c: string, v: unknown) { filters.push((r) => (r[c] ?? null) === v); return q; },
        in(c: string, vs: unknown[]) { filters.push((r) => vs.includes(r[c])); return q; },
        limit(n: number) { limitN = n; return q; },
        maybeSingle() { const r = run(); return Promise.resolve({ data: r.error ? null : ((r.data as Row[])[0] ?? null), error: r.error }); },
        single() { return q.maybeSingle(); },
        then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) { return Promise.resolve(run()).then(res, rej); },
      };
      return q;
    },
  };
  return { db: db as unknown as SupabaseClient, log, tables };
}

// ---------------------------------------------------------------------------
// Contrato de exemplo
const CODE = "V3C-NDA-2026-0100";
function contractRow(over: Partial<ChangeContract> = {}): Row {
  return {
    id: "c1",
    template_id: null,
    vertical: "capital_markets",
    contract_title: "NDA Quadripartite",
    contract_code: CODE,
    status_signature: "enviado_assinatura",
    parties: [
      { role: "v3_partners", name: "V3 Partners", email: "deal@v3partners.com.br" },
      { role: "contraparte", name: "Fulano", email: "joao@gmail.com" },
      { role: "testemunha", name: "Testemunha", email: "test@x.com" },
    ],
    signing_token: "tok",
    rendered_html: "<p>Notificações para joao@gmail.com</p>",
    external_envelope_id: "env-1",
    external_document_id: "doc-1",
    esignature_provider: "clicksign",
    ...over,
  };
}

type Spy = { cancelProvider: number; cancelDb: number; send: number; gates: number };
function deps(db: SupabaseClient, over: Partial<ChangeDeps> = {}, spy: Spy = { cancelProvider: 0, cancelDb: 0, send: 0, gates: 0 }): ChangeDeps {
  return {
    db,
    listSignEvents: async () => ({ ok: true, envelopeStatus: "running", events: [] }),
    getDocumentStatus: async () => ({ ok: true, status: "running" }),
    cancelAtProvider: async () => { spy.cancelProvider++; return { ok: true }; },
    // Simula a função de banco: volta a rascunho e limpa o envelope.
    cancelInDb: async (d, p) => {
      spy.cancelDb++;
      const { data } = await d.from("operation_contracts").select("*").eq("id", p.contractId).maybeSingle();
      if (!data || (data as Row).status_signature !== "enviado_assinatura") return { ok: false, error: "estado" };
      await d.from("operation_contracts").update({ status_signature: "rascunho", external_envelope_id: null, external_document_id: null }).eq("id", p.contractId);
      return { ok: true, alreadyDone: false };
    },
    checkGates: async () => { spy.gates++; return null; },
    send: async (d, c) => {
      spy.send++;
      await d.from("operation_contracts").update({ status_signature: "enviado_assinatura", external_envelope_id: "env-2", external_document_id: "doc-2" }).eq("id", c.id);
      return { ok: true, envelopeId: "env-2", signatarios: (c.parties ?? []).length };
    },
    batchState: async () => ({ open: false, any: false }),
    formatDateTime: () => "05/11/2026 14:30",
    now: () => new Date("2026-11-05T17:30:00Z"),
    uuid: () => "req-1",
    ...over,
  };
}

const CALLER = { userId: "u-admin", name: "Hamilton" };
const BODY = {
  party_index: 1,
  new_email: " Joao.Novo@Gmail.com ",
  reason: "e-mail digitado errado",
  contract_code_confirm: CODE.toLowerCase(),
  ack_link_invalidated: true,
};

const contractOf = (t: Record<string, Row[]>) => t.operation_contracts[0] as Row & { parties: Array<{ email: string }> };
const audits = (t: Record<string, Row[]>) => (t.audit_logs ?? []) as Array<Row & { new_data: Row }>;

// ---------------------------------------------------------------------------
// Funções puras
test("normalizeEmail tira espaços e passa para minúsculas", () => {
  assert.equal(normalizeEmail("  Joao.Silva @Gmail.COM "), "joao.silva@gmail.com");
});

test("validateNewEmail: formato, igual ao atual, duplicado com outra parte", () => {
  const parties = contractRow().parties as SendContract["parties"];
  assert.deepEqual(validateNewEmail(parties, 1, "JOAO.NOVO@gmail.com "), { ok: true, email: "joao.novo@gmail.com" });
  assert.deepEqual(validateNewEmail(parties, 1, "joao@"), { ok: false, error: "E-mail inválido" });
  assert.deepEqual(validateNewEmail(parties, 1, "JOAO@gmail.com"), { ok: false, error: "É o mesmo e-mail atual" });
  assert.deepEqual(validateNewEmail(parties, 1, "Test@x.com"), { ok: false, error: "Este e-mail já é de outra parte do contrato: Testemunha" });
  assert.equal(validateNewEmail(parties, 9, "a@b.com").ok, false);
});

test("papéis v3_partners, estruturador e head_mesa não são editáveis; testemunha é", () => {
  const parties = [
    { role: "v3_partners", name: "V3", email: "a@v3.com" },
    { role: "estruturador", name: "E", email: "e@x.com" },
    { role: "head_mesa", name: "H", email: "h@x.com" },
    { role: "testemunha", name: "T", email: "t@x.com" },
    { role: "contraparte", name: "C", email: "c@x.com" },
  ];
  assert.deepEqual(editableParties(parties).map((p) => p.index), [3, 4]);
  assert.equal(validateNewEmail(parties, 2, "novo@x.com").ok, false);
});

test("maskEmail mostra só o começo do usuário", () => {
  assert.equal(maskEmail("joao@gmail.com"), "jo***@gmail.com");
  assert.equal(maskEmail("j@gmail.com"), "j***@gmail.com");
  assert.equal(maskEmail("sem-arroba"), "***");
});

test("countEmailMentions conta com fronteira e sem diferença de caixa", () => {
  const html = "joao@gmail.com, JOAO@GMAIL.COM. xjoao@gmail.com joao@gmail.com.br <b>joao@gmail.com</b>";
  assert.equal(countEmailMentions(html, "joao@gmail.com"), 3);
  assert.equal(countEmailMentions(null, "joao@gmail.com"), 0);
});

test("resolveMode: enviado sem envelope (legado) e CertOne são recusados", () => {
  const base = contractRow() as unknown as ChangeContract;
  assert.deepEqual(resolveMode(base), { mode: "envio" });
  assert.deepEqual(resolveMode({ ...base, status_signature: "aprovado" }), { mode: "rascunho" });
  assert.equal("error" in resolveMode({ ...base, external_envelope_id: null }), true);
  assert.equal("error" in resolveMode({ ...base, esignature_provider: "certone" }), true);
  assert.equal("error" in resolveMode({ ...base, status_signature: "assinado" }), true);
});

test("qualificationBatchState: lote com parte pendente bloqueia; lote concluído não", async () => {
  const pend = fakeDb({
    cm_qualification_batches: [{ id: "b1", operation_contract_id: "c1" }],
    cm_party_qualifications: [
      { id: "q1", batch_id: "b1", status: "preenchido", deleted_at: null },
      { id: "q2", batch_id: "b1", status: "pendente", deleted_at: null },
    ],
  });
  assert.deepEqual(await qualificationBatchState(pend.db, "c1"), { open: true, any: true });

  const done = fakeDb({
    cm_qualification_batches: [{ id: "b1", operation_contract_id: "c1" }],
    cm_party_qualifications: [
      { id: "q1", batch_id: "b1", status: "preenchido", deleted_at: null },
      { id: "q2", batch_id: "b1", status: "pendente", deleted_at: "2026-11-01" },
    ],
  });
  assert.deepEqual(await qualificationBatchState(done.db, "c1"), { open: false, any: true });

  const none = fakeDb({});
  assert.deepEqual(await qualificationBatchState(none.db, "c1"), { open: false, any: false });
});

// ---------------------------------------------------------------------------
// Orquestração
test("caminho feliz (enviado): cancela, troca, reenvia, audita 2x e grava nota", async () => {
  const f = fakeDb({ operation_contracts: [contractRow()] });
  const spy = { cancelProvider: 0, cancelDb: 0, send: 0, gates: 0 };
  const r = await executeSignerEmailChange(deps(f.db, {}, spy), CALLER, "c1", BODY);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.reenviado, true);
  assert.equal(r.body.new_email, "joao.novo@gmail.com");
  const c = contractOf(f.tables);
  assert.equal(c.parties[1].email, "joao.novo@gmail.com");
  assert.equal(c.status_signature, "enviado_assinatura");
  assert.equal(c.rendered_html, "<p>Notificações para joao@gmail.com</p>"); // texto nunca muda
  assert.deepEqual(spy, { cancelProvider: 1, cancelDb: 1, send: 1, gates: 2 });
  assert.deepEqual(audits(f.tables).map((a) => [a.action, a.new_data.resultado, a.new_data.request_id]),
    [[AUDIT_CHANGED, "solicitado", "req-1"], [AUDIT_CHANGED, "concluido", "req-1"]]);
  assert.equal((audits(f.tables)[0].old_data as Row).email_antigo, "joao@gmail.com");
  const note = (f.tables.contract_notes ?? [])[0] as Row;
  assert.equal(note.note_type, NOTE_TYPE_EMAIL_CHANGE);
  assert.match(String(note.content), /de jo\*\*\*@gmail\.com para joao\.novo@gmail\.com, só para o envio \(o texto do contrato não foi alterado\)/);
  assert.match(String(note.content), /Reenviado para assinatura \(3 signatário\(s\)\)/);
});

test("GESTAO/MESA_OPERACIONAL: a rota só aceita ADMIN (requireAdmin devolve 403)", async () => {
  // A conferência de papel fica na rota; aqui garantimos que o texto da rota exige ADMIN.
  const fs = await import("node:fs");
  const src = fs.readFileSync("app/api/contracts/[id]/change-signer-email/route.ts", "utf-8");
  assert.match(src, /profile\.role !== "ADMIN"\) return \{ status: 403 \}/);
});

test("pré-voo bloqueando: nada é cancelado nem alterado", async () => {
  const f = fakeDb({ operation_contracts: [contractRow()] });
  const spy = { cancelProvider: 0, cancelDb: 0, send: 0, gates: 0 };
  const r = await executeSignerEmailChange(deps(f.db, { checkGates: async () => ({ status: 422, error: "Head diferente" }) }, spy), CALLER, "c1", BODY);
  assert.equal(r.status, 422);
  assert.match(String(r.body.error), /Nada foi alterado\. Head diferente/);
  assert.equal(spy.cancelProvider + spy.cancelDb, 0);
  assert.equal(contractOf(f.tables).parties[1].email, "joao@gmail.com");
  assert.equal(audits(f.tables).length, 0);
});

test("pré-voo recebe as partes já trocadas", async () => {
  const f = fakeDb({ operation_contracts: [contractRow()] });
  let seen: string | undefined;
  await executeSignerEmailChange(deps(f.db, { checkGates: async (_d, c) => { seen ??= c.parties?.[1].email ?? undefined; return null; } }), CALLER, "c1", BODY);
  assert.equal(seen, "joao.novo@gmail.com");
});

test("ClickSign recusa o cancelamento: nada muda", async () => {
  const f = fakeDb({ operation_contracts: [contractRow()] });
  const r = await executeSignerEmailChange(deps(f.db, { cancelAtProvider: async () => ({ ok: false, error: "recusado" }) }), CALLER, "c1", BODY);
  assert.equal(r.status, 502);
  assert.match(String(r.body.error), /A ClickSign recusou o cancelamento\. Nada foi alterado/);
  assert.equal(contractOf(f.tables).status_signature, "enviado_assinatura");
  assert.equal(contractOf(f.tables).parties[1].email, "joao@gmail.com");
  assert.equal(audits(f.tables).length, 0);
});

test("banco falha depois do cancelamento: retry, e a repetição conclui", async () => {
  const f = fakeDb({ operation_contracts: [contractRow()] });
  const r1 = await executeSignerEmailChange(deps(f.db, {
    cancelInDb: async () => ({ ok: false, error: "timeout" }),
  }), CALLER, "c1", BODY);
  assert.equal(r1.status, 500);
  assert.equal(r1.body.retry, true);
  assert.equal(contractOf(f.tables).parties[1].email, "joao@gmail.com");

  // Repetição: o documento já está "canceled" lá, não cancela de novo.
  const spy = { cancelProvider: 0, cancelDb: 0, send: 0, gates: 0 };
  const r2 = await executeSignerEmailChange(deps(f.db, { getDocumentStatus: async () => ({ ok: true, status: "canceled" }) }, spy), CALLER, "c1", BODY);
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.equal(spy.cancelProvider, 0);
  assert.equal(spy.cancelDb, 1);
  assert.equal(contractOf(f.tables).parties[1].email, "joao.novo@gmail.com");
});

test("auditoria falha: e-mail não trocado, contrato em rascunho, mensagem certa", async () => {
  const f = fakeDb({ operation_contracts: [contractRow()] }, (t, op) => (t === "audit_logs" && op === "insert" ? "audit down" : null));
  const r = await executeSignerEmailChange(deps(f.db), CALLER, "c1", BODY);
  assert.equal(r.status, 500);
  assert.match(String(r.body.error), /O envio antigo foi cancelado, mas o e-mail não foi trocado \(falha ao gravar a auditoria: audit down\)\. O contrato está em Rascunho\. Abra Alterar e-mail do signatário de novo para concluir\./);
  assert.equal(contractOf(f.tables).status_signature, "rascunho");
  assert.equal(contractOf(f.tables).parties[1].email, "joao@gmail.com");
});

test("update com 0 linhas: nada trocado e change_failed gravado", async () => {
  // Outro processo muda o status entre o cancelamento e o update.
  const f = fakeDb({ operation_contracts: [contractRow()] });
  const d = deps(f.db, {
    cancelInDb: async (db, p) => {
      await db.from("operation_contracts").update({ status_signature: "aprovado", external_envelope_id: null }).eq("id", p.contractId);
      return { ok: true, alreadyDone: false };
    },
  });
  const r = await executeSignerEmailChange(d, CALLER, "c1", BODY);
  assert.equal(r.status, 409);
  assert.equal(contractOf(f.tables).parties[1].email, "joao@gmail.com");
  const a = audits(f.tables);
  assert.deepEqual(a.map((x) => x.action), [AUDIT_CHANGED, AUDIT_FAILED]);
  assert.equal(a[1].new_data.request_id, "req-1");
});

test("update com erro do banco: nada trocado e change_failed gravado", async () => {
  const f = fakeDb({ operation_contracts: [contractRow()] }, (t, op, n) => (t === "operation_contracts" && op === "update" && n === 2 ? "deadlock" : null));
  const r = await executeSignerEmailChange(deps(f.db), CALLER, "c1", BODY);
  assert.equal(r.status, 500);
  assert.match(String(r.body.error), /deadlock/);
  assert.equal(contractOf(f.tables).parties[1].email, "joao@gmail.com");
  assert.equal(audits(f.tables).at(-1)?.action, AUDIT_FAILED);
});

test("troca em rascunho: sem ClickSign e sem reenvio", async () => {
  const f = fakeDb({ operation_contracts: [contractRow({ status_signature: "rascunho", external_envelope_id: null, external_document_id: null })] });
  const spy = { cancelProvider: 0, cancelDb: 0, send: 0, gates: 0 };
  let clicksign = 0;
  const r = await executeSignerEmailChange(deps(f.db, {
    listSignEvents: async () => { clicksign++; return { ok: true, envelopeStatus: "running", events: [] }; },
    getDocumentStatus: async () => { clicksign++; return { ok: true, status: "running" }; },
  }, spy), CALLER, "c1", { ...BODY, ack_link_invalidated: undefined });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.reenviado, false);
  assert.equal(clicksign + spy.cancelProvider + spy.cancelDb + spy.send, 0);
  assert.equal(contractOf(f.tables).parties[1].email, "joao.novo@gmail.com");
  assert.equal(contractOf(f.tables).status_signature, "rascunho");
  assert.match(String((f.tables.contract_notes[0] as Row).content), /Sem envio nesta etapa/);
});

test("reenvio falha: rascunho com o e-mail novo e mensagem de reenvio", async () => {
  const f = fakeDb({ operation_contracts: [contractRow()] });
  const r = await executeSignerEmailChange(deps(f.db, { send: async () => ({ ok: false, status: 502, error: "Falha ao enviar para o ClickSign: 500" }) }), CALLER, "c1", BODY);
  assert.equal(r.status, 200);
  assert.equal(r.body.reenviado, false);
  assert.match(String(r.body.erro_reenvio), /^O envio antigo foi cancelado e o e-mail foi corrigido, mas o reenvio falhou: .*Use Enviar para Assinatura\.$/);
  assert.equal(contractOf(f.tables).status_signature, "rascunho");
  assert.equal(contractOf(f.tables).parties[1].email, "joao.novo@gmail.com");
});

test("lote de qualificação aberto: bloqueado antes de tudo", async () => {
  const f = fakeDb({ operation_contracts: [contractRow()] });
  const spy = { cancelProvider: 0, cancelDb: 0, send: 0, gates: 0 };
  const r = await executeSignerEmailChange(deps(f.db, { batchState: async () => ({ open: true, any: true }) }, spy), CALLER, "c1", BODY);
  assert.equal(r.status, 422);
  assert.equal(r.body.error, OPEN_BATCH_ERROR);
  assert.equal(spy.gates + spy.cancelProvider, 0);
});

test("lote concluído: não bloqueia e a nota cita o registro da qualificação", async () => {
  const f = fakeDb({ operation_contracts: [contractRow()] });
  const r = await executeSignerEmailChange(deps(f.db, { batchState: async () => ({ open: false, any: true }) }), CALLER, "c1", BODY);
  assert.equal(r.status, 200);
  assert.match(String((f.tables.contract_notes[0] as Row).content), /qualificação de partes mantém o e-mail antigo/);
});

test("legado enviado sem envelope: POST recusa sem alterar", async () => {
  const f = fakeDb({ operation_contracts: [contractRow({ external_envelope_id: null })] });
  const r = await executeSignerEmailChange(deps(f.db), CALLER, "c1", BODY);
  assert.equal(r.status, 409);
  assert.equal(contractOf(f.tables).parties[1].email, "joao@gmail.com");
});

test("assinatura parcial exige confirmação; com confirmação, a nota lista quem assinou", async () => {
  const signed = { ok: true as const, envelopeStatus: "running", events: [{ name: "Testemunha", email: "test@x.com", signedAt: "2026-11-04T13:00:00Z" }] };
  const f = fakeDb({ operation_contracts: [contractRow()] });
  const r1 = await executeSignerEmailChange(deps(f.db, { listSignEvents: async () => signed }), CALLER, "c1", BODY);
  assert.equal(r1.status, 409);
  assert.equal(r1.body.code, "assinatura_parcial");
  const r2 = await executeSignerEmailChange(deps(f.db, { listSignEvents: async () => signed }), CALLER, "c1", { ...BODY, confirm_partial_signatures: true });
  assert.equal(r2.status, 200);
  assert.match(String((f.tables.contract_notes[0] as Row).content), /Assinaturas perdidas, confirmado pelo ADMIN: Testemunha/);
});

test("validações: código errado, motivo curto, sem ciência do link, papel não editável", async () => {
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ contract_code_confirm: "OUTRO" }, /código digitado não confere/],
    [{ reason: "abc" }, /mínimo 5 caracteres/],
    [{ ack_link_invalidated: false }, /link de assinatura/],
    [{ party_index: 0 }, /não pode ser alterado/],
  ];
  for (const [over, re] of cases) {
    const f = fakeDb({ operation_contracts: [contractRow()] });
    const r = await executeSignerEmailChange(deps(f.db), CALLER, "c1", { ...BODY, ...over });
    assert.equal(r.status, 422);
    assert.match(String(r.body.error), re);
  }
});

test("duas trocas seguidas: cada uma com o seu request_id", async () => {
  const f = fakeDb({ operation_contracts: [contractRow()] });
  let n = 0;
  const d = () => deps(f.db, { uuid: () => `req-${++n}` });
  assert.equal((await executeSignerEmailChange(d(), CALLER, "c1", BODY)).status, 200);
  assert.equal((await executeSignerEmailChange(d(), CALLER, "c1", { ...BODY, new_email: "terceiro@gmail.com" })).status, 200);
  assert.equal(contractOf(f.tables).parties[1].email, "terceiro@gmail.com");
  assert.deepEqual([...new Set(audits(f.tables).map((a) => a.new_data.request_id))], ["req-1", "req-2"]);
  assert.equal(contractOf(f.tables).rendered_html, "<p>Notificações para joao@gmail.com</p>");
});

// ---------------------------------------------------------------------------
// Refatoração do `send`: os mesmos bloqueios com as mesmas mensagens.
const noHead = { checkHead: async () => null };
const sendBase = (over: Partial<SendContract> = {}): SendContract => ({
  ...(contractRow({ status_signature: "rascunho" }) as unknown as SendContract), ...over,
});

test("send: parte com nome e sem e-mail", async () => {
  const g = await checkSendGates(fakeDb({}).db, sendBase({ parties: [{ role: "contraparte", name: "Fulano", email: "" }] }), noHead);
  assert.deepEqual(g, { status: 422, error: "Contrato não pode ser enviado: 1 parte(s) sem e-mail cadastrado (Fulano). Corrija antes de enviar." });
});

test("send: Head da Mesa bloqueia com a mensagem do gate", async () => {
  const g = await checkSendGates(fakeDb({}).db, sendBase(), { checkHead: async () => "Head diferente" });
  assert.deepEqual(g, { status: 422, error: "Head diferente" });
});

test("send: contato desligado no texto bloqueia", async () => {
  const g = await checkSendGates(fakeDb({}).db, sendBase({ rendered_html: "luis.athaydes@v3partners.com.br" }), noHead);
  assert.equal(g?.status, 422);
  assert.match(g!.error, /Athaydes/);
});

test("send: signatário duplicado", async () => {
  const g = await checkSendGates(fakeDb({}).db, sendBase({ parties: [
    { role: "contraparte", name: "A", email: "x@y.com" }, { role: "contraparte", name: "B", email: "X@y.com" },
  ] }), noHead);
  assert.deepEqual(g, { status: 422, error: "Contrato não pode ser enviado: signatário duplicado (mesmo e-mail em mais de uma parte): x@y.com (A / B). Corrija as partes antes de enviar." });
});

test("send: só testemunhas", async () => {
  const g = await checkSendGates(fakeDb({}).db, sendBase({ parties: [{ role: "testemunha", name: "T", email: "t@x.com" }] }), noHead);
  assert.equal(g?.error, "Contrato não pode ser enviado: só há testemunha(s) cadastrada(s), falta a(s) parte(s) principal(is) (contraparte e/ou V3 Partners). Verifique o array de partes antes de reenviar.");
});

test("send: LOI não casada exige 3/3", async () => {
  const f = fakeDb({ contract_approvals: [{ contract_id: "c1", decision: "aprovado" }] });
  const g = await checkSendGates(f.db, sendBase({ loi_matching_status: "nao_casada", loi_override_justification: "urgente" }), noHead);
  assert.equal(g?.status, 422);
  assert.match(g!.error, /hoje: 1\/3/);
});

test("send: contrato válido passa e o gate não olha o status", async () => {
  assert.equal(await checkSendGates(fakeDb({}).db, sendBase({ status_signature: "enviado_assinatura" }), noHead), null);
});
