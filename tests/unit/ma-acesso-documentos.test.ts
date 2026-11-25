// /api/ma/documents com acesso por papel e por dono (BRIEF 2026-11-24): matriz de papéis, Lixeira, recorte e categorias.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  podeAcessarDeal, podeExcluir, documentosVisiveis, checarCategoria, podeSubstituir, LINK_DOCUMENTO_SEGUNDOS,
} from "../../lib/ma/acesso-documentos";

const DONO = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";
const deal = { assigned_to: DONO, created_by: DONO, deleted_at: null };
const lixeira = { ...deal, deleted_at: "2026-11-15T00:00:00Z" };

test("equipe acessa qualquer deal, inclusive alheio; deal inexistente não", () => {
  for (const p of ["ADMIN", "GESTAO", "MESA_OPERACIONAL"]) {
    assert.equal(podeAcessarDeal(p, deal, OUTRO), true, p);
    assert.equal(podeAcessarDeal(p, lixeira, OUTRO), true, p);
    assert.equal(podeAcessarDeal(p, null, OUTRO), false, p);
  }
});

test("não equipe: só deal ativo em que é dono; Lixeira e alheio negados", () => {
  for (const p of ["MESA", "PARTNER", "PARTNER_PRO", "STARTER", "DIAMANTE", "GOLD", "ENTERPRISE", "INSTITUICAO", null]) {
    assert.equal(podeAcessarDeal(p, deal, DONO), true, String(p));
    assert.equal(podeAcessarDeal(p, deal, OUTRO), false, String(p));
    assert.equal(podeAcessarDeal(p, lixeira, DONO), false, String(p));
    assert.equal(podeAcessarDeal(p, null, DONO), false, String(p));
  }
  assert.equal(podeAcessarDeal("PARTNER", { assigned_to: OUTRO, created_by: DONO }, DONO), true); // criador continua dono
});

test("exclusão só pela equipe", () => {
  assert.equal(podeExcluir("ADMIN"), true);
  assert.equal(podeExcluir("MESA_OPERACIONAL"), true);
  assert.equal(podeExcluir("MESA"), false);
  assert.equal(podeExcluir("PARTNER_PRO"), false);
  assert.equal(podeExcluir(undefined), false);
});

test("recorte: não equipe vê só o que enviou; equipe vê tudo; ordem decrescente", () => {
  const docs = [
    { doc_id: "a", uploaded_by: DONO, uploaded_at: "2026-11-01T10:00:00Z" },
    { doc_id: "b", uploaded_by: OUTRO, uploaded_at: "2026-11-03T10:00:00Z" },
    { doc_id: "c", uploaded_by: DONO, uploaded_at: "2026-11-02T10:00:00Z" },
    { doc_id: "d", uploaded_by: null, uploaded_at: "2026-11-04T10:00:00Z" },
  ];
  assert.deepEqual(documentosVisiveis("PARTNER", docs, DONO).map(d => d.doc_id), ["c", "a"]);
  assert.deepEqual(documentosVisiveis("MESA", docs, OUTRO).map(d => d.doc_id), ["b"]);
  assert.deepEqual(documentosVisiveis("ADMIN", docs, OUTRO).map(d => d.doc_id), ["d", "b", "c", "a"]);
  assert.equal(docs[0].doc_id, "a"); // não altera a lista original
});

test("categoria: lista fechada; NDA, Contrato e Closing só para a equipe", () => {
  assert.deepEqual(checarCategoria("PARTNER", "Due_Diligence"), { ok: true });
  const proibida = checarCategoria("PARTNER", "Contrato");
  assert.equal(proibida.ok, false);
  if (!proibida.ok) { assert.equal(proibida.status, 403); assert.match(proibida.erro, /Contrato/); }
  assert.deepEqual(checarCategoria("ADMIN", "Contrato"), { ok: true });
  const invalida = checarCategoria("ADMIN", "Qualquer");
  assert.equal(invalida.ok, false);
  if (!invalida.ok) assert.equal(invalida.status, 400);
});

test("substituição: não equipe só troca o que ele enviou", () => {
  assert.equal(podeSubstituir("PARTNER", undefined, DONO), true);
  assert.equal(podeSubstituir("PARTNER", { doc_id: "x", uploaded_by: DONO }, DONO), true);
  assert.equal(podeSubstituir("PARTNER", { doc_id: "x", uploaded_by: OUTRO }, DONO), false);
  assert.equal(podeSubstituir("PARTNER", { doc_id: "x", uploaded_by: null }, DONO), false);
  assert.equal(podeSubstituir("GESTAO", { doc_id: "x", uploaded_by: OUTRO }, DONO), true);
});

test("link assinado de 1 hora", () => {
  assert.equal(LINK_DOCUMENTO_SEGUNDOS, 3600);
});
