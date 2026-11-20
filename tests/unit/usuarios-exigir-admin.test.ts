import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarAcessoAdmin } from "../../lib/usuarios/exigir-admin";

test("sem usuário: 401", () => {
  assert.deepEqual(avaliarAcessoAdmin(null, null), { ok: false, status: 401, error: "Não autorizado" });
  assert.deepEqual(avaliarAcessoAdmin(undefined, "ADMIN"), { ok: false, status: 401, error: "Não autorizado" });
});

test("logado sem ADMIN: 403 (partner, enterprise, equipe interna)", () => {
  for (const role of ["PARTNER", "PARTNER_PRO", "STARTER", "GOLD", "DIAMANTE", "ENTERPRISE", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO", "SDR", "CLOSER", null]) {
    const d = avaliarAcessoAdmin("u1", role);
    assert.equal(d.ok, false, String(role));
    if (!d.ok) assert.equal(d.status, 403);
  }
});

test("ADMIN: ok", () => {
  assert.deepEqual(avaliarAcessoAdmin("u1", "ADMIN"), { ok: true });
});

test("papel não é lido de forma frouxa (caixa e espaços não viram ADMIN)", () => {
  assert.equal(avaliarAcessoAdmin("u1", "admin").ok, false);
  assert.equal(avaliarAcessoAdmin("u1", " ADMIN").ok, false);
});
