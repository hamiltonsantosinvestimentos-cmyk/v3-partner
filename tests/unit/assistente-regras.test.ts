import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { assinaturaValida, remetenteConfere, usuarioAutorizado, variantesTelefone } from "../../lib/assistente/acesso";
import {
  CATEGORIAS, centavosDaMascara, dataBrParaIso, dataIsoParaBr, hojeBrasilia, localBrasiliaParaIso, mesesRecentes, telefoneOculto, textoLimpo, valorValido,
} from "../../lib/assistente/formato";

test("faixa de valor: R$ 0,01 a R$ 10.000.000,00", () => {
  assert.equal(valorValido(1), true);
  assert.equal(valorValido(1_000_000_000), true);
  assert.equal(valorValido(0), false);
  assert.equal(valorValido(1_000_000_001), false);
  assert.equal(valorValido(10.5), false);
  assert.equal(centavosDaMascara("1.500,00"), 150000);
});

test("data sem deslocamento de fuso", () => {
  assert.equal(dataIsoParaBr("2026-11-01"), "01/11/2026");
  assert.equal(dataBrParaIso("01/11/2026"), "2026-11-01");
  assert.equal(dataBrParaIso("31/02/2026"), null);
  assert.equal(hojeBrasilia(new Date("2026-11-02T02:00:00Z")), "2026-11-01");
  assert.equal(localBrasiliaParaIso("2026-11-03T15:00"), "2026-11-03T15:00:00-03:00");
  assert.equal(localBrasiliaParaIso("2026-11-03"), null);
});

test("ordenações e ocultação", () => {
  assert.equal(CATEGORIAS.at(-1), "Outros");
  assert.deepEqual(mesesRecentes(3, new Date("2026-01-15T12:00:00Z")), ["2026-01", "2025-12", "2025-11"]);
  assert.equal(telefoneOculto("+5511987654321"), "+55 (11) *****-4321");
  assert.equal(textoLimpo("Mercado — feira 😀"), "Mercado , feira");
});

test("autorização por id, nunca por lista vazia", () => {
  process.env.ASSISTENTE_ALLOWED_USER_IDS = "";
  assert.equal(usuarioAutorizado("a"), false);
  process.env.ASSISTENTE_ALLOWED_USER_IDS = "a, b";
  assert.equal(usuarioAutorizado("b"), true);
  assert.equal(usuarioAutorizado("c"), false);
  assert.equal(usuarioAutorizado(null), false);
});

test("assinatura válida e inválida", () => {
  const corpo = '{"event":"message.received"}';
  const certa = `sha256=${createHmac("sha256", "s3").update(corpo).digest("hex")}`;
  assert.equal(assinaturaValida(corpo, certa, "s3"), true);
  assert.equal(assinaturaValida(corpo + " ", certa, "s3"), false);
  assert.equal(assinaturaValida(corpo, certa.slice(7), "s3"), false);
  assert.equal(assinaturaValida(corpo, null, "s3"), false);
  assert.equal(assinaturaValida(corpo, certa, undefined), false);
});

test("remetente: correspondência exata, @lid e sem o 9º dígito", () => {
  const config = { whatsapp_id: "551187654321@c.us", phone_e164: "+5511987654321" };
  assert.equal(remetenteConfere({ from: "551187654321@c.us" }, config), true);
  assert.equal(remetenteConfere({ from: "551187654321@s.whatsapp.net" }, config), true);
  // A forma com o 9º dígito não é o id verificado: a regra não é afrouxada.
  assert.equal(remetenteConfere({ from: "5511987654321@c.us" }, config), false);
  assert.equal(remetenteConfere({ from: "999@lid", senderPhone: "5511987654321" }, config), true);
  assert.equal(remetenteConfere({ from: "999@lid", senderPhone: "5521000000000" }, config), false);
  assert.equal(remetenteConfere({ from: "999@lid" }, config), false);
  assert.equal(remetenteConfere({ from: "551187654321@c.us" }, { whatsapp_id: null, phone_e164: null }), false);
  // senderPhone só vale para remetente @lid.
  assert.equal(remetenteConfere({ from: "5521000000000@c.us", senderPhone: "5511987654321" }, config), false);
});

test("variantes de telefone para a limpeza de lid_mappings", () => {
  assert.deepEqual(variantesTelefone(["+5511987654321"]).sort(), ["551187654321", "5511987654321"]);
  assert.deepEqual(variantesTelefone(["551187654321@c.us"]).sort(), ["551187654321", "5511987654321"]);
  assert.deepEqual(variantesTelefone(["+15551234567", null, "123@lid"]), ["15551234567"]);
});
