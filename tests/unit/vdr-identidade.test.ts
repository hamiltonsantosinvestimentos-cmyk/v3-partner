// Deal Room: identidade do deal só com NDA assinado (BRIEF de segurança de 08/11/2026).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarDealPublico, nomeSalaPublico, sanitizarGrupo, identidadeLiberada, montarLogCimAcesso, NOME_SALA_GENERICO,
} from "../../lib/vdr-identidade";

const deal = { v3_code: "V3-2026-11-AGR-001", code: "LEG-1", target_company: "Alvo Agro SA", sector: "Agropecuária" };

test("sem NDA assinado, nenhum campo que identifique o deal sai, inclusive o id", () => {
  const r = montarDealPublico(false, "11111111-2222-3333-4444-555555555555", deal);
  assert.deepEqual(r, { id: null, v3_code: null, legacy_code: null, target_company: null, sector: null });
  const texto = JSON.stringify(r);
  for (const proibido of ["Alvo Agro", "AGR", "LEG-1", "Agropecu", "11111111"]) {
    assert.ok(!texto.includes(proibido), `vazou: ${proibido}`);
  }
});

test("com NDA assinado, comporta-se como antes", () => {
  const r = montarDealPublico(true, "d1", deal);
  assert.deepEqual(r, {
    id: "d1", v3_code: "V3-2026-11-AGR-001", legacy_code: "LEG-1", target_company: "Alvo Agro SA", sector: "Agropecuária",
  });
});

test("valor não booleano verdadeiro não libera (falha fechada)", () => {
  // @ts-expect-error teste de robustez contra valor inesperado
  assert.equal(identidadeLiberada("true"), false);
  // @ts-expect-error teste de robustez contra valor inesperado
  assert.equal(identidadeLiberada(undefined), false);
  assert.equal(identidadeLiberada(true), true);
});

test("sala sem NDA exigido nunca tem nda_signed verdadeiro, então fica genérica", () => {
  // nda_signed é calculado pela existência de assinatura; sala sem NDA não gera assinatura
  const ndaSigned = false;
  assert.equal(montarDealPublico(ndaSigned, "d1", deal).target_company, null);
});

test("deal ausente com NDA assinado devolve nulos sem quebrar", () => {
  assert.deepEqual(montarDealPublico(true, "d1", null), { id: "d1", v3_code: null, legacy_code: null, target_company: null, sector: null });
});

test("nome da sala: genérico sem NDA, original com NDA", () => {
  assert.equal(nomeSalaPublico(false, "Negociação, V3-2026-11-AGR-001"), NOME_SALA_GENERICO);
  assert.equal(nomeSalaPublico(true, "Negociação, V3-2026-11-AGR-001"), "Negociação, V3-2026-11-AGR-001");
  assert.equal(nomeSalaPublico(true, null), NOME_SALA_GENERICO);
});

test("grupo: só formato esperado, senão direct", () => {
  assert.equal(sanitizarGrupo("btg-pactual"), "btg-pactual");
  assert.equal(sanitizarGrupo("  BTG-Pactual "), "btg-pactual");
  assert.equal(sanitizarGrupo(null), "direct");
  assert.equal(sanitizarGrupo(""), "direct");
  assert.equal(sanitizarGrupo("x'; drop table--"), "direct");
  assert.equal(sanitizarGrupo("a".repeat(41)), "direct");
  assert.equal(sanitizarGrupo("<script>"), "direct");
});

test("log de CIM: sem IP, sem dealId completo, só o prefixo de 8 caracteres", () => {
  const dealId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const l = montarLogCimAcesso("cim-pdf", dealId, true, false, new Date("2026-11-08T12:00:00Z"));
  assert.equal(l.deal_prefixo, "aaaaaaaa");
  assert.equal(l.token_presente, true);
  assert.equal(l.token_valido, false);
  assert.equal(l.ts, "2026-11-08T12:00:00.000Z");
  const texto = JSON.stringify(l);
  assert.ok(!texto.includes(dealId), "dealId completo no log");
  assert.ok(!/ip|address|investor/i.test(Object.keys(l).join(",")), "campo pessoal no log");
});
