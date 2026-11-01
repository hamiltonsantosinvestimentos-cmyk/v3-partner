import { test } from "node:test";
import assert from "node:assert/strict";
import { resolverAcessoTickets } from "../../lib/mesa-operacional/acesso";

const ID = "9e829800-951e-4b23-b2ee-cdb63d46b44b";
const OUTRO = "75c6cac4-8d30-436e-b9a6-d5d494d7470b";

test("sem usuário, nunca equipe", () => {
  assert.deepEqual(resolverAcessoTickets(null, { id: ID, role: "ADMIN" }), { tipo: "negado" });
  assert.deepEqual(resolverAcessoTickets(undefined, { id: ID, role: "MESA_OPERACIONAL" }), { tipo: "negado" });
  assert.deepEqual(resolverAcessoTickets({}, { id: ID, role: "ADMIN" }), { tipo: "negado" });
  assert.deepEqual(resolverAcessoTickets({ id: "" }, { id: "", role: "ADMIN" }), { tipo: "negado" });
});

test("id que não é UUID é negado (não vai para filtro de consulta)", () => {
  assert.deepEqual(resolverAcessoTickets({ id: "x,assigned_to.not.is.null" }, { id: "x,assigned_to.not.is.null", role: "PARTNER" }), { tipo: "negado" });
});

test("sem perfil, nunca equipe (o caso do papel padrão antigo)", () => {
  assert.deepEqual(resolverAcessoTickets({ id: ID }, null), { tipo: "negado" });
  assert.deepEqual(resolverAcessoTickets({ id: ID }, undefined), { tipo: "negado" });
});

test("perfil de outro usuário é negado", () => {
  assert.deepEqual(resolverAcessoTickets({ id: ID }, { id: OUTRO, role: "ADMIN" }), { tipo: "negado" });
});

test("papel nulo, vazio ou só espaços é negado", () => {
  for (const role of [null, undefined, "", "   "]) {
    assert.deepEqual(resolverAcessoTickets({ id: ID }, { id: ID, role }), { tipo: "negado" }, String(role));
  }
});

test("os três papéis de equipe veem tudo", () => {
  for (const role of ["ADMIN", "GESTAO", "MESA_OPERACIONAL"]) {
    assert.deepEqual(resolverAcessoTickets({ id: ID }, { id: ID, role }), { tipo: "equipe", id: ID }, role);
  }
});

test("partner e papel inesperado ficam como comum, só com o próprio id", () => {
  for (const role of ["PARTNER", "PARTNER_PRO", "GOLD", "INSTITUICAO", "FINANCEIRO", "PAPEL_QUE_NAO_EXISTE", "admin"]) {
    assert.deepEqual(resolverAcessoTickets({ id: ID }, { id: ID, role }), { tipo: "comum", id: ID }, role);
  }
});
