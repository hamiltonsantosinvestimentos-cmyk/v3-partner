// BRIEF docs/briefs/2026-11-27_kanban-consorcio-projetos.md
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agruparPorColuna, comentariosVisiveis, divergenciaStatusEtapa, etapaDaOferta, ordenarCardsDaColuna, podeComentar,
  podeMover, podeNotaInterna, textoEvento, validarTexto, visibilidadeGravada, ETAPAS_OFERTA,
} from "../../lib/consorcio/kanban";

const v = (papel: string, interno: boolean, id: string, equipe: string[]) => ({ id, papel, interno, equipe });
const ADMIN = v("ADMIN", true, "adm", []);
const GESTAO = v("GESTAO", true, "ges", []);
const MESA = v("MESA_OPERACIONAL", true, "mesa", []);
const U1 = v("ENTERPRISE", false, "U1", ["U1"]);
const MX = v("ENTERPRISE", false, "MX", ["MX", "U1", "U2"]);
const MY = v("ENTERPRISE", false, "MY", ["MY", "U3"]);
const A = v("PARTNER", false, "A", ["A"]);

test("quem move: só ADMIN e GESTAO", () => {
  assert.equal(podeMover("ADMIN"), true);
  assert.equal(podeMover("GESTAO"), true);
  for (const p of ["MESA_OPERACIONAL", "PARTNER", "ENTERPRISE", "STARTER", null, undefined]) assert.equal(podeMover(p), false, String(p));
});

test("quem comenta", () => {
  const item = { created_by: "U1" };
  assert.equal(podeComentar(ADMIN, item), true);
  assert.equal(podeComentar(GESTAO, item), true);
  assert.equal(podeComentar(MESA, item), false, "mesa só lê");
  assert.equal(podeComentar(U1, item), true, "quem enviou");
  assert.equal(podeComentar(MX, item), true, "master da equipe");
  assert.equal(podeComentar(v("ENTERPRISE", false, "U2", ["U2"]), item), false, "colega");
  assert.equal(podeComentar(MY, item), false, "outro master");
  assert.equal(podeComentar(A, item), false, "partner avulso");
  assert.equal(podeComentar(U1, { created_by: null }), false);
  assert.equal(podeNotaInterna(ADMIN), true);
  assert.equal(podeNotaInterna(MESA), false);
  assert.equal(podeNotaInterna(U1), false);
});

test("nota interna nunca sai para não interno; partner grava sempre visível", () => {
  const lista = [{ id: 1, visivel_partner: true }, { id: 2, visivel_partner: false }, { id: 3, visivel_partner: true }];
  assert.deepEqual(comentariosVisiveis(U1, lista).map((c) => c.id), [1, 3]);
  assert.deepEqual(comentariosVisiveis(MX, lista).map((c) => c.id), [1, 3]);
  assert.deepEqual(comentariosVisiveis(MESA, lista).map((c) => c.id), [1, 2, 3]);
  assert.equal(visibilidadeGravada(U1, false), true, "partner não faz nota interna");
  assert.equal(visibilidadeGravada(MX, false), true);
  assert.equal(visibilidadeGravada(ADMIN, false), false);
  assert.equal(visibilidadeGravada(ADMIN, undefined), true);
});

test("validação do texto", () => {
  assert.equal(validarTexto("").ok, false);
  assert.equal(validarTexto("   ").ok, false);
  assert.equal(validarTexto(null).ok, false);
  assert.equal(validarTexto("x".repeat(2001)).ok, false);
  const ok = validarTexto("  " + "x".repeat(2000) + "  ");
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.texto.length, 2000);
});

test("etapas, evento e divergência", () => {
  assert.equal(etapaDaOferta(null), "NOVA");
  assert.equal(etapaDaOferta("XYZ"), "NOVA");
  assert.equal(etapaDaOferta("PERDIDA"), "PERDIDA");
  assert.equal(ETAPAS_OFERTA.length, 6);
  assert.equal(textoEvento("Nova", "Em cotação"), "Etapa: Nova → Em cotação");
  assert.equal(divergenciaStatusEtapa("aceita", "PERDIDA"), "Status da oferta: Aceita");
  assert.equal(divergenciaStatusEtapa("aceita", "CONCLUIDA"), null);
  assert.equal(divergenciaStatusEtapa("cancelada", "NEGOCIANDO"), "Status da oferta: Cancelada");
  assert.equal(divergenciaStatusEtapa("recusada", "PERDIDA"), null);
  assert.equal(divergenciaStatusEtapa("pendente", null), null);
});

test("ordem dentro da coluna e agrupamento", () => {
  const itens = [
    { code: "B", created_at: "2026-11-20", col: "NOVA" },
    { code: "A", created_at: "2026-11-25", col: "NOVA" },
    { code: "C", created_at: "2026-11-25", col: "NOVA" },
    { code: "D", created_at: "2026-11-26", col: "PERDIDA" },
    { code: "E", created_at: "2026-11-27", col: "LIXO" },
  ];
  assert.deepEqual(ordenarCardsDaColuna(itens.slice(0, 3)).map((i) => i.code), ["A", "C", "B"]);
  const g = agruparPorColuna(["NOVA", "PERDIDA"], itens, (i) => i.col);
  assert.deepEqual(g.NOVA.map((i) => i.code), ["E", "A", "C", "B"], "coluna desconhecida cai na primeira");
  assert.deepEqual(g.PERDIDA.map((i) => i.code), ["D"]);
});
