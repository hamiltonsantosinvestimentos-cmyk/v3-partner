// Lembrete de agenda do Kanban de Prospecção: 10 minutos antes, uma vez por horário. Rodar com:
//   npm run test:unit
import { test } from "node:test";
import assert from "node:assert/strict";
import { lembretesDevidos } from "../../lib/prospeccao-lembrete";

const agora = Date.parse("2026-10-14T18:00:00.000Z"); // 15:00 em Brasília
const em = (min: number) => new Date(agora + min * 60_000).toISOString();

test("lembra quando faltam 10 minutos ou menos", () => {
  const r = lembretesDevidos({ agendado_em: em(10) }, agora);
  assert.equal(r.length, 1);
  assert.equal(r[0].campo, "agendado_em");
  assert.equal(r[0].minutos, 10);
  assert.equal(lembretesDevidos({ reuniao_em: em(3) }, agora)[0].campo, "reuniao_em");
});

test("não lembra antes da janela nem depois do horário", () => {
  assert.deepEqual(lembretesDevidos({ agendado_em: em(11) }, agora), []);
  assert.deepEqual(lembretesDevidos({ agendado_em: em(-1) }, agora), []);
  assert.deepEqual(lembretesDevidos({ agendado_em: "data ruim" }, agora), []);
});

test("não repete o mesmo horário, mas lembra de novo se reagendar", () => {
  assert.deepEqual(lembretesDevidos({ agendado_em: em(5), lembretes_enviados: { agendado_em: em(5) } }, agora), []);
  const reagendado = lembretesDevidos({ agendado_em: em(5), lembretes_enviados: { agendado_em: em(-60) } }, agora);
  assert.equal(reagendado.length, 1);
});

test("reunião e agendamento no mesmo horário viram um lembrete só", () => {
  assert.equal(lembretesDevidos({ reuniao_em: em(8), agendado_em: em(8) }, agora).length, 1);
  assert.equal(lembretesDevidos({ reuniao_em: em(8), agendado_em: em(4) }, agora).length, 2);
});

test("texto do horário sai em Brasília", () => {
  assert.match(lembretesDevidos({ agendado_em: em(10) }, agora)[0].quando, /15:10/);
});
