// Documentos do cadastro público de partner: CPF/CNPJ (inclusive CNPJ alfanumérico) com dígito verificador.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ERRO_CNPJ, ERRO_CPF, mascaraCnpj, normalizarCnpj, validarDocumentosCadastro,
} from "../../lib/cadastro-partner/documento";

const CPF_OK = "529.982.247-25";
const CNPJ_NUM_OK = "11.222.333/0001-81";
const CNPJ_ALFA_OK = "12.abc.345/01de-35"; // exemplo oficial da Receita, digitado em minúsculas

test("PF: CPF válido volta só com dígitos", () => {
  assert.deepEqual(validarDocumentosCadastro("PF", { cpf: CPF_OK }), { ok: true, cpf: "52998224725" });
});

test("PF: CPF com dígito errado, sequência repetida ou vazio falha no campo cpf", () => {
  for (const cpf of ["529.982.247-24", "111.111.111-11", "", null]) {
    assert.deepEqual(validarDocumentosCadastro("PF", { cpf }), { ok: false, campo: "cpf", erro: ERRO_CPF });
  }
});

test("PJ: CNPJ numérico válido + CPF do sócio", () => {
  assert.deepEqual(validarDocumentosCadastro("PJ", { cnpj: CNPJ_NUM_OK, cpfSocio: CPF_OK }), {
    ok: true, cnpj: "11222333000181", cpf: "52998224725",
  });
});

test("PJ: CNPJ alfanumérico válido preserva as letras em maiúsculas", () => {
  const r = validarDocumentosCadastro("PJ", { cnpj: CNPJ_ALFA_OK, cpfSocio: CPF_OK });
  assert.deepEqual(r, { ok: true, cnpj: "12ABC34501DE35", cpf: "52998224725" });
});

test("PJ: CNPJ com dígito errado ou repetido falha no campo cnpj", () => {
  for (const cnpj of ["12.ABC.345/01DE-36", "11.222.333/0001-80", "00.000.000/0000-00"]) {
    assert.deepEqual(validarDocumentosCadastro("PJ", { cnpj, cpfSocio: CPF_OK }), { ok: false, campo: "cnpj", erro: ERRO_CNPJ });
  }
});

test("PJ: CPF do sócio inválido falha no campo cpf_socio", () => {
  assert.deepEqual(validarDocumentosCadastro("PJ", { cnpj: CNPJ_NUM_OK, cpfSocio: "123" }), {
    ok: false, campo: "cpf_socio", erro: ERRO_CPF,
  });
});

test("máscara progressiva do CNPJ não apaga letra e põe em maiúsculas", () => {
  assert.equal(mascaraCnpj("12a"), "12.A");
  assert.equal(mascaraCnpj("12abc345"), "12.ABC.345");
  assert.equal(mascaraCnpj("12abc34501de"), "12.ABC.345/01DE");
  assert.equal(mascaraCnpj("12abc34501de3"), "12.ABC.345/01DE-3");
  assert.equal(mascaraCnpj(CNPJ_ALFA_OK), "12.ABC.345/01DE-35");
  assert.equal(mascaraCnpj("11222333000181"), "11.222.333/0001-81");
  assert.equal(mascaraCnpj("12.ABC.345/01DE-35999"), "12.ABC.345/01DE-35");
  assert.equal(normalizarCnpj(" 12.abc.345/01de-35 "), "12ABC34501DE35");
});

test("alerta interno: linha de duplicidade só aparece quando há outro cadastro", async () => {
  const { linhaDuplicidadeCadastro } = await import("../../lib/socios-notify");
  assert.equal(linhaDuplicidadeCadastro(undefined), null);
  assert.equal(linhaDuplicidadeCadastro(null), null);
  assert.equal(
    linhaDuplicidadeCadastro({ status: "PENDENTE", id: "3c262dcd-aaaa-bbbb-cccc-000000000000" }),
    "Atenção: este documento já tem cadastro PENDENTE (id 3c262dcd). Não aprovar em duplicidade.",
  );
});
