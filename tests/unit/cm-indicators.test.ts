// Indicadores e gargalos (Bloco 4): validacao da logica pura. Regras do BRIEF REVISAO v2.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SALE_STAGES, BUY_STAGES, TERMINAL_STAGES, NOT_CATEGORIZED_LABEL,
  calendarDaysSp, periodStart, spDateKey, median, entryDate, buildFunnel, buildStageTimes, buildReasons, reasonLabel,
  type Entity, type Transition,
} from "../../lib/cm-indicators";

const d = (iso: string) => new Date(iso);
const NOW = d("2026-10-08T15:00:00.000Z"); // 12:00 em Sao Paulo

test("dias: diferenca de datas-calendario em Sao Paulo, nao de instantes UTC", () => {
  // 23:30 em SP de 06/10 (02:30Z de 07/10) ate 00:30 em SP de 07/10 (03:30Z): 1 dia-calendario, apesar de 1h de distancia
  assert.equal(calendarDaysSp(d("2026-10-07T02:30:00Z"), d("2026-10-07T03:30:00Z")), 1);
  // mesmo dia em SP: 0, mesmo com 20h de distancia
  assert.equal(calendarDaysSp(d("2026-10-07T03:10:00Z"), d("2026-10-08T02:50:00Z")), 0);
  // nunca negativo
  assert.equal(calendarDaysSp(d("2026-10-08T12:00:00Z"), d("2026-10-01T12:00:00Z")), 0);
});

test("dia-calendario usa Sao Paulo (UTC-3)", () => {
  assert.equal(spDateKey(d("2026-10-08T02:59:00Z")), "2026-10-07");
  assert.equal(spDateKey(d("2026-10-08T03:00:00Z")), "2026-10-08");
});

test("periodo: comeca as 00:00 de Sao Paulo de (hoje menos N dias); Tudo = sem corte", () => {
  assert.equal(periodStart(30, NOW)?.toISOString(), "2026-09-08T03:00:00.000Z");
  assert.equal(periodStart(90, NOW)?.toISOString(), "2026-07-10T03:00:00.000Z");
  assert.equal(periodStart(null, NOW), null);
});

test("mediana", () => {
  assert.equal(median([]), null);
  assert.equal(median([3]), 3);
  assert.equal(median([1, 9, 5]), 5);
  assert.equal(median([1, 3, 5, 9]), 4);
});

test("data de entrada na etapa: transicao, depois criacao, updated_at so como ultimo recurso", () => {
  const e: Entity = { id: "a", status: "em_analise", createdAt: d("2026-09-01T12:00:00Z"), updatedAt: d("2026-10-07T12:00:00Z") };
  assert.deepEqual(entryDate(e, d("2026-09-20T12:00:00Z")), { at: d("2026-09-20T12:00:00Z"), source: "transicao" });
  assert.deepEqual(entryDate(e, null), { at: d("2026-09-01T12:00:00Z"), source: "criacao" });
  assert.deepEqual(entryDate({ ...e, createdAt: null }, null), { at: d("2026-10-07T12:00:00Z"), source: "atualizacao" });
  assert.equal(entryDate({ ...e, createdAt: null, updatedAt: null }, null), null);
});

function entities(n: number, status: string, createdAt: string): Entity[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${status}-${i}`, status, createdAt: d(createdAt), updatedAt: d(createdAt) }));
}

test("funil de venda: ordem fixa, terminais fora do 'parado', parado e estritamente maior que 30 dias", () => {
  const list = [
    ...entities(4, "reuniao_validada", "2026-08-01T12:00:00Z"), // 68 dias: parados
    ...entities(1, "formulario_preenchido", "2026-09-08T12:00:00Z"), // 30 dias exatos: NAO parado
    ...entities(1, "cancelado", "2026-06-01T12:00:00Z"),
    ...entities(1, "liquidado", "2026-06-01T12:00:00Z"),
  ];
  const f = buildFunnel("venda", list, new Map(), NOW);
  assert.deepEqual(f.stages.map((s) => s.key), [...SALE_STAGES]);
  assert.deepEqual(f.terminals.map((t) => t.key), [...TERMINAL_STAGES]);
  const rv = f.stages.find((s) => s.key === "reuniao_validada")!;
  assert.equal(rv.count, 4);
  assert.equal(rv.stalled, 4);
  assert.equal(f.stages.find((s) => s.key === "formulario_preenchido")!.stalled, 0);
  assert.equal(f.stages.find((s) => s.key === "liquidado")!.stalled, 0, "liquidado nunca fica parado");
  assert.equal(f.terminals.find((t) => t.key === "cancelado")!.count, 1);
  assert.equal(f.total_active, 5, "terminais e liquidado nao entram nos ativos");
});

test("funil de compra: pendente agrupa em Aguardando Formulario", () => {
  const list = [...entities(2, "pendente", "2026-09-01T12:00:00Z"), ...entities(1, "reuniao_validada", "2026-09-01T12:00:00Z")];
  const f = buildFunnel("compra", list, new Map(), NOW);
  assert.deepEqual(f.stages.map((s) => s.key), [...BUY_STAGES]);
  const first = f.stages[0];
  assert.equal(first.count, 3);
  assert.equal(first.label, "Aguardando Formulário");
});

test("honestidade: mediana so com 5 itens; gargalo so com 5 itens ativos e 3 parados; empate vence a etapa mais a esquerda", () => {
  const poucos = buildFunnel("venda", entities(4, "reuniao_validada", "2026-08-01T12:00:00Z"), new Map(), NOW);
  assert.equal(poucos.stages[0].median_days, null, "4 itens: sem mediana");
  assert.equal(poucos.bottleneck, null, "menos de 5 itens ativos: sem gargalo");

  const cinco = buildFunnel("venda", entities(5, "reuniao_validada", "2026-08-01T12:00:00Z"), new Map(), NOW);
  assert.equal(cinco.stages[0].median_days, 68);
  assert.equal(cinco.bottleneck?.key, "reuniao_validada");
  assert.equal(cinco.bottleneck?.of, 5);
  assert.equal(cinco.bottleneck?.pct, 100);

  const empate = buildFunnel("venda", [
    ...entities(3, "reuniao_agendada", "2026-08-01T12:00:00Z"),
    ...entities(3, "reuniao_validada", "2026-08-01T12:00:00Z"),
  ], new Map(), NOW);
  assert.equal(empate.bottleneck?.key, "reuniao_validada", "empate: etapa mais a esquerda do funil");

  const semParados = buildFunnel("venda", entities(6, "reuniao_validada", "2026-10-05T12:00:00Z"), new Map(), NOW);
  assert.equal(semParados.bottleneck, null, "zero parados: nao destaca etapa");
});

test("estimativa: itens sem transicao contam como estimados; updated_at e contado a parte", () => {
  const e: Entity[] = [
    { id: "a", status: "reuniao_validada", createdAt: d("2026-09-01T12:00:00Z"), updatedAt: null },
    { id: "b", status: "reuniao_validada", createdAt: null, updatedAt: d("2026-09-01T12:00:00Z") },
    { id: "c", status: "reuniao_validada", createdAt: d("2026-09-01T12:00:00Z"), updatedAt: null },
  ];
  const f = buildFunnel("venda", e, new Map([["c", d("2026-09-02T12:00:00Z")]]), NOW);
  assert.equal(f.estimated_total, 2);
  assert.equal(f.updated_at_fallback_total, 1);
});

test("tempo por etapa: entrada e saida, so com 5 transicoes, e separado por entidade", () => {
  const tr: Transition[] = [];
  for (let i = 0; i < 5; i++) {
    tr.push({ entityId: `x${i}`, toStatus: "formulario_preenchido", createdAt: d("2026-09-01T12:00:00Z"), reasonCategory: null });
    tr.push({ entityId: `x${i}`, toStatus: "reuniao_agendada", createdAt: d("2026-09-11T12:00:00Z"), reasonCategory: null });
  }
  const times = buildStageTimes("venda", tr);
  const fp = times.find((t) => t.key === "formulario_preenchido")!;
  assert.equal(fp.n, 5);
  assert.equal(fp.median_days, 10);
  const ra = times.find((t) => t.key === "reuniao_agendada")!;
  assert.equal(ra.n, 0, "ultima transicao de cada entidade ainda nao saiu da etapa");
  assert.equal(ra.median_days, null);

  const poucos = buildStageTimes("venda", tr.slice(0, 4));
  assert.equal(poucos.find((t) => t.key === "formulario_preenchido")!.median_days, null, "2 transicoes de saida: sem mediana");
});

test("motivos: contagem decrescente, desempate por rotulo em portugues, nulo e desconhecido viram 'Nao categorizada'", () => {
  assert.equal(reasonLabel(null), NOT_CATEGORIZED_LABEL);
  assert.equal(reasonLabel("codigo_que_nao_existe"), NOT_CATEGORIZED_LABEL);
  assert.equal(reasonLabel("mandatario_desconhecido"), "Mandatário desconhecido");
  const r = buildReasons(["vendido_outro_escritorio", "mandatario_desconhecido", "mandatario_desconhecido", null, "preco_fora_mercado"]);
  assert.deepEqual(r.map((x) => x.label), [
    "Mandatário desconhecido", // 2
    NOT_CATEGORIZED_LABEL, // 1, empates em ordem alfabetica pt-BR
    "Preço fora de mercado",
    "Vendido por outro escritório",
  ]);
  assert.deepEqual(r.map((x) => x.count), [2, 1, 1, 1]);
});
