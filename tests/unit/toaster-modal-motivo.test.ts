// Guarda estrutural do modal de motivo (BRIEF Mesa M&A G1, 01/11/2026). O teste na tela achou que um overlay próprio, fora
// do Radix, não recebe foco quando há um Dialog Radix aberto por baixo (o card do deal na Mesa M&A rouba o foco de volta e
// o campo não aceita digitação). O modal precisa ser um Dialog Radix aninhado, como o ma-transition-modal. Foco real só
// se prova no navegador; este teste só impede voltar ao overlay próprio por engano.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const src = fs.readFileSync(path.resolve(__dirname, "..", "..", "components", "shared", "toaster.tsx"), "utf8");
const trecho = src.slice(src.indexOf("function ModalMotivo"));

test("ModalMotivo é um Dialog Radix aninhado que não fecha por clique fora nem por Esc", () => {
  assert.match(trecho, /<Dialog open>/);
  assert.match(trecho, /<DialogContent/);
  assert.match(trecho, /onPointerDownOutside=\{\(e\) => e\.preventDefault\(\)\}/);
  assert.match(trecho, /onInteractOutside=\{\(e\) => e\.preventDefault\(\)\}/);
  assert.match(trecho, /onEscapeKeyDown=\{\(e\) => e\.preventDefault\(\)\}/);
});

test("ModalMotivo leva o foco para o campo ao abrir e esconde o X de fechar do Dialog", () => {
  assert.match(trecho, /onOpenAutoFocus/);
  assert.match(trecho, /campo\.current\?\.focus\(\)/);
  assert.match(trecho, /\[&>button\.absolute\]:hidden/);
});

test("ModalMotivo não volta a usar overlay próprio fora do Radix", () => {
  assert.doesNotMatch(trecho, /fixed inset-0/);
  assert.doesNotMatch(trecho, /addEventListener\("keydown"/);
});
