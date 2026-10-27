import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularComissaoLicenciado, calcularComissaoMandato } from "../../lib/credit-commissions";

test("mandato pago: recebido − impostos × % do plano", () => {
  // R$ 30.000 recebidos, imposto 10%, Partner (35%): líquida 27.000 → 9.450
  const r = calcularComissaoMandato(30000, "PARTNER", 10);
  assert.equal(r.impostos, 3000);
  assert.equal(r.liquidaV3, 27000);
  assert.equal(r.planoPerc, 35);
  assert.equal(r.licenciadoValue, 9450);
});

test("papel sem % de plano: valor a definir na autorização", () => {
  assert.equal(calcularComissaoMandato(10000, "ENTERPRISE", 0).planoPerc, 55);
  const r = calcularComissaoMandato(10000, "MESA_OPERACIONAL", 0);
  assert.equal(r.planoPerc, null);
  assert.equal(r.licenciadoValue, 0);
});

test("liberação conta só a instituição; mandato + instituição = total do modelo antigo", () => {
  const proposta = { valor_credito_atual: 1_000_000, comissao_mandato_perc: 3, comissao_instituicao_perc: 2 };
  const so = calcularComissaoLicenciado({ ...proposta, comissao_mandato_perc: 0 }, "PARTNER", 10);
  assert.equal(so.bruto, 20000);            // 2% de 1 mi
  assert.equal(so.licenciadoValue, 6300);   // (20.000 − 10%) × 35%
  const mandato = calcularComissaoMandato(30000, "PARTNER", 10); // 3% de 1 mi, pago pelo cliente
  const total = calcularComissaoLicenciado(proposta, "PARTNER", 10);
  assert.equal(so.licenciadoValue + mandato.licenciadoValue, total.licenciadoValue);
});
