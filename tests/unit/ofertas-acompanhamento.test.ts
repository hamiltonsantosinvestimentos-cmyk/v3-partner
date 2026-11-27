// BRIEF docs/briefs/2026-11-27_ofertas-cota-contemplada-em-projetos.md
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMPOS_INTERNO, CAMPOS_PARTNER, mascararDocumentoOferta, ofertaParaAcompanhamento, ordenarOfertas,
  origemDaOferta, podeVerOferta, rotuloStatusOferta,
} from "../../lib/consorcio/ofertas-acompanhamento";

// Equipe X: master MX com usuários U1 e U2. Equipe Y: master MY com usuário U3. Partners avulsos A e B.
const interno = { id: "adm", interno: true, equipe: [] };
const A = { id: "A", interno: false, equipe: ["A"] };
const B = { id: "B", interno: false, equipe: ["B"] };
const U1 = { id: "U1", interno: false, equipe: ["U1"] };
const MX = { id: "MX", interno: false, equipe: ["MX", "U1", "U2"] };
const U3 = { id: "U3", interno: false, equipe: ["U3"] };
const MY = { id: "MY", interno: false, equipe: ["MY", "U3"] };
const de = (created_by: string | null) => ({ created_by });

test("podeVerOferta: matriz de acesso", () => {
  for (const c of ["A", "B", "U1", "U2", "MX", "U3", "MY", null]) assert.equal(podeVerOferta(interno, de(c)), true, `interno ${c}`);
  assert.equal(podeVerOferta(A, de("A")), true);
  assert.equal(podeVerOferta(B, de("A")), false);
  assert.equal(podeVerOferta(U1, de("U1")), true);
  assert.equal(podeVerOferta(U1, de("U2")), false, "colega");
  assert.equal(podeVerOferta(U1, de("MX")), false, "master");
  assert.equal(podeVerOferta(MX, de("MX")), true);
  assert.equal(podeVerOferta(MX, de("U1")), true);
  assert.equal(podeVerOferta(MX, de("U2")), true);
  assert.equal(podeVerOferta(MX, de("U3")), false, "equipe de outro master");
  assert.equal(podeVerOferta(U3, de("U1")), false);
  assert.equal(podeVerOferta(MY, de("U1")), false);
  assert.equal(podeVerOferta(A, de(null)), false, "sem created_by");
});

const linha = {
  id: "o1", carta_id: "c1", carta_code: "CC-1", carta_credit_value: "300000", valor_oferta: 120000,
  interessado_nome: "Fulano", interessado_tel: "+55 11 99999-0000", interessado_cpf_cnpj: "123.456.789-01",
  observacoes: "OBS-SECRETA", responsavel_nome: "RESP-SECRETO", status: "pendente",
  created_at: "2026-11-27T10:00:00Z", created_by: "U1",
};

test("ofertaParaAcompanhamento: paridade de chaves e nada além da lista", () => {
  const p = ofertaParaAcompanhamento(linha, "partner", { ofertadoPor: "Ana" });
  assert.deepEqual(Object.keys(p).sort(), [...CAMPOS_PARTNER].sort());
  const i = ofertaParaAcompanhamento(linha, "interno", { ofertadoPor: "Ana", origem: "AGS Finance" });
  assert.deepEqual(Object.keys(i).sort(), [...CAMPOS_INTERNO].sort());
  for (const j of [JSON.stringify(p), JSON.stringify(i)]) {
    for (const s of ["99999-0000", "OBS-SECRETA", "RESP-SECRETO", "123.456.789-01", "12345678901"]) assert.equal(j.includes(s), false, s);
  }
  assert.equal("carta_id" in p, false);
  assert.equal("origem" in p, false);
  assert.equal(p.interessado_documento, "***.456.789-**");
  assert.equal(p.carta_credit_value, 300000);
});

test("mascararDocumentoOferta: nunca devolve o valor cru", () => {
  const casos: [string | null | undefined, string][] = [
    ["123.456.789-01", "***.456.789-**"],
    ["12345678901", "***.456.789-**"],
    ["12.345.678/0001-90", "12.345.678/****-**"],
    ["12345678000190", "12.345.678/****-**"],
    ["12.ABC.345/01DE-35", "12.ABC.345/****-**"],
    ["abc", "Documento informado"],
    ["1234567890123", "Documento informado"],
    ["", "Não informado"],
    [null, "Não informado"],
    [undefined, "Não informado"],
  ];
  for (const [entrada, esperado] of casos) {
    const r = mascararDocumentoOferta(entrada);
    assert.equal(r, esperado, String(entrada));
    if (entrada) assert.notEqual(r, entrada);
  }
});

test("origemDaOferta: os 4 casos", () => {
  const marcas = new Map<string, { nome: string } | null>([["E1", { nome: "AGS Finance" }], ["P1", null]]);
  assert.equal(origemDaOferta(marcas, "X", true), "Equipe V3");
  assert.equal(origemDaOferta(marcas, "E1", false), "AGS Finance");
  assert.equal(origemDaOferta(marcas, "P1", false), "Rede V3");
  assert.equal(origemDaOferta(marcas, "Z", false), "Não identificada");
  assert.equal(origemDaOferta(new Map(), "E1", false), "Não identificada");
});

test("ordenarOfertas e rótulos", () => {
  const r = ordenarOfertas([
    { status: "cancelada", created_at: "2026-11-27" },
    { status: "aceita", created_at: "2026-11-20" },
    { status: "pendente", created_at: "2026-11-01" },
    { status: "pendente", created_at: "2026-11-25" },
    { status: "recusada", created_at: "2026-11-26" },
  ]);
  assert.deepEqual(r.map((x) => `${x.status}:${x.created_at}`), [
    "pendente:2026-11-25", "pendente:2026-11-01", "aceita:2026-11-20", "recusada:2026-11-26", "cancelada:2026-11-27",
  ]);
  assert.equal(rotuloStatusOferta("pendente"), "Em análise");
  assert.equal(rotuloStatusOferta("cancelada"), "Cancelada (outra oferta aceita)");
});
