// Máscaras dos modais de crédito: telefone com DDD entre parênteses e valores em R$.
import { test } from "node:test";
import assert from "node:assert/strict";
import { maskTelefoneCredito, telefoneCreditoParaSalvar, valorParaCampoBRL, parseCurrencyBRLInput, maskCurrencyBRLInput } from "../../lib/utils";

test("telefone: máscara enquanto digita e formato gravado com DDD entre parênteses", () => {
  assert.equal(maskTelefoneCredito("51997466001"), "(51) 99746-6001");
  assert.equal(maskTelefoneCredito("519"), "(51) 9");
  assert.equal(maskTelefoneCredito("+1 555 123 4567"), "+1 555 123 4567");
  assert.equal(telefoneCreditoParaSalvar("51997466001"), "(51) 99746-6001");
  assert.equal(telefoneCreditoParaSalvar("5130001234"), "(51) 3000-1234");
  assert.equal(telefoneCreditoParaSalvar("(51) 99746-6001"), "(51) 99746-6001");
  assert.equal(telefoneCreditoParaSalvar("   "), undefined);
  assert.equal(telefoneCreditoParaSalvar("+1 555 123 4567"), "+1 555 123 4567");
});

test("R$: valor gravado volta para o campo e o campo salva em reais", () => {
  assert.equal(valorParaCampoBRL(5000), "5.000,00");
  assert.equal(valorParaCampoBRL(1234.5), "1.234,50");
  assert.equal(valorParaCampoBRL("5000"), "5.000,00");
  assert.equal(valorParaCampoBRL("R$ 5.000,00"), "5.000,00");
  assert.equal(valorParaCampoBRL("5.000"), "5.000,00");
  assert.equal(valorParaCampoBRL(null), "");
  assert.equal(valorParaCampoBRL(0), "");
  assert.equal(parseCurrencyBRLInput(maskCurrencyBRLInput("150000")), 1500);
  assert.equal(parseCurrencyBRLInput(valorParaCampoBRL(5000)), 5000);
});
