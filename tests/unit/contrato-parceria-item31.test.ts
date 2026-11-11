// BRIEFs docs/briefs/2026-11-10_contrato-enterprise-item-3-1-acordo-comercial.md e
// docs/briefs/2026-11-10_contrato-parceria-anuidade-do-anexo-iii.md.
// Fixtures: cópias literais do body_text_raw em contract_templates (v2.3 aprovada e v2.4 em revisão, com o item 6.8).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  anuidadeDoAnexoIII, itemAcordoEnterprise, preencherContratoParceria, textoItem31, valoresBRLDaLinha, versaoDaMinuta,
  type DadosLicenciado,
} from "../../lib/contrato-parceria-partner";
import { dataPagamentoDoContrato, planoDoContrato } from "../../lib/lembrete-pagamento-parceria";

const v23 = fs.readFileSync(path.join(__dirname, "../fixtures/minuta-parceria-v2.3.html"), "utf8");
const v24 = fs.readFileSync(path.join(__dirname, "../fixtures/minuta-parceria-v2.4.html"), "utf8");

const dados: DadosLicenciado = {
  razao_social: "Empresa Teste Ltda",
  documento: "00.000.000/0001-91",
  endereco: "Rua Teste, 1, Porto Alegre/RS",
  representante: "Fulano de Tal",
  cpf: "000.000.000-00",
  rg: "0000000",
  email: "teste@exemplo.com",
  telefone: "+55 (51) 90000-0000",
  modulos: "12",
  data_pagamento: "2026-11-25",
};

test("item do acordo comercial é lido da minuta", () => {
  assert.equal(itemAcordoEnterprise(v24), "3.2.1");
  assert.equal(itemAcordoEnterprise(v23), null);
  assert.equal(itemAcordoEnterprise("<p>3.2.2 <strong>Condições do Plano Enterprise:</strong></p>"), "3.2.2");
  assert.equal(itemAcordoEnterprise(null), null);
});

test("anuidade lida do Anexo III das minutas reais", () => {
  assert.equal(anuidadeDoAnexoIII(v23, "PARTNER"), 10897);
  assert.equal(anuidadeDoAnexoIII(v23, "PARTNER_PRO"), 15897);
  assert.equal(anuidadeDoAnexoIII(v23, "ENTERPRISE"), 49897);
  assert.equal(anuidadeDoAnexoIII(v24, "PARTNER"), 10896.96);
  assert.equal(anuidadeDoAnexoIII(v24, "PARTNER_PRO"), 15897);
  assert.equal(anuidadeDoAnexoIII(v24, "ENTERPRISE"), 49896.96);
});

test("v2.4: anuidade = 12 x mensalidade cobrada pelo sistema", () => {
  assert.equal(Math.round(anuidadeDoAnexoIII(v24, "PARTNER") * 100), 90808 * 12);
  assert.equal(Math.round(anuidadeDoAnexoIII(v24, "PARTNER_PRO") * 100), 132475 * 12);
  assert.equal(Math.round(anuidadeDoAnexoIII(v24, "ENTERPRISE") * 100), 415808 * 12);
});

test("formatos de valor lidos na linha", () => {
  assert.deepEqual(valoresBRLDaLinha("<tr><td>X</td><td>R$ 908,08</td><td>R$ 1.234.567,89</td><td>R$&nbsp;10.896,96</td><td>35%</td></tr>"), [90808, 123456789, 1089696]);
});

const linhaPartner = /<tr><td>Partner<\/td>.*?<\/tr>/;
test("erros do Anexo III", () => {
  assert.throws(() => anuidadeDoAnexoIII(v24.replace(linhaPartner, ""), "PARTNER"), /não tem a linha do plano Partner/);
  assert.throws(() => anuidadeDoAnexoIII(v24.replace(linhaPartner, "<tr><td>Partner</td><td>R$ 1,00</td><td>R$ 2,00</td><td>R$ 3,00</td></tr>"), "PARTNER"), /não tem os quatro valores/);
  assert.throws(() => anuidadeDoAnexoIII(v24.replace(linhaPartner, "<tr><td>Partner</td><td>R$ 0,00</td><td>R$ 0,00</td><td>R$ 0,00</td><td>R$ 0,00</td><td>35%</td></tr>"), "PARTNER"), /parcela \(a\) do Partner está zerada/);
  assert.throws(() => anuidadeDoAnexoIII(v24.replace(linhaPartner, "<tr><td>Partner</td><td>R$ 1.000.000,00</td><td>R$ 500.000,00</td><td>R$ 500.000,00</td><td>R$ 2.000.000,00</td><td>35%</td></tr>"), "PARTNER"), /fora da faixa aceita/);
  assert.throws(() => anuidadeDoAnexoIII(v24.replace("<td>R$ 3.080,21</td>", "<td>R$ 3.080,25</td>"), "PARTNER"), /somam R\$ 10\.897,00, diferente do Total Anual R\$ 10\.896,96/);
});

test("Partner não pega a linha do Partner PRO", () => {
  assert.equal(anuidadeDoAnexoIII(v24.replace(linhaPartner, "<tr><td>Partner</td><td>R$ 1.026,75</td><td>R$ 6.790,00</td><td>R$ 3.080,25</td><td>R$ 10.897,00</td><td>35%</td></tr>"), "PARTNER"), 10897);
});

test("Enterprise com a v2.4: acordo, R$ 49.896,96 e extensos; o cron continua lendo", () => {
  const t = textoItem31("ENTERPRISE", "2026-11-25", "3.2.1", 49896.96);
  assert.match(t, /acordo comercial/);
  assert.match(t, /\(item 3\.2\.1\)/);
  assert.match(t, /R\$ 49\.896,96 \(quarenta e nove mil e oitocentos e noventa e seis reais e noventa e seis centavos\)/);
  assert.match(t, /Data prevista de pagamento: 25\/11\/2026 \(25 de novembro de 2026\)\./);
  assert.deepEqual(planoDoContrato(`<p>3.1 ${t}</p>`), { plano: "Enterprise", anuidade: "R$ 49.896,96" });
  assert.equal(dataPagamentoDoContrato(`<p>3.1 ${t}</p>`), "2026-11-25");
});

test("Partner PRO não cita acordo mesmo com a v2.4", () => {
  const t = textoItem31("PARTNER_PRO", "2026-11-25", "3.2.1", 15897);
  assert.ok(!t.includes("acordo comercial"));
  assert.match(t, /R\$ 15\.897,00 \(quinze mil e oitocentos e noventa e sete reais\)/);
});

test("dia 1 sai 1º e não recua pelo fuso", () => {
  assert.match(textoItem31("PARTNER", "2026-12-01", null, 10896.96), /01\/12\/2026 \(1º de dezembro de 2026\)/);
});

test("preencher com as minutas reais", () => {
  const ent = preencherContratoParceria(v24, "ENTERPRISE", dados);
  assert.match(ent, /anuidade de R\$ 49\.896,96 .*\(item 3\.2\.1\)/);
  assert.match(ent, /VERSÃO 2\.4/);
  const par = preencherContratoParceria(v24, "PARTNER", dados);
  assert.match(par, /anuidade de R\$ 10\.896,96 \(dez mil e oitocentos e noventa e seis reais e noventa e seis centavos\)/);
  assert.deepEqual(planoDoContrato(par), { plano: "Partner", anuidade: "R$ 10.896,96" });
  assert.equal(dataPagamentoDoContrato(par), "2026-11-25");
  const pro = preencherContratoParceria(v24, "PARTNER_PRO", dados);
  assert.match(pro, /anuidade de R\$ 15\.897,00 \(quinze mil/);
  const ent23 = preencherContratoParceria(v23, "ENTERPRISE", dados);
  assert.match(ent23, /anuidade de R\$ 49\.897,00 \(quarenta/);
  assert.ok(!ent23.includes("acordo comercial firmado"));
  const par23 = preencherContratoParceria(v23, "PARTNER", dados);
  assert.match(par23, /anuidade de R\$ 10\.897,00 \(dez mil/);
});

test("Anexo III adulterado interrompe a geração", () => {
  const adulterada = v24.replace("<td>R$ 49.896,96</td>", "<td>R$ 50.000,00</td>");
  assert.throws(() => preencherContratoParceria(adulterada, "ENTERPRISE", dados), /somam/);
});

test("versão lida do nome da minuta", () => {
  assert.equal(versaoDaMinuta("Contrato de Parceria Comercial, ... (Mentoria Digital, Antichargeback) v2.4"), "v2.4");
  assert.equal(versaoDaMinuta("sem versão"), null);
});
