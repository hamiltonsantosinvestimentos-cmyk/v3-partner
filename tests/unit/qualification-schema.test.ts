// Registro unico de campos da qualificacao de partes (BRIEF 30/09/2026, Fase 1A).
// Logica pura: sem banco, sem rede. Rodar com `npm run test:unit`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_DOCUMENT_KINDS,
  FIELD_MATRIX,
  ID_TYPES,
  INSTRUMENT_DOCUMENT_KIND,
  ISO_COUNTRY_CODES,
  MARITAL_STATUS,
  UF_LIST,
  buildAddressText,
  composeIdentity,
  countryName,
  countryOptions,
  formatCep,
  isCpfWaived,
  isValidPassportNumber,
  maritalStatusProse,
  missingIdentityParts,
  nationalityProse,
  normalizePassportNumber,
  passportDocumentKey,
  requiredFields,
  sortPt,
  type QualificationProfile,
} from "../../lib/qualification-schema";

const MIGRATION_COLUNAS = readFileSync(
  join(__dirname, "..", "..", "supabase", "migrations", "20260930c_qualificacao_padronizada_colunas.sql"),
  "utf8",
);

test("sortPt ordena em pt-BR e acentuadas nao caem no fim", () => {
  const out = sortPt(["Último", "Abacaxi", "Éden", "Zebra"], (x) => x);
  assert.deepEqual(out, ["Abacaxi", "Éden", "Último", "Zebra"]);
});

test("sortPt nao muta a entrada", () => {
  const input = ["b", "a"];
  sortPt(input, (x) => x);
  assert.deepEqual(input, ["b", "a"]);
});

test("estado civil: 5 valores, em ordem alfabetica, texto neutro", () => {
  assert.equal(MARITAL_STATUS.length, 5);
  assert.deepEqual(
    MARITAL_STATUS.map((e) => e.label),
    ["Casado(a)", "Divorciado(a)", "Solteiro(a)", "União Estável", "Viúvo(a)"],
  );
  assert.equal(maritalStatusProse("uniao_estavel"), "em união estável");
  assert.equal(maritalStatusProse("casado"), "casado(a)");
  assert.equal(maritalStatusProse("mg"), null);
  assert.equal(maritalStatusProse(null), null);
});

test("nacionalidade: br e outra", () => {
  assert.equal(nationalityProse("br"), "brasileiro(a)");
  assert.equal(nationalityProse("outra", "  Norte-Americano(a), "), "norte-americano(a)");
  assert.equal(nationalityProse("outra", ""), null);
  assert.equal(nationalityProse("brasil"), null);
});

test("identidade composta: um exemplo por tipo", () => {
  assert.equal(composeIdentity({ id_type: "rg", id_number: "98.765.432", id_issuer: "ssp", id_issuer_uf: "mg" }), "RG 98.765.432 SSP/MG");
  assert.equal(composeIdentity({ id_type: "cnh", id_number: "01234567890", id_issuer: "DETRAN", id_issuer_uf: "SP" }), "CNH 01234567890 DETRAN/SP");
  assert.equal(composeIdentity({ id_type: "oab", id_number: "123.456", id_issuer_uf: "MG" }), "OAB/MG 123.456");
  assert.equal(composeIdentity({ id_type: "passaporte", id_number: "x1234567", id_country: "us" }), "Passaporte X1234567 (US)");
  assert.equal(composeIdentity({ id_type: "outro", id_number: "ab 12", id_issuer: "xyz", id_issuer_uf: "RJ" }), "Documento AB 12 XYZ/RJ");
});

test("identidade incompleta devolve null e lista o que falta", () => {
  assert.equal(composeIdentity({ id_type: "rg", id_number: "123" }), null);
  assert.deepEqual(missingIdentityParts({ id_type: "rg", id_number: "123" }), ["id_issuer", "id_issuer_uf"]);
  assert.deepEqual(missingIdentityParts({ id_type: "passaporte" }), ["id_number", "id_country"]);
  assert.deepEqual(missingIdentityParts({}), ["id_type"]);
});

test("passaporte: numero plausivel e chave canonica", () => {
  assert.equal(normalizePassportNumber("x-123 456"), "X123456");
  assert.equal(isValidPassportNumber("X123456"), true);
  assert.equal(isValidPassportNumber("0000000"), false);
  assert.equal(isValidPassportNumber("AAAAAA"), false);
  assert.equal(isValidPassportNumber("1234"), false);
  assert.equal(isValidPassportNumber("A".repeat(21)), false);
  assert.equal(passportDocumentKey("US", "X123456"), "PP:US:X123456");
});

test("passaporte: teste de ida e volta, gravar e buscar chegam na mesma chave", () => {
  assert.equal(passportDocumentKey("US", "x-123 456"), passportDocumentKey("us", "X123456"));
  assert.equal(passportDocumentKey("us", "X123456"), "PP:US:X123456");
});

test("passaporte: pais invalido ou numero trivial nao gera chave", () => {
  assert.equal(passportDocumentKey("ZZ", "X123456"), null);
  assert.equal(passportDocumentKey("US", "0"), null);
  assert.equal(passportDocumentKey(null, "X123456"), null);
});

test("a chave do passaporte nunca colide com CPF ou CNPJ (tem dois-pontos)", () => {
  const key = passportDocumentKey("BR", "AB123456") as string;
  assert.ok(key.includes(":"));
  assert.equal(/^[0-9A-Z]{11,14}$/.test(key), false);
});

test("paises: 249 codigos ISO unicos e todos com nome em portugues", () => {
  assert.equal(ISO_COUNTRY_CODES.length, 249);
  assert.equal(new Set(ISO_COUNTRY_CODES).size, 249);
  const semNome = ISO_COUNTRY_CODES.filter((c) => countryName(c) === c);
  assert.deepEqual(semNome, []);
  assert.equal(countryName("US"), "Estados Unidos");
  assert.equal(countryName("BR"), "Brasil");
});

test("paises: dropdown em ordem alfabetica pt-BR", () => {
  const names = countryOptions().map((c) => c.name);
  const sorted = [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
  assert.deepEqual(names, sorted);
});

test("UF: 27 siglas em ordem alfabetica", () => {
  assert.equal(UF_LIST.length, 27);
  assert.deepEqual([...UF_LIST], [...UF_LIST].sort());
});

test("endereco no formato do manual v4", () => {
  assert.equal(
    buildAddressText({ rua: "Rua das Acácias", numero: "120", complemento: "ap. 302", bairro: "Centro", cidade: "Belo Horizonte", estado: "mg", cep: "30140000" }),
    "Rua das Acácias, 120, ap. 302 - CEP 30140-000 - Centro, Belo Horizonte/MG",
  );
  assert.equal(
    buildAddressText({ rua: "Rua A", numero: "45", bairro: "Centro", cidade: "Belo Horizonte", estado: "MG", cep: "30150-010" }),
    "Rua A, 45 - CEP 30150-010 - Centro, Belo Horizonte/MG",
  );
});

test("endereco aceita S/N e nunca monta pela metade", () => {
  assert.equal(
    buildAddressText({ rua: "Estrada X", numero: "s/n", bairro: "Zona Rural", cidade: "Sorocaba", estado: "SP", cep: "18000000" }),
    "Estrada X, S/N - CEP 18000-000 - Zona Rural, Sorocaba/SP",
  );
  assert.equal(buildAddressText({ rua: "Rua A", numero: "1", bairro: "B", cidade: "C", estado: "SP" }), null);
  assert.equal(buildAddressText({ rua: "Rua A", numero: "1", bairro: "B", cidade: "C", estado: "XX", cep: "01310100" }), null);
  assert.equal(buildAddressText({ rua: "Rua A", numero: "1", bairro: "B", cidade: "C", estado: "SP", cep: "0131" }), null);
  assert.equal(formatCep("01310100"), "01310-100");
  assert.equal(formatCep("123"), null);
});

test("matriz: toda linha tem os 8 perfis", () => {
  for (const [campo, linha] of Object.entries(FIELD_MATRIX)) {
    assert.equal(Object.keys(linha).length, 8, campo);
  }
});

test("matriz: celulas do BRIEF 5.2", () => {
  const m = FIELD_MATRIX;
  assert.equal(m.cpf.PJ, "nao_se_aplica");
  assert.equal(m.cpf.ESPOLIO, "obrigatorio");
  assert.equal(m.cnpj.REP_PJ, "obrigatorio");
  assert.equal(m.email.PF, "obrigatorio");
  assert.equal(m.email.PF_PROCURACAO, "se_houver");
  assert.equal(m.email.INCAPAZ_RELATIVO, "se_houver");
  assert.equal(m.email.REP_PF, "obrigatorio");
  assert.equal(m.email.REP_PJ, "se_houver");
  assert.equal(m.phone.PJ, "se_houver");
  assert.equal(m.identity.INCAPAZ_ABSOLUTO, "se_houver"); // sem obrigatoriedade nova de dado de menor ate a 1D
  assert.equal(m.identity.INCAPAZ_RELATIVO, "se_houver"); // idem
  assert.equal(m.identity.PF_PROCURACAO, "obrigatorio");
  assert.equal(m.identity.ESPOLIO, "nao_se_aplica");
  assert.equal(m.profession.INCAPAZ_ABSOLUTO, "nao_se_aplica");
  assert.equal(m.address.INCAPAZ_ABSOLUTO, "nao_se_aplica");
  assert.equal(m.birth_date.REP_PF, "nao_se_aplica");
  assert.equal(m.doc_instrumento.PF_PROCURACAO, "obrigatorio");
  assert.equal(m.doc_instrumento.INCAPAZ_RELATIVO, "nao_se_aplica"); // sub-entrega 1D
  assert.equal(m.doc_instrumento.INCAPAZ_ABSOLUTO, "nao_se_aplica"); // sub-entrega 1D
  assert.equal(m.doc_instrumento.PJ, "nao_se_aplica");
  assert.equal(m.doc_contrato_social.REP_PJ, "obrigatorio");
});

test("matriz: campos obrigatorios por perfil", () => {
  assert.deepEqual(requiredFields("ESPOLIO"), ["name", "cpf", "doc_instrumento"]);
  assert.deepEqual(requiredFields("INCAPAZ_ABSOLUTO"), ["name", "cpf", "nationality", "birth_date"]);
  assert.deepEqual(requiredFields("PJ"), ["name", "cnpj", "address", "legal_nature", "doc_contrato_social"]);
});

test("CPF so e dispensado para estrangeiro com passaporte que declara nao possuir", () => {
  const base = { profile: "PF" as QualificationProfile, nationality_code: "outra", id_type: "passaporte", declared_no_cpf: true };
  assert.equal(isCpfWaived(base), true);
  assert.equal(isCpfWaived({ ...base, nationality_code: "br" }), false);
  assert.equal(isCpfWaived({ ...base, id_type: "rg" }), false);
  assert.equal(isCpfWaived({ ...base, declared_no_cpf: false }), false);
  assert.equal(isCpfWaived({ ...base, profile: "PJ" }), false);
  assert.equal(isCpfWaived({ ...base, profile: "ESPOLIO" }), false);
  assert.equal(isCpfWaived({ ...base, profile: "INCAPAZ_RELATIVO" }), false); // menores so na 1D
  assert.equal(isCpfWaived({ ...base, profile: "INCAPAZ_ABSOLUTO" }), false);
  assert.equal(isCpfWaived({ ...base, profile: "PF_PROCURACAO" }), true);
  assert.equal(isCpfWaived({ ...base, profile: "REP_PF" }), true);
});

test("anexo do instrumento por tipo de representacao", () => {
  assert.equal(INSTRUMENT_DOCUMENT_KIND.procurador, "mandato");
  assert.equal(INSTRUMENT_DOCUMENT_KIND.genitor, "certidao_nascimento");
  assert.equal(INSTRUMENT_DOCUMENT_KIND.administrador, null);
  assert.equal(INSTRUMENT_DOCUMENT_KIND.representante_legal, null);
  assert.equal(ALL_DOCUMENT_KINDS.length, 7);
});

// ---- Deriva entre o codigo e o SQL: uma unica fonte de verdade ----

function valoresDoCheck(constraint: string): string[] {
  const i = MIGRATION_COLUNAS.indexOf(constraint);
  assert.ok(i >= 0, `constraint ${constraint} nao encontrada na migration`);
  const trecho = MIGRATION_COLUNAS.slice(i, i + 600);
  const m = trecho.match(/\(([^)]*)\)/);
  assert.ok(m, constraint);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
}

test("deriva: estado civil do banco bate com o dicionario do codigo", () => {
  assert.deepEqual(
    valoresDoCheck("cm_party_qualifications_marital_status_code_check"),
    MARITAL_STATUS.map((e) => e.code).sort(),
  );
});

test("deriva: tipos de identidade do banco batem com o dicionario do codigo", () => {
  assert.deepEqual(
    valoresDoCheck("cm_party_qualifications_id_type_check"),
    ID_TYPES.map((e) => e.code).sort(),
  );
});

test("deriva: tipos de anexo do banco batem com o codigo", () => {
  const i = MIGRATION_COLUNAS.indexOf("check (document_kind in (");
  assert.ok(i >= 0);
  const trecho = MIGRATION_COLUNAS.slice(i, i + 400);
  const banco = [...trecho.slice(0, trecho.indexOf("));")).matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
  assert.deepEqual(banco, [...ALL_DOCUMENT_KINDS].sort());
});
