// Papéis de parte da qualificação (BRIEF 23/10/2026): Partner Externo e Interveniente Anuente.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROLE_HELP, ROLE_LABELS, partyRoleSortKey, roleOptionsSorted, sortQualificationParties } from "../../lib/qualification-roles";
import { isDecisorRole } from "../../lib/cm/dd-gates";

// Lista do CHECK cm_party_qualifications_role_in_document_check (migration 20261023a).
const CHECK_ROLES = [
  "parte_principal", "intermediario_finder_venda", "intermediario_finder_compra", "mandatario", "testemunha",
  "finder_originacao_venda", "finder_originacao_compra", "intermediario_venda", "intermediario_compra",
  "estruturador", "head_mesa", "partner", "mandatario_1", "mandatario_2",
  "intermediario_1", "intermediario_2", "intermediario_3", "intermediario_4", "intermediario_5",
  "intermediario_6", "intermediario_7", "intermediario_8", "intermediario_9", "intermediario_10",
  "partner_externo", "interveniente_anuente",
];

test("todo papel do dicionário está no CHECK do banco, e o inverso", () => {
  assert.deepEqual(Object.keys(ROLE_LABELS).sort(), [...CHECK_ROLES].sort());
});

test("rótulos novos e notas do porquê", () => {
  assert.equal(ROLE_LABELS.partner_externo, "Partner Externo");
  assert.equal(ROLE_LABELS.interveniente_anuente, "Interveniente Anuente");
  assert.ok(ROLE_HELP.partner_externo && ROLE_HELP.interveniente_anuente);
  assert.equal(ROLE_HELP.partner, undefined, "o Partner existente não muda");
  for (const txt of Object.values(ROLE_HELP)) assert.ok(!txt.includes("—"), "sem travessão");
});

test("ordem canônica: Estruturador, Head, Partner, Partner Externo, Interveniente, Mandatário, Intermediários, Testemunha", () => {
  const roles = ["testemunha", "intermediario_2", "mandatario_1", "interveniente_anuente", "partner_externo", "partner", "head_mesa", "estruturador", "intermediario_1"];
  const sorted = sortQualificationParties(roles.map((role_in_document) => ({ role_in_document }))).map((p) => p.role_in_document);
  assert.deepEqual(sorted, ["estruturador", "head_mesa", "partner", "partner_externo", "interveniente_anuente", "mandatario_1", "intermediario_1", "intermediario_2", "testemunha"]);
  assert.deepEqual(partyRoleSortKey("partner_externo"), [2, 1]);
  assert.deepEqual(partyRoleSortKey("interveniente_anuente"), [2, 2]);
  assert.deepEqual(partyRoleSortKey("partner"), [2, 0], "o Partner existente não muda de posição");
});

test("seletor em ordem alfabética pt-BR, com números em ordem numérica", () => {
  const labels = roleOptionsSorted().map(([, label]) => label);
  assert.equal(labels.length, Object.keys(ROLE_LABELS).length);
  assert.deepEqual(labels, [...labels].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })));
  assert.ok(labels.indexOf("Intermediário 2") < labels.indexOf("Intermediário 10"), "2 antes de 10");
  assert.ok(labels.includes("Partner Externo") && labels.includes("Interveniente Anuente"));
});

test("os dois papéis novos são não decisores em due diligence (fail closed)", () => {
  assert.equal(isDecisorRole("partner_externo"), false);
  assert.equal(isDecisorRole("interveniente_anuente"), false);
});
