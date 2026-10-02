// Máscara de dados sensíveis da ficha da Mesa (BRIEF 30/09/2026, 5.12, Fase 1C passo 1).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maskCpfCnpj, maskIdentity, maskTail, maskIp, maskNode, maskBankData,
  parseRevealField, labelRevealField, flattenChain, resolveNodeValue,
} from "../../lib/qualification-mask";

test("CPF com e sem pontuação: ***.123.456-**", () => {
  assert.equal(maskCpfCnpj("529.982.247-25"), "***.982.247-**");
  assert.equal(maskCpfCnpj("52998224725"), "***.982.247-**");
});

test("CNPJ legado e alfanumérico ficam intactos", () => {
  assert.equal(maskCpfCnpj("11.222.333/0001-81"), "11.222.333/0001-81");
  assert.equal(maskCpfCnpj("12.ABC.345/01DE-35"), "12.ABC.345/01DE-35");
});

test("CNPJ alfanumérico com exatamente 11 dígitos entre os 14 caracteres não é tratado como CPF", () => {
  // 14 caracteres normalizados, 11 deles dígitos: decisão por tamanho do valor normalizado, nunca por contagem de dígitos.
  const eleven = "AB.C12.345/6789-01";
  assert.equal(eleven.replace(/[^0-9A-Za-z]/g, "").length, 14);
  assert.equal(eleven.replace(/\D/g, "").length, 11);
  assert.equal(maskCpfCnpj(eleven), eleven);
});

test("tamanho inesperado recebe máscara genérica e nunca passa em claro", () => {
  assert.equal(maskCpfCnpj("12345678"), "*****678");
  assert.equal(maskCpfCnpj("123"), "***");
});

test("nulo e vazio continuam nulos", () => {
  assert.equal(maskCpfCnpj(null), null);
  assert.equal(maskCpfCnpj("  "), null);
  assert.equal(maskIdentity(undefined), null);
  assert.equal(maskTail(""), null);
});

test("passaporte: mascara só o número e mantém o país", () => {
  assert.equal(maskIdentity("Passaporte X1234567 (US)"), "Passaporte *****567 (US)");
  assert.equal(maskIdentity("Passaporte ZZ1234567 (us)"), "Passaporte ******567 (US)");
});

test("RG legado com órgão mantém o órgão e mascara o número", () => {
  assert.equal(maskIdentity("12.345.678-9 SSP/RJ"), "*********8-9 SSP/RJ");
});

test("RG curto ou em formato livre: abaixo de 6 caracteres nada fica visível", () => {
  assert.equal(maskIdentity("12345"), "*****");
  assert.equal(maskIdentity("MG1234567"), "******567");
});

test("IP: nunca completo", () => {
  assert.equal(maskIp("187.12.34.56"), "187.*.*.*");
  assert.equal(maskIp("2804:14d:7a80:1::1"), "2804:14d:*");
  assert.equal(maskIp("unknown"), "não informado");
  assert.equal(maskIp(null), "não informado");
});

test("campo de revelação: formatos aceitos e rejeitados", () => {
  assert.deepEqual(parseRevealField("cpf_cnpj"), { kind: "principal", field: "cpf_cnpj" });
  assert.deepEqual(parseRevealField("dados_bancarios"), { kind: "principal", field: "dados_bancarios" });
  assert.equal(parseRevealField("full_name"), null);
  assert.equal(parseRevealField("representacao[0:sem-id].cpf_cnpj"), null);
  assert.equal(parseRevealField("representacao[1:sem-id].pix_key"), null);
  assert.deepEqual(parseRevealField("representacao[2:sem-id].rg"), { kind: "node", index: 2, id: "sem-id", field: "rg" });
  const id = "8a1f3c52-7d9e-4b21-9c5a-0e6f4d2a1b37";
  assert.deepEqual(parseRevealField(`representacao[1:${id}].cpf_cnpj`), { kind: "node", index: 1, id, field: "cpf_cnpj" });
  assert.equal(parseRevealField(undefined), null);
});

test("rótulo em português, com cadastro antigo", () => {
  const id = "8a1f3c52-7d9e-4b21-9c5a-0e6f4d2a1b37";
  assert.equal(labelRevealField("cpf_cnpj"), "CPF");
  assert.equal(labelRevealField(`representacao[2:${id}].cpf_cnpj`), "CPF do representante, nível 2");
  assert.equal(labelRevealField("representacao[2:sem-id].cpf_cnpj"), "CPF do representante, posição 2 (cadastro antigo)");
});

test("nó da cadeia: valida posição e identificador, inclusive nó legado sem v3_client_id", () => {
  const id = "8a1f3c52-7d9e-4b21-9c5a-0e6f4d2a1b37";
  const chain = {
    v3_client_id: id, cpf_cnpj: "529.982.247-25", rg: "Passaporte X1234567 (US)",
    representation: { cpf_cnpj: "11144477735", id_number: "MG1234567" },
  };
  assert.equal(flattenChain(chain).length, 2);
  assert.equal(resolveNodeValue(chain, 1, id, "cpf_cnpj"), "529.982.247-25");
  assert.equal(resolveNodeValue(chain, 1, "sem-id", "cpf_cnpj"), null);
  assert.equal(resolveNodeValue(chain, 2, "sem-id", "cpf_cnpj"), "11144477735");
  assert.equal(resolveNodeValue(chain, 2, "sem-id", "id_number"), "MG1234567");
  assert.equal(resolveNodeValue(chain, 3, "sem-id", "cpf_cnpj"), null);
  assert.equal(resolveNodeValue(chain, 2, "sem-id", "rg"), null);
});

test("maskNode não deixa o valor original nem a cadeia aninhada na resposta", () => {
  const out = maskNode({
    full_name: "ZZTEST", cpf_cnpj: "529.982.247-25", rg: "Passaporte X1234567 (US)",
    representation: { cpf_cnpj: "11144477735" },
  }) as Record<string, unknown>;
  const json = JSON.stringify(out);
  assert.equal(out.cpf_cnpj_masked, "***.982.247-**");
  assert.equal(out.rg_masked, "Passaporte *****567 (US)");
  assert.ok(!json.includes("529.982.247-25"));
  assert.ok(!json.includes("X1234567"));
  assert.ok(!json.includes("11144477735"));
  assert.ok(!("cpf_cnpj" in out) && !("rg" in out) && !("representation" in out));
});

test("dados bancários: agência e conta mascaradas, banco e tipo intactos", () => {
  const out = maskBankData({ banco: "Banco X", agencia: "1234", conta: "987654-3", tipo_conta: "corrente" }) as Record<string, unknown>;
  assert.equal(out.banco, "Banco X");
  assert.equal(out.agencia, "****");
  assert.equal(out.conta, "*****4-3");
  assert.equal(maskBankData(null), null);
});

test("dados bancários: agência e conta numéricas também são mascaradas e chaves fora da lista não passam", () => {
  const out = maskBankData({ banco: "Banco X", agencia: 1234567, conta: 98765432, titular_documento: "529.982.247-25", tipo_conta: "corrente" }) as Record<string, unknown>;
  assert.equal(out.agencia, "****567");
  assert.equal(out.conta, "*****432");
  assert.ok(!("titular_documento" in out));
  assert.ok(!JSON.stringify(out).includes("529.982.247-25"));
});

test("maskNode só repassa a lista permitida de campos", () => {
  const out = maskNode({ full_name: "ZZTEST", cpf_cnpj: "52998224725", campo_novo_sensivel: "segredo" } as any) as Record<string, unknown>;
  assert.equal(out.full_name, "ZZTEST");
  assert.ok(!("campo_novo_sensivel" in out));
  assert.ok(!JSON.stringify(out).includes("segredo"));
});
