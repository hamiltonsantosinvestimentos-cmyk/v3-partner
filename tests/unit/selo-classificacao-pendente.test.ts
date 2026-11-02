// O selo de classificação pendente aparece nas telas da equipe e não sai de nenhuma rota de partner
// (BRIEF Mesa M&A bloco C, segunda entrega, 01/11/2026). Guarda estrutural: o campo só vem do filtro por papel.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(__dirname, "..", "..");
const ler = (p: string) => fs.readFileSync(path.join(raiz, p), "utf8");

test("as quatro telas da equipe usam o selo", () => {
  assert.match(ler("components/cm/kanban-card.tsx"), /classificacao_pendente && <SeloClassificacaoPendente/);
  assert.match(ler("components/cm/mesa-capitais-client.tsx"), /classificacao_pendente && <> <SeloClassificacaoPendente/);
  const c = ler("components/mesa-credito/credit-desk-client.tsx");
  assert.equal((c.match(/classificacao_pendente && <(>)? ?<?SeloClassificacaoPendente/g) ?? []).length, 2);
  assert.match(c, /classificacao_pendente: p\.classificacao_pendente === true/);
});

test("a tela do partner (sell-side) não usa o selo nem o campo", () => {
  const s = ler("components/cm/sell-side-listings-panel.tsx");
  assert.doesNotMatch(s, /classificacao_pendente|SeloClassificacaoPendente/);
});

test("o selo não usa fonte menor que 12px em ouro padrão", () => {
  const sel = ler("components/shared/selo-classificacao-pendente.tsx");
  assert.match(sel, /text-\[#E8C97A\]/);
  assert.doesNotMatch(sel, /text-\[#C9A84C\]/);
});
