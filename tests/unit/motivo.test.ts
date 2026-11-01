import { test } from "node:test";
import assert from "node:assert/strict";
import { motivoValido, MOTIVO_MAX, MOTIVO_MIN } from "../../lib/motivo";
import { escapeHtml } from "../../lib/html-escape";
import { pedirMotivo } from "../../lib/aviso";

test("motivoValido: limites e espaços", () => {
  assert.equal(motivoValido(""), null);
  assert.equal(motivoValido("     "), null);
  assert.equal(motivoValido("abcd"), null);
  assert.equal(motivoValido("  abcd  "), null, "4 caracteres depois do trim");
  assert.equal(motivoValido("abcde"), "abcde");
  assert.equal(motivoValido("  duplicata do deal anterior  "), "duplicata do deal anterior");
  assert.equal(motivoValido("a".repeat(MOTIVO_MAX)), "a".repeat(MOTIVO_MAX));
  assert.equal(motivoValido("a".repeat(MOTIVO_MAX + 1)), null);
  assert.equal(MOTIVO_MIN, 5);
});

test("motivoValido: acento, quebra de linha, tipos inválidos", () => {
  assert.equal(motivoValido("Reunião interna,\nnão é operação"), "Reunião interna,\nnão é operação");
  assert.equal(motivoValido(null), null);
  assert.equal(motivoValido(undefined), null);
  assert.equal(motivoValido(12345), null);
  assert.equal(motivoValido("abc", 3, 10), "abc");
  assert.equal(motivoValido("abc", 4, 10), null);
});

test("escapeHtml neutraliza marcação, aspas e e comercial", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  assert.equal(escapeHtml("Tom & Jerry's"), "Tom &amp; Jerry&#39;s");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
  assert.equal(escapeHtml(42), "42");
  assert.equal(escapeHtml("já escapado &amp;"), "já escapado &amp;amp;", "escapa de novo, nunca confia no que já veio");
});

test("pedirMotivo sem navegador e sem host devolve null (não executa a ação)", async () => {
  assert.equal(await pedirMotivo({ titulo: "t", mensagem: "m" }), null);
});
