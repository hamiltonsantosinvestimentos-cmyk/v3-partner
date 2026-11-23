// BRIEF docs/briefs/2026-11-23_enterprise-menu-enxuto-e-comissoes.md
import { test } from "node:test";
import assert from "node:assert/strict";
import { visaoDoUsuario } from "../../app/api/enterprise/repasses/visao-usuario";
import { ehEnterprise, MENSAGEM_BLOQUEIO_ENTERPRISE } from "../../lib/enterprise-bloqueio";
import type { RepasseLinha } from "../../lib/enterprise-repasses";

const linha = (id: string, criadoEm: string, extra: Partial<RepasseLinha> = {}): RepasseLinha => ({
  id, usuarioId: "u1", usuarioNome: "Teste", operacao: `OP-${id}`, descricao: null,
  comissaoMaster: 10000, comissaoStatus: "APROVADA", percentual: 30, valor: 3000,
  status: "PENDENTE", pagoEm: null, criadoEm, ...extra,
});

test("usuário da equipe não recebe valor do master, % nem resumo por usuário", () => {
  const v = visaoDoUsuario({ linhas: [linha("a", "2026-11-01T10:00:00Z"), linha("b", "2026-11-20T10:00:00Z", { status: "PAGO", pagoEm: "2026-11-21T01:00:00Z" })], totais: { total: 6000, pendente: 3000, pago: 3000 } });
  const json = JSON.stringify(v);
  for (const proibido of ["comissaoMaster", "percentual", "porUsuario", "usuarioNome", "comissaoStatus", "10000"]) assert.ok(!json.includes(proibido), proibido);
  assert.deepEqual(Object.keys(v.linhas[0]).sort(), ["criadoEm", "id", "operacao", "pagoEm", "status", "valor"]);
  assert.equal(v.linhas[0].id, "b", "ordem por data desc");
  assert.deepEqual(v.totais, { total: 6000, pendente: 3000, pago: 3000 });
});

test("bloqueio só para o papel ENTERPRISE", () => {
  assert.equal(ehEnterprise("ENTERPRISE"), true);
  for (const r of ["PARTNER", "PARTNER_PRO", "ADMIN", "GOLD", null, undefined]) assert.equal(ehEnterprise(r as string | null | undefined), false);
  assert.ok(!MENSAGEM_BLOQUEIO_ENTERPRISE.includes("—"));
});
