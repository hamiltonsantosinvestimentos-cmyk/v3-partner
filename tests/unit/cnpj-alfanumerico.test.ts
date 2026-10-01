// Testes de logica pura do CNPJ alfanumerico (Receita/Serpro, emissao desde 31/07/2026).
// Sem banco, sem rede, sem e2e: o CI roda e2e contra a producao a cada push, entao a prova
// desta correcao e unitaria. Rodar com:
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidCPF, isValidCNPJ, formatCNPJ } from "../../lib/validators/cpf-cnpj";
import { normalizeDocument, detectDocumentType } from "../../lib/v3-clients";
import { isValidCpfCnpj, maskCpfCnpjInput } from "../../lib/utils";

const LEGADO = "11.222.333/0001-81";
const ALFA = "12.ABC.345/01DE-35";
// 14 caracteres com exatamente 11 digitos: o caso que uma contagem so de digitos confundiria com CPF.
const ALFA_11_DIGITOS = "1A2B3C45678901";

test("isValidCNPJ valida os dois formatos pelo mesmo algoritmo", () => {
  assert.equal(isValidCNPJ(LEGADO), true);
  assert.equal(isValidCNPJ(ALFA), true);
  assert.equal(isValidCNPJ(ALFA_11_DIGITOS), true);
  assert.equal(isValidCNPJ("9Z8Y7X12345627"), true);
});

test("isValidCNPJ aceita minusculas e mascara", () => {
  assert.equal(isValidCNPJ("12.abc.345/01de-35"), true);
  assert.equal(isValidCNPJ("12abc34501de35"), true);
});

test("isValidCNPJ rejeita digito errado, tamanho errado e sequencia repetida", () => {
  assert.equal(isValidCNPJ("12.ABC.345/01DE-36"), false);
  assert.equal(isValidCNPJ("12.345.678/0001-90"), false); // CNPJ do exemplo do manual v4, invalido
  assert.equal(isValidCNPJ("12.ABC.345/01DE-3"), false);
  assert.equal(isValidCNPJ("00000000000000"), false);
  assert.equal(isValidCNPJ("AAAAAAAAAAAAAA"), false);
  assert.equal(isValidCNPJ("12.ABC.345/01DE-AB"), false); // digitos verificadores sao sempre numericos
});

test("isValidCPF segue valendo e nunca aceita letra", () => {
  assert.equal(isValidCPF("529.982.247-25"), true);
  assert.equal(isValidCPF("111.111.111-11"), false);
  assert.equal(isValidCPF("529.982.247-2A"), false);
});

test("normalizeDocument preserva letra e forca maiuscula", () => {
  assert.equal(normalizeDocument("12.abc.345/01de-35"), "12ABC34501DE35");
  assert.equal(normalizeDocument(LEGADO), "11222333000181");
  assert.equal(normalizeDocument("529.982.247-25"), "52998224725");
  assert.equal(normalizeDocument(null), "");
});

test("detectDocumentType decide pelo tamanho normalizado", () => {
  assert.equal(detectDocumentType(normalizeDocument(ALFA)), "CNPJ");
  assert.equal(detectDocumentType(normalizeDocument(ALFA_11_DIGITOS)), "CNPJ");
  assert.equal(detectDocumentType(normalizeDocument("529.982.247-25")), "CPF");
  assert.equal(detectDocumentType(normalizeDocument("12345")), null);
});

test("formatCNPJ formata os dois formatos e ida e volta preserva o valor", () => {
  assert.equal(formatCNPJ("12ABC34501DE35"), ALFA);
  assert.equal(formatCNPJ("11222333000181"), LEGADO);
  for (const v of [LEGADO, ALFA, ALFA_11_DIGITOS]) {
    assert.equal(normalizeDocument(formatCNPJ(v)), normalizeDocument(v));
  }
});

test("isValidCpfCnpj nao confunde CNPJ alfanumerico de 11 digitos com CPF", () => {
  assert.equal(isValidCpfCnpj("529.982.247-25"), true);
  assert.equal(isValidCpfCnpj(LEGADO), true);
  assert.equal(isValidCpfCnpj(ALFA), true);
  assert.equal(isValidCpfCnpj(ALFA_11_DIGITOS), true);
  assert.equal(isValidCpfCnpj("1A2B3C45678902"), false);
  assert.equal(isValidCpfCnpj("12345"), false);
});

test("maskCpfCnpjInput nao apaga letra enquanto o CNPJ e digitado", () => {
  assert.equal(maskCpfCnpjInput("52998224725"), "529.982.247-25");
  assert.equal(maskCpfCnpjInput("12abc34501de35"), ALFA);
  assert.equal(maskCpfCnpjInput("12ab"), "12.AB");
  assert.equal(maskCpfCnpjInput("12abc345"), "12.ABC.345");
  assert.equal(maskCpfCnpjInput("12abc34501de35999"), ALFA); // corta no limite de 14
});
