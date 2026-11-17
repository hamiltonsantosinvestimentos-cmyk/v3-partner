import test from "node:test";
import assert from "node:assert/strict";
import { valorPorExtenso } from "../../lib/utils/valor-extenso";
import { legacyMoneyToNumber, formatMoney, normalizeMoneyText } from "../../lib/utils";

const nb = (t: string) => t.replace(/\s/g, " ");

test("valor por extenso em reais", () => {
  assert.equal(valorPorExtenso(1, "BRL"), "um real");
  assert.equal(valorPorExtenso(1.71, "BRL"), "um real e setenta e um centavos");
  assert.equal(valorPorExtenso(1_000_000, "BRL"), "um milhão de reais");
  assert.equal(valorPorExtenso(1_000_001, "BRL"), "um milhão e um reais");
  assert.equal(valorPorExtenso(2_500_000.5, "BRL"), "dois milhões e quinhentos mil reais e cinquenta centavos");
});

test("valor por extenso em dólar americano", () => {
  assert.equal(valorPorExtenso(300_000_000, "USD"), "trezentos milhões de dólares americanos");
  assert.equal(valorPorExtenso(1, "USD"), "um dólar americano");
  assert.equal(valorPorExtenso(0.5, "USD"), "cinquenta centavos");
});

test("valor por extenso com entrada inválida devolve vazio", () => {
  assert.equal(valorPorExtenso(NaN, "BRL"), "");
  assert.equal(valorPorExtenso(-1, "BRL"), "");
});

test("formatação com 2 casas e separadores brasileiros em qualquer moeda", () => {
  assert.equal(nb(formatMoney(1234567.89, "BRL")), "R$ 1.234.567,89");
  assert.equal(nb(formatMoney(300000000, "USD")), "US$ 300.000.000,00");
  assert.equal(formatMoney(null), "—");
});

test("valor antigo em texto livre é lido sem adivinhar escala", () => {
  assert.equal(legacyMoneyToNumber("1.200.000,00"), 1200000);
  assert.equal(legacyMoneyToNumber("1200000"), 1200000);
  assert.equal(legacyMoneyToNumber("1,5 mi"), null);
  assert.equal(normalizeMoneyText("1,5 mi"), "1,5 mi");
});
