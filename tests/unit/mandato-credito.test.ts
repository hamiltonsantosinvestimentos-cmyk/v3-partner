// Mandato de Crédito: tipo do cliente, campos faltantes, qualificação PF/PJ e % por extenso.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  camposFaltantes, dadosDaProposta, montarQualificacao, percentualPorExtenso, pickMandatoTemplate,
  signatarioMandato, tipoDaProposta, isMandatoTemplateName,
} from "../../lib/mandato-credito";

const PF_COMPLETO = {
  nome: "Maria da Silva", nacionalidade: "brasileira", estado_civil: "solteiro(a)", profissao: "empresária",
  nascimento: "01/02/1980", rg: "123456", rg_orgao: "SSP/SP", cpf: "52998224725", endereco: "Rua A, 10, Centro",
  cidade: "São Paulo", uf: "sp", cep: "01001000", email: "maria@ex.com", telefone: "11999990000",
};

test("tipo vem do client_type da proposta e, sem ele, do tamanho do documento", () => {
  assert.equal(tipoDaProposta({ metadata: { client_type: "PJ" } }), "PJ");
  assert.equal(tipoDaProposta({ client_cpf_cnpj: "11.222.333/0001-81" }), "PJ");
  assert.equal(tipoDaProposta({ client_cpf_cnpj: "529.982.247-25" }), "PF");
});

test("dados da proposta pré-preenchem e só faltam os campos que a proposta não tem", () => {
  const { tipo, dados } = dadosDaProposta({
    client_name: "Maria da Silva", client_cpf_cnpj: "529.982.247-25",
    metadata: { client_type: "PF", email: "maria@ex.com", rg: "123456", nascimento: "1980-02-01", estado_civil: "casada" },
  });
  assert.equal(tipo, "PF");
  assert.equal(dados.nascimento, "01/02/1980");
  assert.equal(dados.estado_civil, "casado(a)");
  const faltam = camposFaltantes(tipo, dados).map((c) => c.key);
  assert.ok(faltam.includes("nacionalidade"));
  assert.ok(faltam.includes("regime_bens"), "casado(a) exige regime de bens");
  assert.ok(!faltam.includes("nome") && !faltam.includes("cpf") && !faltam.includes("email"));
});

test("dados já completados num envio anterior vencem o cadastro", () => {
  const { dados } = dadosDaProposta({
    client_name: "Maria", client_cpf_cnpj: "52998224725",
    metadata: { client_type: "PF", mandato_qualificacao: { tipo: "PF", dados: { nacionalidade: "brasileira" } } },
  });
  assert.equal(dados.nacionalidade, "brasileira");
});

test("CPF, CNPJ e e-mail inválidos contam como faltantes", () => {
  assert.deepEqual(camposFaltantes("PF", PF_COMPLETO), []);
  const ruim = camposFaltantes("PF", { ...PF_COMPLETO, cpf: "123", email: "x" }).map((c) => c.key);
  assert.deepEqual(ruim.sort(), ["cpf", "email"]);
});

test("qualificação PF escapa HTML e formata CPF/CEP", () => {
  const q = montarQualificacao("PF", { ...PF_COMPLETO, nome: "Maria <b>da</b> Silva" });
  assert.ok(q.includes("MARIA &lt;B&gt;DA&lt;/B&gt; SILVA"));
  assert.ok(!q.includes("<b>"));
  assert.ok(q.includes("529.982.247-25"));
  assert.ok(q.includes("01001-000"));
  assert.ok(q.endsWith("<strong>CONTRATANTE</strong>."));
});

test("PJ: empresa qualificada com o sócio administrador, que é quem assina", () => {
  const d = {
    razao_social: "Acme Ltda", cnpj: "11222333000181", endereco: "Av. B, 1", cidade: "Rio de Janeiro", uf: "RJ",
    cep: "22410002", email: "contato@acme.com",
    ...Object.fromEntries(Object.entries(PF_COMPLETO).map(([k, v]) => [`socio_${k}`, v])),
  };
  assert.deepEqual(camposFaltantes("PJ", d), []);
  const q = montarQualificacao("PJ", d);
  assert.ok(q.startsWith("<strong>ACME LTDA</strong>"));
  assert.ok(q.includes("11.222.333/0001-81"));
  assert.ok(q.includes("sócio administrador <strong>MARIA DA SILVA</strong>"));
  const s = signatarioMandato("PJ", d);
  assert.equal(s.email, "maria@ex.com");
  assert.equal(s.doc, "529.982.247-25");
  assert.equal(s.rotulo, "Contratante, p. Acme Ltda");
});

test("percentual por extenso", () => {
  assert.equal(percentualPorExtenso(6), "6% (seis por cento)");
  assert.equal(percentualPorExtenso(6.5), "6,5% (seis vírgula cinco por cento)");
  assert.equal(percentualPorExtenso(2.05), "2,05% (dois vírgula zero cinco por cento)");
  assert.equal(percentualPorExtenso(25), "25% (vinte e cinco por cento)");
});

test("escolhe a minuta pelo tipo do cliente", () => {
  const ts = [
    { id: "a", template_name: "Mandato de Crédito (Cliente PF)" },
    { id: "b", template_name: "Mandato de Crédito (Cliente PJ)" },
    { id: "c", template_name: "NDA (Mesa de operações)" },
  ];
  assert.equal(pickMandatoTemplate(ts, "PF")?.id, "a");
  assert.equal(pickMandatoTemplate(ts, "PJ")?.id, "b");
  assert.ok(isMandatoTemplateName("Mandato de Crédito (Cliente PJ)"));
  assert.ok(!isMandatoTemplateName("Mandato do Locatário, Operação de Locação do Código Brink's"));
});
