import test from "node:test";
import assert from "node:assert/strict";
import { avisosPreAprovacao, dataHoraBR, mascararEmail, montarEmailPreAprovacao, validarPreAprovacao } from "../../lib/pre-aprovacao";
import { protegerMetadata } from "../../lib/credit-proposal-meta";
import { valorEmReaisPorExtenso } from "../../lib/utils/valor-extenso";

const base = {
  renda_apresentada: 50000, renda_aprovada: 42000, valor_pre_aprovado: 1500000, valor_imovel: 4000000, valor_pretendido: 1800000,
  proxima_etapa: { avaliacao: true, contrato: false, outros: false, outros_texto: "" },
};

test("validação aceita o caso comum e normaliza", () => {
  const r = validarPreAprovacao(base);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.dados.proxima_etapa.outros_texto, null);
});

test("validação recusa zero, negativo, acima do teto e sem etapa", () => {
  const r = validarPreAprovacao({ ...base, renda_apresentada: 0, valor_imovel: -1, renda_aprovada: 10_000_001, proxima_etapa: {} });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erros.length, 4);
});

test("Outros exige o texto da próxima etapa", () => {
  const r = validarPreAprovacao({ ...base, proxima_etapa: { outros: true, outros_texto: "  " } });
  assert.equal(r.ok, false);
});

test("avisos quando o pré-aprovado passa do pretendido ou do imóvel", () => {
  assert.equal(avisosPreAprovacao({ valor_pre_aprovado: 5e6, valor_pretendido: 1e6, valor_imovel: 4e6 }).length, 2);
  assert.equal(avisosPreAprovacao(base).length, 0);
});

test("e-mail do cliente leva as rendas e o extenso do mesmo número; o do partner não leva rendas; nenhum tem travessão", () => {
  const r = validarPreAprovacao(base);
  assert.ok(r.ok);
  if (!r.ok) return;
  const cli = montarEmailPreAprovacao({ destinatario: "cliente", nome: "Maria Souza", codigo: "CR-123", clienteNome: "Maria Souza", dados: r.dados, enviadoEm: "2026-11-03T17:00:00Z" });
  const par = montarEmailPreAprovacao({ destinatario: "partner", nome: "João", codigo: "CR-123", clienteNome: "Maria Souza", dados: r.dados, enviadoEm: "2026-11-03T17:00:00Z" });
  assert.match(cli.html, /Renda média apresentada/);
  assert.ok(cli.html.includes(valorEmReaisPorExtenso(1500000)));
  assert.doesNotMatch(par.html, /Renda média/);
  assert.equal(cli.subject, "Pré-aprovação da sua operação CR-123");
  for (const h of [cli.html, par.html]) {
    assert.doesNotMatch(h, /[—–]/);
    assert.match(h, /análise final da instituição\./);
  }
  assert.match(cli.html, /03\/11\/2026 14:00/);
});

test("data e hora em DD/MM/AAAA HH:mm no horário de Brasília", () => {
  assert.equal(dataHoraBR("2026-11-03T02:30:00Z"), "02/11/2026 23:30");
});

test("e-mail mascarado na confirmação", () => {
  assert.equal(mascararEmail("maria@x.com"), "ma***@x.com");
});

test("PATCH genérico não grava nem apaga a pré-aprovação", () => {
  const forjado = protegerMetadata({}, { pre_aprovacao: { valor_pre_aprovado: 1 }, pre_aprovacao_historico: [{}], obs: "x" });
  assert.equal(forjado.pre_aprovacao, undefined);
  assert.equal(forjado.pre_aprovacao_historico, undefined);
  assert.equal(forjado.obs, "x");
  const banco = { pre_aprovacao: { valor_pre_aprovado: 2 }, pre_aprovacao_historico: [] };
  const desatualizado = protegerMetadata(banco, { pre_aprovacao: undefined, motivo_reprovacao: "y" });
  assert.deepEqual(desatualizado.pre_aprovacao, { valor_pre_aprovado: 2 });
});
