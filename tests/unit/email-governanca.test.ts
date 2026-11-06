// Destinatário do e-mail de governança (decisão do Robson/João, 02/11/2026): endereço da V3, nunca o Gmail pessoal.
// O lookupEmail de lib/ncnda-desk-head.ts é a chave de busca do perfil (login real) e fica de fora desta regra.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const raiz = path.resolve(__dirname, "..", "..");
const lista = [
  "lib/governance-delete.ts",
  "app/api/cm/listings/[id]/delete/route.ts",
  "app/api/cm/listings/[id]/nda-authorize/route.ts",
  "app/api/cm/deal-room/[token]/route.ts",
  "lib/socios-notify.ts",
];

test("as listas de destinatário usam o e-mail da V3 do Robson", () => {
  for (const f of lista) {
    const s = fs.readFileSync(path.join(raiz, f), "utf8");
    assert.match(s, /robson\.lino@v3partners\.com\.br/, f);
    assert.doesNotMatch(s, /robinholino16@gmail\.com/, f);
  }
});

test("o login real continua só como chave de busca de perfil", () => {
  const s = fs.readFileSync(path.join(raiz, "lib/ncnda-desk-head.ts"), "utf8");
  assert.match(s, /lookupEmail: "robinholino16@gmail\.com"/);
  assert.doesNotMatch(s, /notifyEmail: "robinholino16/);
});
