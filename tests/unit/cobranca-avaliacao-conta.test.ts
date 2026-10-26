import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarChavePix, htmlCobrancaAvaliacao, validarContaRecebimento, type CobrancaAvaliacao } from "../../lib/cobranca-avaliacao";

const terceiro = {
  tipo: "terceiro", banco_codigo: "341", banco_nome: "Itaú Unibanco", agencia: "0001", conta: "12345-6",
  pix_tipo: "cnpj", pix_chave: "11.222.333/0001-81", razao_social: "Engenharia Avaliações Ltda",
};

test("conta V3 é o padrão (cobranças antigas e sem escolha)", () => {
  assert.deepEqual(validarContaRecebimento(undefined), { conta: { tipo: "v3" } });
  assert.deepEqual(validarContaRecebimento({ tipo: "v3" }), { conta: { tipo: "v3" } });
});

test("conta de terceiro válida é normalizada", () => {
  const r = validarContaRecebimento(terceiro);
  assert.ok("conta" in r && r.conta.tipo === "terceiro");
  if ("conta" in r && r.conta.tipo === "terceiro") {
    assert.equal(r.conta.pix_chave, "11222333000181");
    assert.equal(r.conta.banco_codigo, "341");
  }
  const tel = validarContaRecebimento({ ...terceiro, pix_tipo: "telefone", pix_chave: "(11) 98765-4321" });
  assert.ok("conta" in tel && tel.conta.tipo === "terceiro" && tel.conta.pix_chave === "+5511987654321");
  const mail = validarContaRecebimento({ ...terceiro, pix_tipo: "email", pix_chave: "Financeiro@Empresa.com.br" });
  assert.ok("conta" in mail && mail.conta.tipo === "terceiro" && mail.conta.pix_chave === "financeiro@empresa.com.br");
});

test("cada campo obrigatório é cobrado", () => {
  const erro = (alt: Record<string, string>) => {
    const r = validarContaRecebimento({ ...terceiro, ...alt });
    return "erro" in r ? r.erro : null;
  };
  assert.match(erro({ banco_codigo: "" })!, /número do banco/);
  assert.match(erro({ banco_nome: "" })!, /nome do banco/);
  assert.match(erro({ agencia: "ab" })!, /Agência/);
  assert.match(erro({ conta: "12345" })!, /dígito/);
  assert.match(erro({ razao_social: "" })!, /razão social/);
  assert.match(erro({ pix_chave: "11.222.333/0001-00" })!, /CNPJ inválido/);
  assert.match(erro({ pix_tipo: "email", pix_chave: "sem-arroba" })!, /e-mail inválido/);
  assert.match(erro({ pix_tipo: "telefone", pix_chave: "123" })!, /telefone inválido/);
  assert.match(erro({ pix_tipo: "cpf" })!, /tipo da chave PIX/);
});

test("chave PIX formatada para o PDF", () => {
  assert.equal(formatarChavePix("cnpj", "11222333000181"), "11.222.333/0001-81");
  assert.equal(formatarChavePix("telefone", "+5511987654321"), "+55 (11) 98765-4321");
});

test("PDF: terceiro substitui a conta da V3; sem conta continua V3", () => {
  const base: CobrancaAvaliacao = { id: "1", codigo: "V3-AVL-X-1", valor: 2500, vencimento: "2026-10-30", descricao: "Laudo", criado_em: "2026-10-26T12:00:00Z" };
  const r = validarContaRecebimento(terceiro);
  assert.ok("conta" in r);
  const html = htmlCobrancaAvaliacao({ cobranca: { ...base, conta: "conta" in r ? r.conta : null }, clienteNome: "Fulano", emitidoEm: new Date() });
  assert.match(html, /Engenharia Avaliações Ltda/);
  assert.match(html, /Banco 341 – Itaú Unibanco · Agência 0001 · Conta 12345-6/);
  assert.match(html, /PIX \(chave CNPJ\)/);
  assert.match(html, /11\.222\.333\/0001-81/);
  assert.match(html, /titularidade de Engenharia/);
  const v3 = htmlCobrancaAvaliacao({ cobranca: base, clienteNome: "Fulano", emitidoEm: new Date() });
  assert.match(v3, /titularidade da V3 Partners/);
  assert.doesNotMatch(v3, /Engenharia Avaliações/);
});
