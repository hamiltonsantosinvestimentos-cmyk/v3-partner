import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirModoAdmin, ehUuid, masterDaUrl } from "../../lib/enterprise-admin-modo";

const M = "57375034-ee87-4b29-a784-2220037c4802";
const master = { role: "ENTERPRISE", enterprise_id: null };

test("ADMIN + master válido em rota com modo ADMIN: ok", () => {
  assert.deepEqual(decidirModoAdmin({ permitirAdmin: true, callerRole: "ADMIN", masterParam: M, alvo: master }), { ok: true });
});

test("ADMIN + usuário filho (não master): 404", () => {
  const d = decidirModoAdmin({ permitirAdmin: true, callerRole: "ADMIN", masterParam: M, alvo: { role: "ENTERPRISE", enterprise_id: "outro" } });
  assert.equal(d.ok, false); if (!d.ok) assert.equal(d.status, 404);
});

test("ADMIN + uuid inexistente ou perfil não Enterprise: 404; valor não uuid: 400", () => {
  for (const alvo of [null, { role: "PARTNER", enterprise_id: null }]) {
    const d = decidirModoAdmin({ permitirAdmin: true, callerRole: "ADMIN", masterParam: M, alvo });
    assert.equal(d.ok, false); if (!d.ok) assert.equal(d.status, 404);
  }
  const d = decidirModoAdmin({ permitirAdmin: true, callerRole: "ADMIN", masterParam: "abc", alvo: master });
  assert.equal(d.ok, false); if (!d.ok) assert.equal(d.status, 400);
});

test("Enterprise A com ?master=B, usuário filho, PARTNER, GESTAO, MESA_OPERACIONAL: 403", () => {
  for (const callerRole of ["ENTERPRISE", "PARTNER", "PARTNER_PRO", "GESTAO", "MESA_OPERACIONAL", "FINANCEIRO", null]) {
    const d = decidirModoAdmin({ permitirAdmin: true, callerRole, masterParam: M, alvo: master });
    assert.equal(d.ok, false, String(callerRole)); if (!d.ok) assert.equal(d.status, 403);
  }
});

test("rota sem modo ADMIN (POST/PATCH usuarios, PATCH repasses): 403 mesmo para ADMIN", () => {
  const d = decidirModoAdmin({ permitirAdmin: false, callerRole: "ADMIN", masterParam: M, alvo: master });
  assert.equal(d.ok, false); if (!d.ok) assert.equal(d.status, 403);
});

test("papel não é lido de forma frouxa", () => {
  assert.equal(decidirModoAdmin({ permitirAdmin: true, callerRole: "admin", masterParam: M, alvo: master }).ok, false);
});

test("masterDaUrl e ehUuid", () => {
  assert.equal(masterDaUrl(`https://app.v3partners.com.br/api/enterprise/marca?master=${M}`), M);
  assert.equal(masterDaUrl("https://app.v3partners.com.br/api/enterprise/marca"), null);
  assert.equal(masterDaUrl("https://x/api?mes=todos&master=" + M), M);
  assert.equal(ehUuid(M), true);
  assert.equal(ehUuid("57375034"), false);
});
