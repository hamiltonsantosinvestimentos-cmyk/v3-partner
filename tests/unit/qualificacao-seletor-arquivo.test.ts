// Regressão de 29/10/2026 (PR #335): a nota do porquê (<button>) dentro do <label> do seletor de arquivo,
// ANTES do <input type="file">, fazia o clique abrir a nota e nunca o seletor. Um <label> sem "for" aciona o
// primeiro elemento de formulário dentro dele. Teste de código-fonte: sem DOM, protege a ordem dos elementos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SRC = readFileSync("app/intake/qualificacao/[token]/page.tsx", "utf8");

test("em todo <label> com seletor de arquivo, o <input type=file> vem antes de qualquer <Dica>", () => {
  const labels = [...SRC.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map((m) => m[1]).filter((b) => b.includes('type="file"'));
  assert.ok(labels.length >= 1, "nenhum seletor de arquivo encontrado: o teste ficou cego");
  for (const body of labels) {
    const input = body.indexOf('type="file"');
    const dica = body.indexOf("<Dica");
    if (dica !== -1) assert.ok(input < dica, "a Dica está antes do input de arquivo: o clique no label abriria a nota, não o seletor");
    assert.equal((body.match(/<button\b/g) ?? []).length, 0, "não pode haver <button> literal dentro do label do seletor");
  }
});
