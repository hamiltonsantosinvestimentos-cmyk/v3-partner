// BRIEF docs/briefs/2026-11-10_contrato-enterprise-item-3-1-acordo-comercial.md
// Fixtures: cópias literais do body_text_raw em contract_templates (v2.3 aprovada e v2.4 em revisão).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  conferirAnexoIII, itemAcordoEnterprise, preencherContratoParceria, textoItem31, versaoDaMinuta,
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

test("Enterprise com a v2.4: acordo, R$ 49.896,96 e extensos; o cron continua lendo", () => {
  const t = textoItem31("ENTERPRISE", "2026-11-25", "3.2.1");
  assert.match(t, /acordo comercial/);
  assert.match(t, /\(item 3\.2\.1\)/);
  assert.match(t, /R\$ 49\.896,96 \(quarenta e nove mil e oitocentos e noventa e seis reais e noventa e seis centavos\)/);
  assert.match(t, /Data prevista de pagamento: 25\/11\/2026 \(25 de novembro de 2026\)\./);
  assert.ok(!t.includes("—"));
  assert.deepEqual(planoDoContrato(`<p>3.1 ${t}</p>`), { plano: "Enterprise", anuidade: "R$ 49.896,96" });
  assert.equal(dataPagamentoDoContrato(`<p>3.1 ${t}</p>`), "2026-11-25");
});

test("Enterprise sem o item (v2.3): R$ 49.897,00, sem acordo", () => {
  const t = textoItem31("ENTERPRISE", "2026-11-25", null);
  assert.ok(!t.includes("acordo comercial"));
  assert.match(t, /R\$ 49\.897,00 \(quarenta e nove mil e oitocentos e noventa e sete reais\)/);
});

test("Partner PRO não cita acordo mesmo com a v2.4", () => {
  const t = textoItem31("PARTNER_PRO", "2026-11-25", "3.2.1");
  assert.ok(!t.includes("acordo comercial"));
  assert.match(t, /R\$ 15\.897,00 \(quinze mil e oitocentos e noventa e sete reais\)/);
});

test("dia 1 sai 1º e não recua pelo fuso", () => {
  const t = textoItem31("PARTNER", "2026-12-01", null);
  assert.match(t, /01\/12\/2026 \(1º de dezembro de 2026\)/);
});

test("valor do 3.1 bate com o Anexo III das minutas reais", () => {
  for (const plano of ["PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const) {
    assert.doesNotThrow(() => conferirAnexoIII(v23, plano, itemAcordoEnterprise(v23)), plano);
    assert.doesNotThrow(() => conferirAnexoIII(v24, plano, itemAcordoEnterprise(v24)), plano);
  }
});

test("trava: Anexo III adulterado interrompe a geração", () => {
  const adulterada = v24.replace("<td>R$ 49.896,96</td>", "<td>R$ 50.000,00</td>");
  assert.throws(() => preencherContratoParceria(adulterada, "ENTERPRISE", dados), /não bate com o Anexo III/);
});

test("preencher com as minutas reais: Enterprise e PRO, sem marcador sobrando", () => {
  const ent = preencherContratoParceria(v24, "ENTERPRISE", dados);
  assert.match(ent, /anuidade de R\$ 49\.896,96 .*\(item 3\.2\.1\)/);
  assert.match(ent, /VERSÃO 2\.4/);
  const pro = preencherContratoParceria(v24, "PARTNER_PRO", dados);
  assert.ok(!/anuidade de R\$ 15\.897,00[^<]*acordo comercial/.test(pro));
  const ent23 = preencherContratoParceria(v23, "ENTERPRISE", dados);
  assert.match(ent23, /anuidade de R\$ 49\.897,00 \(quarenta/);
  assert.ok(!ent23.includes("acordo comercial firmado"));
});

test("versão lida do nome da minuta", () => {
  assert.equal(versaoDaMinuta("Contrato de Parceria Comercial, ... (Mentoria Digital, Antichargeback) v2.4"), "v2.4");
  assert.equal(versaoDaMinuta("sem versão"), null);
});
