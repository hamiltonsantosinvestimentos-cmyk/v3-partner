import test from "node:test";
import assert from "node:assert/strict";
import { NOTAS_DO_PORQUE } from "@/lib/notas-do-porque";

test("toda nota tem titulo e texto, sem travessao nem emoji", () => {
  const ids = Object.keys(NOTAS_DO_PORQUE) as (keyof typeof NOTAS_DO_PORQUE)[];
  assert.ok(ids.length >= 21);
  for (const id of ids) {
    const n = NOTAS_DO_PORQUE[id];
    assert.ok(n.titulo.length > 0 && n.texto.length > 20, id);
    assert.ok(!/[—–]/.test(n.texto + n.titulo), `${id}: travessao`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(n.texto), `${id}: emoji`);
    assert.ok(!/bloxs/i.test(n.texto), `${id}: bloxs`);
  }
});
