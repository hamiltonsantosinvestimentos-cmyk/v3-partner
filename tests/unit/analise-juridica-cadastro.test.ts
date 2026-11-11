// BRIEF docs/briefs/2026-11-10_analise-juridica-cadastro-partner.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { apenasTotais, dataHoraBR, documentosDoEscopo, mascararDocumento, resumoJuridico } from "../../lib/analise-juridica-cadastro";

// CPF e CNPJ válidos de teste (dígitos verificadores corretos).
const CPF = "52998224725";
const CNPJ_NUM = "11222333000181";

test("PF consulta só o CPF", () => {
  const p = documentosDoEscopo({ tipo_pessoa: "PF", cpf: "529.982.247-25", nome_completo: "Fulano" }, "PJ_PF");
  assert.ok(p.ok);
  if (p.ok) {
    assert.equal(p.escopo, "PF");
    assert.deepEqual(p.documentos.map((d) => [d.tipo, d.valor, d.exibicao]), [["cpf", CPF, "***.982.247-**"]]);
  }
});

test("PJ + PF consulta CNPJ e CPF; Somente PF só o CPF", () => {
  const c = { tipo_pessoa: "PJ", cpf: CPF, cnpj: "11.222.333/0001-81", razao_social: "Empresa", nome_completo: "Sócio" };
  const a = documentosDoEscopo(c, "PJ_PF");
  assert.ok(a.ok && a.escopo === "PJ_PF" && a.documentos.length === 2 && a.documentos[0].valor === CNPJ_NUM);
  const b = documentosDoEscopo(c, "PF");
  assert.ok(b.ok && b.escopo === "PF" && b.documentos.length === 1 && b.documentos[0].tipo === "cpf");
});

test("PJ sem CPF do sócio: PJ_PF vira PJ; PF recusado", () => {
  const c = { tipo_pessoa: "PJ", cpf: "", cnpj: CNPJ_NUM, razao_social: "Empresa" };
  const a = documentosDoEscopo(c, "PJ_PF");
  assert.ok(a.ok && a.escopo === "PJ" && a.documentos.length === 1 && a.documentos[0].tipo === "cnpj");
  const b = documentosDoEscopo(c, "PF");
  assert.ok(!b.ok && /não tem CPF do representante/.test(b.erro));
});

test("documento inválido não é consultado", () => {
  const a = documentosDoEscopo({ tipo_pessoa: "PF", cpf: "52998224700" }, "PF");
  assert.ok(!a.ok && /CPF do cadastro inválido/.test(a.erro));
  const b = documentosDoEscopo({ tipo_pessoa: "PJ", cpf: CPF, cnpj: "11222333000100" }, "PJ_PF");
  assert.ok(!b.ok && /CNPJ do cadastro inválido/.test(b.erro));
});

test("CNPJ legado com máscara e alfanumérico em minúsculas", () => {
  const legado = documentosDoEscopo({ tipo_pessoa: "PJ", cpf: CPF, cnpj: "11.222.333/0001-81" }, "PJ_PF");
  assert.ok(legado.ok && legado.documentos[0].valor === CNPJ_NUM && legado.documentos[0].exibicao === "11.222.333/0001-81");
  // CNPJ alfanumérico de exemplo da Receita: 12.ABC.345/01DE-35
  const alfa = documentosDoEscopo({ tipo_pessoa: "PJ", cpf: CPF, cnpj: "12.abc.345/01de-35" }, "PJ_PF");
  assert.ok(alfa.ok, alfa.ok ? "" : alfa.erro);
  if (alfa.ok) {
    assert.equal(alfa.documentos[0].valor, "12ABC34501DE35");
    assert.equal(alfa.documentos[0].exibicao, "12.ABC.345/01DE-35");
  }
  assert.equal(mascararDocumento("cnpj", "12abc34501de35"), "12.ABC.345/01DE-35");
  assert.equal(mascararDocumento("cpf", CPF), "***.982.247-**");
});

test("só os 5 totais são guardados", () => {
  const t = apenasTotais({ total_processos: 3, reu_quantidade: 2, reu_valor: 1500.5, autor_quantidade: 1, autor_valor: "200,00", consultado_em: "2026-11-10T12:00:00Z", dossie_bruto: { cpf: CPF } } as never);
  assert.deepEqual(Object.keys(t).sort(), ["autor_quantidade", "autor_valor", "consultado_em", "reu_quantidade", "reu_valor", "total_processos"]);
});

test("resumo em BRL e sem null", () => {
  const r = resumoJuridico({ total_processos: 3, reu_quantidade: 2, reu_valor: 1500.5, autor_quantidade: null, autor_valor: "1.234,56" });
  assert.equal(r.processos, "3");
  assert.equal(r.reu, "2 · R$ 1.500,50");
  assert.equal(r.autor, "não informado · R$ 1.234,56");
  const vazio = resumoJuridico(null);
  assert.ok(!JSON.stringify(vazio).includes("null"));
});

test("data e hora em Brasília", () => {
  assert.equal(dataHoraBR("2026-11-11T01:30:00Z"), "10/11/2026 22:30");
});
