// Contador de documentos do card da Mesa Operacional: mesma contagem da aba Documentos do modal.
import { test } from "node:test";
import assert from "node:assert/strict";
import { contarDocsChecklist, montarMapaPortfolio } from "../../lib/mesa-operacional/contador-docs";
import { CHECKLISTS, DEFAULT_CHECKLIST } from "../../lib/credit-checklists";

const LINHAS = [
  {
    nome: "Capital de Giro Imobiliário",
    documentos_pf: [
      { id: "a", nome: "RG", obrigatorio: true },
      { id: "b", nome: "Matrícula", obrigatorio: true, aplica: "imovel" },
      { id: "c", nome: "CCIR", obrigatorio: true, aplica: "rural" },
    ],
    documentos_pj: [{ id: "x", nome: "Contrato Social", obrigatorio: true }],
  },
  { nome: "Linha Sem Docs", documentos_pf: [], documentos_pj: null },
];

test("mapa: chave em minúsculas, linha sem documentos fica de fora, repetida: a última vence", () => {
  const mapa = montarMapaPortfolio([...LINHAS, { nome: "capital de giro imobiliário", documentos_pf: [{ id: "z" }] }]);
  assert.deepEqual(Object.keys(mapa), ["capital de giro imobiliário"]);
  assert.deepEqual(mapa["capital de giro imobiliário"].PF.map((d) => d.id), ["z"]);
  assert.deepEqual(mapa["capital de giro imobiliário"].PJ, []);
  assert.deepEqual(montarMapaPortfolio(null), {});
});

test("PF do portfólio: conta arquivo e marcação manual; doc_id livre não conta", () => {
  const mapa = montarMapaPortfolio(LINHAS);
  const r = contarDocsChecklist(
    {
      credit_line: "Capital de Giro Imobiliário",
      client_type: "PF",
      checklist: { b: true, c: false },
      documents: [{ doc_id: "a" }, { doc_id: "a" }, { doc_id: "outro_123" }],
    },
    mapa,
  );
  assert.deepEqual(r, { enviados: 2, total: 3 });
});

test("filtro de imóvel: urbano tira o item só rural; 'nao' tira os de imóvel", () => {
  const mapa = montarMapaPortfolio(LINHAS);
  const base = { credit_line: "capital de giro imobiliário", documents: [{ doc_id: "c" }] };
  assert.deepEqual(contarDocsChecklist({ ...base, metadata: { imovel_garantia: "urbano" } }, mapa), { enviados: 0, total: 2 });
  assert.deepEqual(contarDocsChecklist({ ...base, metadata: { imovel_garantia: "nao" } }, mapa), { enviados: 0, total: 1 });
  assert.deepEqual(contarDocsChecklist({ ...base, metadata: { imovel_garantia: "rural" } }, mapa), { enviados: 1, total: 3 });
});

test("tipo de cliente: metadata.client_type tem prioridade sobre a coluna", () => {
  const mapa = montarMapaPortfolio(LINHAS);
  const r = contarDocsChecklist(
    { credit_line: "Capital de Giro Imobiliário", client_type: "PF", metadata: { client_type: "PJ" }, documents: [{ doc_id: "x" }] },
    mapa,
  );
  assert.deepEqual(r, { enviados: 1, total: 1 });
});

test("sem linha no portfólio: cai na lista fixa (match exato) e depois no padrão", () => {
  const fixa = CHECKLISTS["Home Equity"].PJ;
  assert.deepEqual(
    contarDocsChecklist({ credit_line: "Home Equity", client_type: "PJ", documents: [{ doc_id: fixa[0].id }] }, {}),
    { enviados: 1, total: fixa.length },
  );
  assert.deepEqual(contarDocsChecklist({ credit_line: "Inexistente", client_type: null }, {}), {
    enviados: 0,
    total: DEFAULT_CHECKLIST.PF.length,
  });
  assert.deepEqual(contarDocsChecklist({}, {}), { enviados: 0, total: DEFAULT_CHECKLIST.PF.length });
});

test("dados malformados não quebram", () => {
  assert.deepEqual(
    contarDocsChecklist({ credit_line: "Inexistente", checklist: ["def_pf_1"], documents: "x", metadata: "y" }, {}),
    { enviados: 0, total: DEFAULT_CHECKLIST.PF.length },
  );
});
