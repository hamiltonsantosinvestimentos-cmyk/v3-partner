// Pedido da Rafael Campos (29/10/2026): a tela de sucesso da qualificação não tinha como sair.
// Teste de código-fonte: sem DOM, protege a presença da mensagem e do botão nas telas finais.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync("app/intake/qualificacao/[token]/page.tsx", "utf8");

function block(state: string): string {
  const start = SRC.indexOf(`{state === "${state}" && (`);
  assert.ok(start !== -1, `tela ${state} não encontrada`);
  const next = SRC.indexOf("{state === ", start + 10);
  return SRC.slice(start, next === -1 ? undefined : next);
}

test("tela de sucesso diz que foi enviada com sucesso e tem botão para sair", () => {
  const b = block("success");
  assert.match(b, /Qualificação enviada com sucesso/);
  assert.match(b, /<CloseScreenButton \/>/);
});

test("tela de qualificação já enviada também tem botão para sair", () => {
  assert.match(block("locked"), /<CloseScreenButton \/>/);
});

test("o botão tenta fechar a aba e, se não conseguir, explica e oferece o site da V3", () => {
  assert.match(SRC, /window\.close\(\)/);
  assert.match(SRC, /Fechar esta tela/);
  assert.match(SRC, /não permite fechar esta aba/);
  assert.match(SRC, /https:\/\/v3partners\.com\.br/);
});

test("os textos novos não usam travessão", () => {
  const trechos = [block("success"), block("locked"), SRC.slice(SRC.indexOf("function CloseScreenButton"), SRC.indexOf("function BirthDateInput"))].join(" ");
  assert.doesNotMatch(trechos, /[–—]/);
});
