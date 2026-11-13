import test from "node:test";
import assert from "node:assert/strict";
import { mensagemBloqueio, motivoTemDocumento, type LinhaImpacto } from "../../lib/qualification-exclusao";

// Dados inventados (repositório público: nunca dado real em teste). Os números abaixo são
// CPF e CNPJ de teste com dígitos verificadores válidos, sem relação com pessoa real.

test("motivo sem documento passa", () => {
  assert.equal(motivoTemDocumento("foto ilegível, o titular vai reenviar"), false);
  assert.equal(motivoTemDocumento("contrato 0063, conferido em 12/11 às 10h"), false);
});

test("CPF com e sem máscara é detectado", () => {
  assert.equal(motivoTemDocumento("CPF 529.982.247-25 está errado"), true);
  assert.equal(motivoTemDocumento("cpf 52998224725 errado"), true);
});

test("CNPJ numérico com e sem máscara é detectado", () => {
  assert.equal(motivoTemDocumento("empresa 11.222.333/0001-81"), true);
  assert.equal(motivoTemDocumento("empresa 11222333000181"), true);
});

test("CNPJ alfanumérico é detectado, com e sem máscara", () => {
  assert.equal(motivoTemDocumento("empresa 12.ABC.345/01DE-35"), true);
  assert.equal(motivoTemDocumento("empresa 12ABC34501DE35"), true);
});

test("número aleatório de 11 dígitos sem dígito verificador válido não é bloqueado", () => {
  assert.equal(motivoTemDocumento("protocolo 12345678900 do cartório"), false);
});

test("bloqueio: lote em contrato", () => {
  const l: LinhaImpacto[] = [{ qualification_id: "a", role_in_document: "partner", status: "preenchido", contract_code: "V3C-NDA-2026-0001", contract_status: "rascunho", bloqueio: "lote_em_contrato" }];
  assert.match(mensagemBloqueio(l) ?? "", /Cancele o rascunho/);
});

test("bloqueio: contrato assinado", () => {
  const l: LinhaImpacto[] = [{ qualification_id: "a", role_in_document: "partner", status: "preenchido", contract_code: "V3C-NDA-2026-0001", contract_status: "assinado", bloqueio: "lote_em_contrato" }];
  assert.match(mensagemBloqueio(l) ?? "", /já assinado/);
});

test("bloqueio: envio anterior exige sócio", () => {
  const l: LinhaImpacto[] = [{ qualification_id: "a", role_in_document: "partner", status: "preenchido", contract_code: null, contract_status: null, bloqueio: "envio_anterior" }];
  assert.match(mensagemBloqueio(l) ?? "", /sócio/);
});

test("sem bloqueio devolve null", () => {
  const l: LinhaImpacto[] = [{ qualification_id: "a", role_in_document: "partner", status: "preenchido", contract_code: null, contract_status: null, bloqueio: null }];
  assert.equal(mensagemBloqueio(l), null);
});
