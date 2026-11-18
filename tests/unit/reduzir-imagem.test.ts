// Redução de foto no navegador: partes puras (decisão, dimensões, nome). Dado só inventado.
import test from "node:test";
import assert from "node:assert/strict";
import { ALVO_REDUCAO_BYTES, LADO_MAXIMO_PX, dimensoesReduzidas, nomeComoJpg, precisaReduzir } from "../../lib/reduzir-imagem";
import { KYC_MAX_UPLOAD_VIA_FUNCTION_BYTES } from "../../lib/upload-limits";

test("o alvo da redução fica abaixo do limite da função", () => {
  assert.ok(ALVO_REDUCAO_BYTES < KYC_MAX_UPLOAD_VIA_FUNCTION_BYTES);
});

test("só JPG e PNG acima do alvo são reduzidos; PDF nunca", () => {
  const grande = ALVO_REDUCAO_BYTES + 1;
  assert.equal(precisaReduzir("image/jpeg", grande), true);
  assert.equal(precisaReduzir("image/png", grande), true);
  assert.equal(precisaReduzir("image/jpeg", ALVO_REDUCAO_BYTES), false);
  assert.equal(precisaReduzir("image/jpeg", 1000), false);
  assert.equal(precisaReduzir("application/pdf", grande * 5), false);
  assert.equal(precisaReduzir("image/gif", grande), false);
});

test("dimensões: mantém a proporção, limita o lado maior e nunca amplia", () => {
  assert.deepEqual(dimensoesReduzidas(4000, 3000), { w: LADO_MAXIMO_PX, h: 1875 });
  assert.deepEqual(dimensoesReduzidas(3000, 4000), { w: 1875, h: LADO_MAXIMO_PX });
  assert.deepEqual(dimensoesReduzidas(1200, 800), { w: 1200, h: 800 });
  assert.deepEqual(dimensoesReduzidas(10000, 1), { w: LADO_MAXIMO_PX, h: 1 });
});

test("nome do arquivo vira .jpg", () => {
  assert.equal(nomeComoJpg("foto.png"), "foto.jpg");
  assert.equal(nomeComoJpg("IMG_0001.JPEG"), "IMG_0001.jpg");
  assert.equal(nomeComoJpg("sem-extensao"), "sem-extensao.jpg");
  assert.equal(nomeComoJpg(""), "foto.jpg");
});
