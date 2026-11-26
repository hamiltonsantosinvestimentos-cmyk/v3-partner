// BRIEF docs/briefs/2026-11-25_recuperar-senha-marca-enterprise.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { caminhoReenvio, daEquipe, normalizarEmail, podeEnviar } from "../../lib/recuperar-senha-regras";

test("normaliza o e-mail e recusa formato inválido", () => {
  assert.equal(normalizarEmail("  Ana@AGSFinance.app "), "ana@agsfinance.app");
  assert.equal(normalizarEmail("sem-arroba"), null);
  assert.equal(normalizarEmail(""), null);
  assert.equal(normalizarEmail(null), null);
  assert.equal(normalizarEmail("a@b.c" + "x".repeat(260)), null);
});

test("daEquipe: master e equipe sim; outra rede, outro papel e nulo não", () => {
  const M = "m1";
  assert.equal(daEquipe({ id: M, role: "ENTERPRISE", enterprise_id: null }, M), true);
  assert.equal(daEquipe({ id: "u1", role: "ENTERPRISE", enterprise_id: M }, M), true);
  assert.equal(daEquipe({ id: "u2", role: "ENTERPRISE", enterprise_id: "outro" }, M), false);
  assert.equal(daEquipe({ id: "u3", role: "PARTNER", enterprise_id: M }, M), false);
  assert.equal(daEquipe(null, M), false);
});

const T0 = Date.parse("2026-11-25T20:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

test("podeEnviar: a primeira envia, a segunda em menos de 60 s não", () => {
  const r = [{ id: "a", created_at: iso(T0) }];
  assert.equal(podeEnviar(r, "a", 0, T0 + 1000), true);
  const r2 = [...r, { id: "b", created_at: iso(T0 + 5000) }];
  assert.equal(podeEnviar(r2, "b", 1, T0 + 6000), false);
  // passada a janela, a nova envia
  const r3 = [...r, { id: "c", created_at: iso(T0 + 61_000) }];
  assert.equal(podeEnviar(r3, "c", 1, T0 + 62_000), true);
});

test("podeEnviar: 10 reservas simultâneas resultam em só 1 envio", () => {
  const rs = Array.from({ length: 10 }, (_, i) => ({ id: `id${i}`, created_at: iso(T0 + (i % 3)) }));
  const enviam = rs.filter((r) => podeEnviar(rs, r.id, 0, T0 + 100)).length;
  assert.equal(enviam, 1);
});

test("podeEnviar: com 5 envios efetivos na hora o próximo não envia; reservas sem envio não contam", () => {
  const r = [{ id: "a", created_at: iso(T0) }];
  assert.equal(podeEnviar(r, "a", 5, T0 + 10), false);
  assert.equal(podeEnviar(r, "a", 4, T0 + 10), true);
});

test("caminhoReenvio: erro de leitura não segue para a senha fixa; equipe Enterprise vai pela marca", () => {
  assert.deepEqual(caminhoReenvio({ erro: true, perfil: null }), { tipo: "erro" });
  assert.deepEqual(caminhoReenvio({ erro: true, perfil: { id: "m1", role: "ENTERPRISE", enterprise_id: null } }), { tipo: "erro" });
  assert.deepEqual(caminhoReenvio({ erro: false, perfil: null }), { tipo: "antigo" });
  assert.deepEqual(caminhoReenvio({ erro: false, perfil: { id: "p1", role: "PARTNER", enterprise_id: null } }), { tipo: "antigo" });
  assert.deepEqual(caminhoReenvio({ erro: false, perfil: { id: "m1", role: "ENTERPRISE", enterprise_id: null } }), { tipo: "marca", masterId: "m1" });
  assert.deepEqual(caminhoReenvio({ erro: false, perfil: { id: "u1", role: "ENTERPRISE", enterprise_id: "m1" } }), { tipo: "marca", masterId: "m1" });
});
