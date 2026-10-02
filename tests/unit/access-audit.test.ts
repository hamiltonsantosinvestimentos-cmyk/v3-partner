// Auditoria de acessos (Compliance): filtros validados no servidor, cursor e CSV seguro.
import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, parseCursor, parseFilters } from "../../lib/access-audit";

test("CSV: prefixa apóstrofo contra injeção de fórmula e escapa aspas", () => {
  assert.equal(csvCell("=1+1"), `"'=1+1"`);
  assert.equal(csvCell("@cmd"), `"'@cmd"`);
  assert.equal(csvCell("-2"), `"'-2"`);
  assert.equal(csvCell('Maria "Zé" Silva'), `"Maria ""Zé"" Silva"`);
  assert.equal(csvCell(null), `""`);
});

test("filtros: período no fuso de São Paulo e validação", () => {
  const ok = parseFilters(new URLSearchParams("from=2026-10-01&to=2026-10-02&type=campo"));
  assert.ok(ok.ok);
  if (ok.ok) {
    assert.equal(ok.fromIso, "2026-10-01T03:00:00.000Z");
    assert.equal(ok.toIso, "2026-10-03T02:59:59.999Z");
  }
  assert.equal(parseFilters(new URLSearchParams("type=xyz")).ok, false);
  assert.equal(parseFilters(new URLSearchParams("from=01/10/2026")).ok, false);
  assert.equal(parseFilters(new URLSearchParams("user=nao-e-uuid")).ok, false);
});

test("cursor: aceita data e uuid, rejeita lixo", () => {
  const id = "8a1f3c52-7d9e-4b21-9c5a-0e6f4d2a1b37";
  assert.deepEqual(parseCursor(`2026-10-02T12:00:00.000Z|${id}`), { at: "2026-10-02T12:00:00.000Z", id });
  assert.equal(parseCursor("lixo"), null);
  assert.equal(parseCursor(null), null);
});
