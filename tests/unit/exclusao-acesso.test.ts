// Exclusão de documento de qualificação: matriz de papel e permissão (BRIEF Permissões do Analista de Mesa, 17/11/2026).
// Dado só inventado.
import test from "node:test";
import assert from "node:assert/strict";
import {
  FEATURE_EXCLUIR_DOCUMENTO,
  decidirExclusao,
  featureConcedivel,
  podeExcluirDocumento,
  statusDoErroDeExclusao,
} from "../../lib/cm/exclusao-acesso";

function dbCom(retorno: { data: unknown; error: { message: string } | null }) {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => retorno }) }) }),
    }),
  } as never;
}

test("ADMIN e GESTAO excluem sem permissão individual", () => {
  assert.equal(decidirExclusao("ADMIN", false), true);
  assert.equal(decidirExclusao("GESTAO", false), true);
});

test("Analista de Mesa exclui só com a permissão", () => {
  assert.equal(decidirExclusao("MESA_OPERACIONAL", false), false);
  assert.equal(decidirExclusao("MESA_OPERACIONAL", true), true);
});

test("outros papéis nunca excluem, mesmo com a permissão gravada", () => {
  for (const r of ["PARTNER", "PARTNER_PRO", "INSTITUICAO", "FINANCEIRO", "MESA", "STARTER", "", null, undefined]) {
    assert.equal(decidirExclusao(r as never, true), false, String(r));
  }
});

test("sócio não consulta a tabela de permissões", async () => {
  const db = { from: () => { throw new Error("não deveria consultar"); } } as never;
  assert.equal(await podeExcluirDocumento(db, "u1", "ADMIN"), true);
  assert.equal(await podeExcluirDocumento(db, "u1", "GESTAO"), true);
});

test("analista com a linha concedida pode; sem a linha não pode", async () => {
  assert.equal(await podeExcluirDocumento(dbCom({ data: { id: "x" }, error: null }), "u1", "MESA_OPERACIONAL"), true);
  assert.equal(await podeExcluirDocumento(dbCom({ data: null, error: null }), "u1", "MESA_OPERACIONAL"), false);
});

test("erro de leitura da permissão fecha (nega)", async () => {
  assert.equal(await podeExcluirDocumento(dbCom({ data: null, error: { message: "boom" } }), "u1", "MESA_OPERACIONAL"), false);
});

test("partner nunca exclui, ainda que haja linha", async () => {
  assert.equal(await podeExcluirDocumento(dbCom({ data: { id: "x" }, error: null }), "u1", "PARTNER"), false);
});

test("só a chave de excluir documento é concedível pela tela (lista fechada)", () => {
  assert.equal(featureConcedivel(FEATURE_EXCLUIR_DOCUMENTO), true);
  for (const f of ["bolsa_compliance_dashboard", "due_diligence_qualificacao", "contratos", "", null, 1]) {
    assert.equal(featureConcedivel(f), false, String(f));
  }
});

test("código do banco para status HTTP: 42501, P0429, P0001 e o resto", () => {
  assert.equal(statusDoErroDeExclusao("42501"), 403);
  assert.equal(statusDoErroDeExclusao("P0429"), 429);
  assert.equal(statusDoErroDeExclusao("P0001"), 409);
  assert.equal(statusDoErroDeExclusao("XX000"), 500);
  assert.equal(statusDoErroDeExclusao(null), 500);
});

import { validarPedidoPermissao } from "../../lib/cm/exclusao-acesso";

const U1 = "11111111-1111-4111-8111-111111111111";
const ADM = "22222222-2222-4222-8222-222222222222";

test("pedido de permissão: usuário inválido, chave fora da lista, autoalteração e alvo que não é analista", () => {
  assert.deepEqual(validarPedidoPermissao({ user_id: "x", feature: FEATURE_EXCLUIR_DOCUMENTO }, ADM, "MESA_OPERACIONAL"), { ok: false, status: 422, erro: "Usuário inválido." });
  assert.equal((validarPedidoPermissao({ user_id: U1, feature: "bolsa_compliance_dashboard" }, ADM, "MESA_OPERACIONAL") as { status: number }).status, 422);
  assert.equal((validarPedidoPermissao({ user_id: ADM, feature: FEATURE_EXCLUIR_DOCUMENTO }, ADM, "MESA_OPERACIONAL") as { status: number }).status, 403);
  assert.equal((validarPedidoPermissao({ user_id: U1, feature: FEATURE_EXCLUIR_DOCUMENTO }, ADM, "PARTNER") as { status: number }).status, 422);
  assert.equal((validarPedidoPermissao({ user_id: U1, feature: FEATURE_EXCLUIR_DOCUMENTO }, ADM, null) as { status: number }).status, 422);
  assert.equal((validarPedidoPermissao(null, ADM, "MESA_OPERACIONAL") as { status: number }).status, 422);
});

test("pedido de permissão: analista com chave da lista é aceito", () => {
  const v = validarPedidoPermissao({ user_id: U1, feature: FEATURE_EXCLUIR_DOCUMENTO }, ADM, "MESA_OPERACIONAL");
  assert.equal(v.ok, true);
});
