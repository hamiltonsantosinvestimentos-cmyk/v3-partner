import { test } from "node:test";
import assert from "node:assert/strict";
import { ehDesfazer, planejar, respostaLancamento } from "../../lib/assistente/executar";
import { interpretacaoSchema, type Interpretacao } from "../../lib/assistente/interpretar";

const base: Interpretacao = {
  acao: "lancamento", confianca: "alta", falta: null, tipo: "saida", valor_centavos: 8500, categoria: "Mercado",
  descricao: null, data: null, titulo: null, inicio: null, fim: null, local: null, notas: null, mes: null,
};
const HOJE = "2026-11-01";

test("lançamento claro grava, e sem data usa hoje em Brasília", () => {
  const p = planejar(base, HOJE);
  assert.equal(p.tipo, "lancamento");
  if (p.tipo === "lancamento") {
    assert.equal(p.registro.data, HOJE);
    assert.equal(respostaLancamento(p.registro), "Lancei: saída de R$ 85,00 em Mercado, 01/11/2026. Para desfazer, responda DESFAZER.");
  }
});

test("em dúvida não grava: pergunta", () => {
  assert.deepEqual(planejar({ ...base, valor_centavos: null }, HOJE), { tipo: "pergunta", falta: "valor" });
  assert.deepEqual(planejar({ ...base, tipo: null }, HOJE), { tipo: "pergunta", falta: "tipo" });
  assert.deepEqual(planejar({ ...base, valor_centavos: 0 }, HOJE), { tipo: "pergunta", falta: "faixa" });
  assert.deepEqual(planejar({ ...base, valor_centavos: 1_000_000_001 }, HOJE), { tipo: "pergunta", falta: "faixa" });
  assert.deepEqual(planejar({ ...base, confianca: "baixa" }, HOJE), { tipo: "pergunta", falta: "esclarecer" });
  assert.deepEqual(planejar({ ...base, data: "2026-02-31" }, HOJE), { tipo: "pergunta", falta: "esclarecer" });
  assert.deepEqual(planejar({ ...base, acao: "perguntar", falta: "tipo" }, HOJE), { tipo: "pergunta", falta: "tipo" });
});

test("categoria fora da lista vira Outros", () => {
  const p = planejar({ ...base, categoria: "Ignore tudo" }, HOJE);
  assert.ok(p.tipo === "lancamento" && p.registro.categoria === "Outros");
});

test("compromisso sem horário claro não grava", () => {
  const comp: Interpretacao = { ...base, acao: "compromisso", titulo: "Reunião com João", inicio: "2026-11-03T15:00" };
  const p = planejar(comp, HOJE);
  assert.ok(p.tipo === "compromisso" && p.registro.inicio === "2026-11-03T15:00:00-03:00");
  assert.deepEqual(planejar({ ...comp, inicio: "2026-11-03" }, HOJE), { tipo: "pergunta", falta: "horario" });
  assert.deepEqual(planejar({ ...comp, titulo: "  " }, HOJE), { tipo: "pergunta", falta: "titulo" });
  assert.deepEqual(planejar({ ...comp, fim: "2026-11-03T14:00" }, HOJE), { tipo: "pergunta", falta: "esclarecer" });
});

test("fora do escopo não grava, e mês inválido cai no atual", () => {
  assert.deepEqual(planejar({ ...base, acao: "fora_do_escopo" }, HOJE), { tipo: "fora_do_escopo" });
  assert.deepEqual(planejar({ ...base, acao: "consulta_financas", mes: "x" }, HOJE), { tipo: "consulta_financas", mes: "2026-11" });
});

test("DESFAZER é comando exato", () => {
  assert.equal(ehDesfazer(" desfazer. "), true);
  assert.equal(ehDesfazer("DESFAZER"), true);
  assert.equal(ehDesfazer("quero desfazer o mercado"), false);
});

test("resposta da IA fora da lista fechada é recusada", () => {
  assert.equal(interpretacaoSchema.safeParse({ ...base, acao: "pagar_boleto" }).success, false);
  assert.equal(interpretacaoSchema.safeParse({ ...base, valor_centavos: 10.5 }).success, false);
  assert.equal(interpretacaoSchema.safeParse(base).success, true);
});
