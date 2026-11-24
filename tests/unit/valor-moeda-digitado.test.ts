/* eslint-disable */
// Padrao unico de campo monetario (22/11/2026): reais inteiros, virgula inicia os centavos.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maskCurrencyBRLInput, maskCurrencyInput, parseCurrencyBRLInput,
  normalizePastedMoney, completeMoneyOnBlur, formatCurrencyFromNumber, formatCurrencyBRLFromNumber,
} from "../../lib/utils";

test("digitando: os digitos sao reais inteiros com ponto de milhar", () => {
  assert.equal(maskCurrencyBRLInput("50000000"), "50.000.000");
  assert.equal(parseCurrencyBRLInput(maskCurrencyBRLInput("50000000")), 50000000);
  assert.equal(maskCurrencyBRLInput("1234"), "1.234");
  assert.equal(maskCurrencyBRLInput("5"), "5");
});

test("digitando: virgula inicia centavos, maximo 2 casas", () => {
  assert.equal(maskCurrencyBRLInput(",5"), "0,5");
  assert.equal(parseCurrencyBRLInput(",5"), 0.5);
  assert.equal(maskCurrencyBRLInput("50000000,"), "50.000.000,");
  assert.equal(maskCurrencyBRLInput("50000000,5"), "50.000.000,5");
  assert.equal(maskCurrencyBRLInput("50000000,555"), "50.000.000,55");
  assert.equal(parseCurrencyBRLInput("50.000.000,55"), 50000000.55);
  assert.equal(maskCurrencyBRLInput("1,2,3"), "1,23");
});

test("digitando: ponto e sempre milhar, nunca decimal", () => {
  assert.equal(parseCurrencyBRLInput("1.234"), 1234);
  assert.equal(parseCurrencyBRLInput("1.234.567"), 1234567);
  assert.equal(parseCurrencyBRLInput("1.5"), 15);
  assert.equal(maskCurrencyBRLInput("1.5"), "15");
});

test("digitando: zeros a esquerda, sinal, vazio e zero", () => {
  assert.equal(maskCurrencyBRLInput("007"), "7");
  assert.equal(maskCurrencyBRLInput("0"), "0");
  assert.equal(maskCurrencyBRLInput("-5"), "5");
  assert.equal(parseCurrencyBRLInput("-5"), 5);
  assert.equal(maskCurrencyBRLInput(""), "");
  assert.equal(parseCurrencyBRLInput(""), 0);
  assert.equal(parseCurrencyBRLInput("0,00"), 0);
  assert.equal(maskCurrencyBRLInput("abc"), "");
});

test("apagar com Backspace nao reinterpreta ponto como decimal", () => {
  // "1.000" apagando o ultimo digito vira "1.00" no input; a mascara deve ler 100
  assert.equal(maskCurrencyBRLInput("1.00"), "100");
  assert.equal(parseCurrencyBRLInput("1.00"), 100);
});

test("colando: so o padrao en-US exato vira virgula decimal", () => {
  assert.equal(normalizePastedMoney("50000000.00"), "50000000,00");
  assert.equal(maskCurrencyBRLInput(normalizePastedMoney("50000000.00")), "50.000.000,00");
  assert.equal(maskCurrencyBRLInput(normalizePastedMoney("1234.5")), "1.234,5");
  assert.equal(maskCurrencyBRLInput(normalizePastedMoney("1.5")), "1,5");
  // 3 casas depois do ponto = milhar, padrao brasileiro
  assert.equal(parseCurrencyBRLInput(maskCurrencyBRLInput(normalizePastedMoney("1.234"))), 1234);
  assert.equal(parseCurrencyBRLInput(maskCurrencyBRLInput(normalizePastedMoney("1.234,5"))), 1234.5);
  assert.equal(parseCurrencyBRLInput(maskCurrencyBRLInput(normalizePastedMoney("1.234.567"))), 1234567);
});

test("ao sair do campo: completa ,00 e zero vira vazio", () => {
  assert.equal(completeMoneyOnBlur("50.000.000"), "50.000.000,00");
  assert.equal(completeMoneyOnBlur("50.000.000,5"), "50.000.000,50");
  assert.equal(completeMoneyOnBlur("0,00"), "");
  assert.equal(completeMoneyOnBlur("0"), "");
  assert.equal(completeMoneyOnBlur(""), "");
});

test("formato antigo e lido sem mudar o numero (rascunhos e valores vindos do banco)", () => {
  assert.equal(parseCurrencyBRLInput("500.000,00"), 500000);
  assert.equal(parseCurrencyBRLInput("300.000.000,00"), 300000000);
  // round trip: numero -> texto do banco -> parse -> mesmo numero
  for (const n of [0.5, 1, 1234.56, 50000000, 999999999999.99]) {
    assert.equal(parseCurrencyBRLInput(formatCurrencyBRLFromNumber(n)), n);
  }
});

test("USD, EUR e BRL usam o mesmo padrao pt-BR", () => {
  assert.equal(maskCurrencyInput("1234567", "USD"), "1.234.567");
  assert.equal(maskCurrencyInput("1234567,8", "EUR"), "1.234.567,8");
  assert.equal(formatCurrencyFromNumber(1234.5, "USD"), "1.234,50");
  assert.equal(parseCurrencyBRLInput(formatCurrencyFromNumber(1234.5, "USD")), 1234.5);
});
