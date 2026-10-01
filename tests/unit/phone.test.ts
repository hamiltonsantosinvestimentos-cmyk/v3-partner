// Máscara do campo de telefone internacional (BRIEF 30/09/2026, Fase 1B).
import { test } from "node:test";
import assert from "node:assert/strict";
import { maskPhoneIntlInput, normalizePhone } from "../../lib/phone";

test("máscara: número brasileiro digitado ou colado com +55", () => {
  assert.equal(maskPhoneIntlInput("+5531987654321"), "+55 (31) 98765-4321");
  assert.equal(maskPhoneIntlInput("31987654321"), "+55 (31) 98765-4321");
  assert.equal(maskPhoneIntlInput("+55"), "+55");
});

test("máscara: colar número completo num campo que já tinha +55 não embaralha", () => {
  assert.equal(maskPhoneIntlInput("+55+5531987654321"), "+55 (31) 98765-4321");
  assert.equal(maskPhoneIntlInput("+55 +15551234567"), "+15551234567");
  assert.equal(normalizePhone(maskPhoneIntlInput("+55 +15551234567")).e164, "+15551234567");
});

test("máscara: DDI estrangeiro fica sem máscara brasileira", () => {
  assert.equal(maskPhoneIntlInput("+15551234567"), "+15551234567");
  assert.equal(normalizePhone("+15551234567").e164, "+15551234567");
});
