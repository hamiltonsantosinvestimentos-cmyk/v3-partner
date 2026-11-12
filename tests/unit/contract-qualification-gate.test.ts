// Gate de envio da conferência da qualificação e carregador (BRIEF 11/11/2026, seção 4.5).
// Lógica pura mais um banco falso: sem rede. Rodar com `npm run test:unit`.
// Todos os nomes, números e e-mails abaixo são inventados. Nunca colocar aqui dado real de cliente,
// parte de contrato ou deal: o repositório é público.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkQualificationGate,
  decidirGateDeQualificacao,
  justificativaTemDocumento,
} from "../../lib/contract-qualification-gate";
import { achatarRepresentacao, qualificationRowsToParties, type QualificationGateRow } from "../../lib/contract-qualification-load";
import type { QFinding } from "../../lib/contract-qualification-check";

// CPFs e CNPJ de exemplo com dígito verificador válido, usados em material didático.
const CPF_A = "529.982.247-25";
const CPF_B = "111.444.777-35";
const CPF_HEAD = "123.456.789-09";
const CNPJ_OK = "11.222.333/0001-81";

const f = (id: QFinding["id"], severity: QFinding["severity"] = "bloqueia", role = "partner"): QFinding => ({ id, severity, role, message: `${id}: teste` });

// Banco falso: from(tabela).select(colunas).eq(coluna, valor).is(coluna, null) devolve {data, error}.
function bancoFalso(resposta: { data: unknown; error: { message: string } | null }): SupabaseClient {
  const cadeia = { select: () => cadeia, eq: () => cadeia, is: () => Promise.resolve(resposta) };
  return { from: () => cadeia } as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// justificativa
// ---------------------------------------------------------------------------

test("justificativaTemDocumento: acha CPF e CNPJ com ou sem pontuação, não acha texto comum", () => {
  assert.equal(justificativaTemDocumento("conferi com a identidade de 52998224725"), true);
  assert.equal(justificativaTemDocumento("CPF 529.982.247-25 confere"), true);
  assert.equal(justificativaTemDocumento("empresa 11.222.333/0001-81"), true);
  assert.equal(justificativaTemDocumento("documento original conferido pela mesa em 11/11"), false);
});

// ---------------------------------------------------------------------------
// decisão pura
// ---------------------------------------------------------------------------

test("sem bloqueio, ou só com alerta, envia", () => {
  assert.equal(decidirGateDeQualificacao([], { role: "GESTAO" }).ok, true);
  assert.equal(decidirGateDeQualificacao([f("Q-03", "alerta"), f("Q-06", "alerta")], { role: "MESA_OPERACIONAL" }).ok, true);
});

test("Q-01, Q-04, Q-05 e Q-07 bloqueiam sem override, nem o ADMIN com justificativa passa", () => {
  for (const id of ["Q-01", "Q-04", "Q-05", "Q-07"] as const) {
    const r = decidirGateDeQualificacao([f(id)], { role: "ADMIN", justificativa: "documento original conferido pela mesa" });
    assert.equal(r.ok, false, id);
    if (!r.ok) {
      assert.equal(r.status, 422);
      assert.equal(r.podeOverride, false);
    }
  }
});

test("Q-02 sem justificativa: bloqueia, e só o ADMIN vê a opção de override", () => {
  const admin = decidirGateDeQualificacao([f("Q-02")], { role: "ADMIN" });
  const gestao = decidirGateDeQualificacao([f("Q-02")], { role: "GESTAO" });
  assert.equal(admin.ok, false);
  assert.equal(gestao.ok, false);
  if (!admin.ok && !gestao.ok) {
    assert.equal(admin.podeOverride, true);
    assert.equal(gestao.podeOverride, false);
    assert.equal(admin.status, 422);
  }
});

test("Q-02 com justificativa: GESTAO recebe 403, ADMIN passa e o override é devolvido", () => {
  const just = "documento original conferido, identidade com o mesmo número do CPF";
  const gestao = decidirGateDeQualificacao([f("Q-02")], { role: "GESTAO", justificativa: just });
  assert.equal(gestao.ok, false);
  if (!gestao.ok) assert.equal(gestao.status, 403);

  const admin = decidirGateDeQualificacao([f("Q-02")], { role: "ADMIN", justificativa: just });
  assert.equal(admin.ok, true);
  if (admin.ok) assert.deepEqual(admin.overridden, ["Q-02"]);
});

test("override: justificativa vazia, curta, longa ou com CPF é recusada", () => {
  const base = [f("Q-02")];
  const curta = decidirGateDeQualificacao(base, { role: "ADMIN", justificativa: "ok ok" });
  const longa = decidirGateDeQualificacao(base, { role: "ADMIN", justificativa: "x".repeat(501) });
  const comCpf = decidirGateDeQualificacao(base, { role: "ADMIN", justificativa: "conferido, CPF 529.982.247-25 está certo" });
  const vazia = decidirGateDeQualificacao(base, { role: "ADMIN", justificativa: "   " });
  for (const r of [curta, longa, comCpf, vazia]) assert.equal(r.ok, false);
  if (!comCpf.ok) assert.match(comCpf.error, /CPF nem CNPJ/);
});

test("Q-02 junto de Q-04: o override não cobre, bloqueia", () => {
  const r = decidirGateDeQualificacao([f("Q-02"), f("Q-04")], { role: "ADMIN", justificativa: "documento original conferido pela mesa" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.podeOverride, false);
});

test("a mensagem do bloqueio traz o ID e o papel, e nenhum número de documento", () => {
  const r = decidirGateDeQualificacao([f("Q-02", "bloqueia", "intermediario_1")], { role: "GESTAO" });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.match(r.error, /Q-02 \(intermediario_1\)/);
    assert.ok(!/\d{6,}/.test(r.error), "não pode carregar número de documento");
  }
});

// ---------------------------------------------------------------------------
// carregador
// ---------------------------------------------------------------------------

test("achatarRepresentacao: percorre a cadeia, ignora nó vazio e respeita a profundidade", () => {
  const cadeia = { cpf_cnpj: CPF_A, rg: "1", representation: { cpf_cnpj: CPF_B, representation: { id_number: "AB1234" } } };
  assert.equal(achatarRepresentacao(cadeia).length, 3);
  assert.deepEqual(achatarRepresentacao(null), []);
  assert.deepEqual(achatarRepresentacao({ representation: null }), []);
  let infinita: Record<string, unknown> = { cpf_cnpj: CPF_A };
  for (let i = 0; i < 20; i++) infinita = { cpf_cnpj: CPF_A, representation: infinita };
  assert.ok(achatarRepresentacao(infinita).length <= 6);
});

test("qualificationRowsToParties: o Head entra pelas partes do contrato e ninguém entra duas vezes", () => {
  const linhas: QualificationGateRow[] = [
    { role_in_document: "partner", party_nature: "PJ", company_name: "ALFA LTDA", company_cnpj: CNPJ_OK, representation: { cpf_cnpj: CPF_A } },
    { role_in_document: "intermediario_1", party_nature: "PF", cpf_cnpj: CPF_B },
  ];
  const partes = qualificationRowsToParties(linhas, [
    { role: "head_mesa", name: "HEAD", doc: CPF_HEAD },
    { role: "partner", name: "ALFA", doc: CNPJ_OK },
    { role: "intermediario_1", name: "FULANO", doc: null },
  ]);
  assert.deepEqual(partes.map((p) => p.role), ["partner", "intermediario_1", "head_mesa"]);
  assert.equal(partes[0].nature, "PJ");
  assert.equal(partes[0].representatives?.length, 1);
});

// ---------------------------------------------------------------------------
// gate completo com banco falso
// ---------------------------------------------------------------------------

const linhaComDefeito: QualificationGateRow = {
  role_in_document: "intermediario_1",
  party_nature: "PJ",
  company_name: "ALFA'LO GESTÃO LTDA",
  cnpj_razao_social: "ALFA'LO GESTAO LTDA",
  company_cnpj: CNPJ_OK,
  representation: { cpf_cnpj: CPF_A, rg: "52998224725", id_type: "rg" },
};

test("gate completo: identidade igual ao CPF bloqueia o GESTAO, mas oferece override ao ADMIN", async () => {
  const db = bancoFalso({ data: [linhaComDefeito], error: null });
  const contrato = { qualification_batch_id: "lote-1", parties: [{ role: "head_mesa", name: "HEAD", doc: CPF_HEAD }] };
  const gestao = await checkQualificationGate(db, contrato, { role: "GESTAO" });
  const admin = await checkQualificationGate(db, contrato, { role: "ADMIN" });
  assert.equal(gestao.ok, false);
  assert.equal(admin.ok, false);
  if (!gestao.ok && !admin.ok) {
    assert.equal(gestao.podeOverride, false);
    assert.equal(admin.podeOverride, true);
    assert.deepEqual(admin.findings.map((x) => x.id), ["Q-02"]);
  }
});

test("gate completo: ADMIN com justificativa válida envia e o override sai com a regra Q-02", async () => {
  const db = bancoFalso({ data: [linhaComDefeito], error: null });
  const r = await checkQualificationGate(db, { qualification_batch_id: "lote-1", parties: [] }, {
    role: "ADMIN", justificativa: "documento original conferido pela mesa, número igual ao do CPF",
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.overridden, ["Q-02"]);
});

test("gate completo: falha de leitura do banco fecha o envio (500), nunca libera", async () => {
  const db = bancoFalso({ data: null, error: { message: "boom" } });
  const r = await checkQualificationGate(db, { qualification_batch_id: "lote-1", parties: [] }, { role: "ADMIN" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 500);
});

test("gate completo: contrato sem lote de qualificação e sem defeito passa", async () => {
  const db = bancoFalso({ data: [], error: null });
  const r = await checkQualificationGate(db, { qualification_batch_id: null, parties: [{ role: "head_mesa", name: "HEAD", doc: CPF_HEAD }] }, { role: "GESTAO" });
  assert.equal(r.ok, true);
});

test("gate completo: o Head que também representa uma parte não gera Q-07", async () => {
  const db = bancoFalso({
    data: [{ role_in_document: "partner", party_nature: "PJ", company_cnpj: CNPJ_OK, representation: { cpf_cnpj: CPF_HEAD } }],
    error: null,
  });
  const r = await checkQualificationGate(db, {
    qualification_batch_id: "lote-1",
    parties: [{ role: "head_mesa", name: "HEAD", doc: CPF_HEAD }],
  }, { role: "GESTAO" });
  assert.equal(r.ok, true);
});

test("gate completo: o mesmo CPF em duas partes que não são o Head bloqueia sem override", async () => {
  const db = bancoFalso({
    data: [
      { role_in_document: "partner", party_nature: "PF", cpf_cnpj: CPF_A },
      { role_in_document: "mandatario", party_nature: "PF", cpf_cnpj: "52998224725" },
    ],
    error: null,
  });
  const r = await checkQualificationGate(db, { qualification_batch_id: "lote-1", parties: [] }, { role: "ADMIN", justificativa: "documento original conferido pela mesa" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.podeOverride, false);
});

import { q08NaoConferidas } from "../../lib/contract-qualification-gate";

const CORTE = "2026-11-12T01:13:56Z";
const linha = (o: Partial<{ role_in_document: string; status: string; filled_at: string | null; conferida_em: string | null }>) => ({
  role_in_document: "partner", status: "preenchido", filled_at: "2026-11-12T03:00:00Z", conferida_em: null, ...o,
});

test("Q-08: parte preenchida depois do corte e sem conferência bloqueia", () => {
  assert.deepEqual(q08NaoConferidas([linha({})], CORTE).length, 1);
});
test("Q-08: parte preenchida antes do corte fica isenta", () => {
  assert.deepEqual(q08NaoConferidas([linha({ filled_at: "2026-11-10T10:00:00Z" })], CORTE), []);
});
test("Q-08: parte conferida passa", () => {
  assert.deepEqual(q08NaoConferidas([linha({ conferida_em: "2026-11-12T04:00:00Z" })], CORTE), []);
});
test("Q-08: sem corte definido não barra", () => {
  assert.deepEqual(q08NaoConferidas([linha({})], null), []);
});
test("Q-08: corte inválido não barra", () => {
  assert.deepEqual(q08NaoConferidas([linha({})], "texto"), []);
});
test("Q-08: pendente não entra (é outro bloqueio)", () => {
  assert.deepEqual(q08NaoConferidas([linha({ status: "pendente", filled_at: null })], CORTE), []);
});
test("Q-08: papel repetido aparece uma vez", () => {
  assert.equal(q08NaoConferidas([linha({}), linha({})], CORTE).length, 1);
});
