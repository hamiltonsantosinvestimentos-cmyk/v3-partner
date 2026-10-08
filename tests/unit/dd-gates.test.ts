// Due Diligence, Entrega 2a: travas de decisor e de aceite do aviso (fail closed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { DD_DECISOR_ROLES, isDecisorRole, lgpdVersionAllowsPf, pfBlockReason, PF_BLOCK_TEXT } from "../../lib/cm/dd-gates";

test("decisor: cedente e mandatarios; demais posicoes e valores vazios negam", () => {
  for (const r of DD_DECISOR_ROLES) assert.equal(isDecisorRole(r), true, r);
  for (const r of ["intermediario_1", "intermediario_finder_venda", "testemunha", "partner", "estruturador", "head_mesa", "", null, undefined, "MANDATARIO", "mandatario "]) {
    assert.equal(isDecisorRole(r as string), false, String(r));
  }
});

test("aceite: igual ou posterior a minima; ausente, vazia ou desconhecida nega (fail closed)", () => {
  // minima = v2
  assert.equal(lgpdVersionAllowsPf("2026-10-08-v2", "2026-10-08-v2"), true);
  assert.equal(lgpdVersionAllowsPf("2026-10-05-v1", "2026-10-08-v2"), false, "v1 e anterior a v2");
  // minima = v1 (aceita v1 e v2)
  assert.equal(lgpdVersionAllowsPf("2026-10-05-v1", "2026-10-05-v1"), true);
  assert.equal(lgpdVersionAllowsPf("2026-10-08-v2", "2026-10-05-v1"), true);
  // fail closed
  assert.equal(lgpdVersionAllowsPf("2026-10-08-v2", undefined), false, "variavel ausente");
  assert.equal(lgpdVersionAllowsPf("2026-10-08-v2", ""), false, "variavel vazia");
  assert.equal(lgpdVersionAllowsPf("2026-10-08-v2", "2099-01-01-v9"), false, "variavel fora da lista");
  assert.equal(lgpdVersionAllowsPf(null, "2026-10-08-v2"), false, "parte sem aceite");
  assert.equal(lgpdVersionAllowsPf("versao-inventada", "2026-10-08-v2"), false, "versao desconhecida");
});

test("bloqueio de PF: decisor primeiro, depois aceite", () => {
  assert.equal(pfBlockReason("intermediario_1", "2026-10-08-v2", "2026-10-08-v2"), "nao_decisor");
  assert.equal(pfBlockReason("mandatario_1", "2026-10-05-v1", "2026-10-08-v2"), "aceite_pendente");
  assert.equal(pfBlockReason("parte_principal", "2026-10-05-v1", undefined), "aceite_pendente", "sem variavel: bloqueia");
  assert.equal(pfBlockReason("mandatario", "2026-10-08-v2", "2026-10-08-v2"), null);
  assert.equal(PF_BLOCK_TEXT.nao_decisor, "Disponível apenas para mandatário ou cedente decisor");
  assert.equal(PF_BLOCK_TEXT.aceite_pendente, "Aguardando aceite do novo Aviso de Privacidade");
});
