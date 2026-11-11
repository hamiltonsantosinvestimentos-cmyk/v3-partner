// BRIEF docs/briefs/2026-11-10_modal-confirmacao-enviar-contrato.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { mensalidadeDoPlano, textoConfirmacaoEnvio } from "../../lib/contrato-parceria-partner";

const V24 = "Contrato de Parceria Comercial, Licenciamento Partner / Partner PRO / Enterprise, Plataforma V3 (Mentoria Digital, Antichargeback) v2.4";
const base = {
  templateName: V24,
  itemAcordo: "3.2.1",
  dataPagamento: "2026-11-25",
  razaoSocial: "Empresa Teste Ltda",
  email: "cliente@empresa.com",
  contratoAtivo: null,
};

test("Partner com a v2.4", () => {
  const t = textoConfirmacaoEnvio({ ...base, plano: "PARTNER", anuidade: 10896.96 });
  assert.match(t, /sem volta/);
  assert.match(t, /Contrato: Contrato de Parceria v2\.4/);
  assert.match(t, /Plano: Partner\n/);
  assert.match(t, /Anuidade: R\$ 10\.896,96 \(Anexo III da minuta\)\n/);
  assert.match(t, /Data prevista de pagamento: 25\/11\/2026/);
  assert.match(t, /Licenciado: EMPRESA TESTE LTDA/);
  assert.match(t, /Assinatura enviada para: cliente@empresa\.com/);
  assert.ok(!t.includes("acordo comercial"));
  assert.ok(!t.includes("Atenção"));
  assert.ok(!t.includes("—"));
  assert.ok(!t.includes("null"));
});

test("Enterprise cita o acordo comercial", () => {
  const t = textoConfirmacaoEnvio({ ...base, plano: "ENTERPRISE", anuidade: 49896.96 });
  assert.match(t, /Anuidade: R\$ 49\.896,96 \(Anexo III da minuta\), ou o valor do acordo comercial \(item 3\.2\.1\)/);
});

test("Gold: contratante e mensalidade, sem anuidade nem data", () => {
  const t = textoConfirmacaoEnvio({ ...base, plano: "GOLD", templateName: "Contrato ... Planos V3 Gold e V3 Diamante", anuidade: null, itemAcordo: null });
  assert.match(t, /Contrato: Contrato V3 Gold \/ V3 Diamante\n/);
  assert.match(t, /Mensalidade: R\$ 397,00, após 30 dias grátis/);
  assert.match(t, /Contratante: EMPRESA TESTE LTDA/);
  assert.ok(!t.includes("Anuidade"));
  assert.ok(!t.includes("Data prevista"));
  assert.equal(mensalidadeDoPlano("DIAMANTE"), "R$ 897,00");
  assert.equal(mensalidadeDoPlano("PARTNER"), null);
});

test("fallbacks: anuidade, versão, código e lista não carregada", () => {
  const t1 = textoConfirmacaoEnvio({ ...base, plano: "PARTNER_PRO", anuidade: null, templateName: "sem versão" });
  assert.match(t1, /Anuidade: conforme o Anexo III da minuta/);
  assert.match(t1, /Contrato: Contrato de Parceria\n/);
  assert.ok(!t1.includes("null"));
  const t2 = textoConfirmacaoEnvio({ ...base, plano: "PARTNER", anuidade: 10896.96, contratoAtivo: { codigo: null, status: "enviado" } });
  assert.match(t2, /Atenção: este cadastro já tem o contrato sem código \(enviado\)\. Enviar de novo gera um segundo contrato\./);
  const t3 = textoConfirmacaoEnvio({ ...base, plano: "PARTNER", anuidade: 10896.96, contratoAtivo: { codigo: "V3C-PAR-2026-0007", status: "assinado" } });
  assert.match(t3, /contrato V3C-PAR-2026-0007 \(assinado\)/);
  const t4 = textoConfirmacaoEnvio({ ...base, plano: "PARTNER", anuidade: 10896.96, contratoAtivo: undefined });
  assert.match(t4, /Não foi possível verificar contratos anteriores/);
});
