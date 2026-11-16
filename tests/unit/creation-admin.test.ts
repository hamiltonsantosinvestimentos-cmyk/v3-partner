// Painel do ADMIN da cota de criação (BRIEF 15/11/2026): validação, cálculo da suspensão e da alteração de limites.
import test from "node:test";
import assert from "node:assert/strict";
import {
  schemaControle, schemaConfig, estadoDoControle, alvoPodeSerSuspenso, diferencaDeConfig, linhaDoLogParaAdmin,
  SUSPENSAO_PADRAO_HORAS, SUSPENSAO_MAX_HORAS,
} from "../../lib/creation-admin";

const U = "aaaaaaaa-0000-4000-8000-000000000001"; // uuid sintético
const ADMIN = "bbbbbbbb-0000-4000-8000-000000000002"; // uuid sintético
const AGORA = new Date("2026-11-16T12:00:00Z");

test("controle: exige uuid, ação válida e motivo de 5 a 500 caracteres", () => {
  assert.equal(schemaControle.safeParse({ user_id: U, acao: "suspender", motivo: "Cadastro em massa" }).success, true);
  assert.equal(schemaControle.safeParse({ user_id: "x", acao: "suspender", motivo: "Cadastro em massa" }).success, false);
  assert.equal(schemaControle.safeParse({ user_id: U, acao: "apagar", motivo: "Cadastro em massa" }).success, false);
  assert.equal(schemaControle.safeParse({ user_id: U, acao: "liberar", motivo: "ok" }).success, false, "motivo curto");
  assert.equal(schemaControle.safeParse({ user_id: U, acao: "liberar", motivo: "   ab   " }).success, false, "espaços não contam");
  assert.equal(schemaControle.safeParse({ user_id: U, acao: "liberar", motivo: "a".repeat(501) }).success, false);
  assert.equal(schemaControle.safeParse({ user_id: U, acao: "liberar", motivo: "a".repeat(500) }).success, true);
});

test("controle: horas de 1 a 720, inteiras", () => {
  const base = { user_id: U, acao: "suspender" as const, motivo: "Cadastro em massa" };
  assert.equal(schemaControle.safeParse({ ...base, horas: 0 }).success, false);
  assert.equal(schemaControle.safeParse({ ...base, horas: 1 }).success, true);
  assert.equal(schemaControle.safeParse({ ...base, horas: SUSPENSAO_MAX_HORAS }).success, true);
  assert.equal(schemaControle.safeParse({ ...base, horas: SUSPENSAO_MAX_HORAS + 1 }).success, false);
  assert.equal(schemaControle.safeParse({ ...base, horas: 2.5 }).success, false);
});

test("suspender: 24 horas por padrão, registra o autor e o motivo padronizado", () => {
  const e = estadoDoControle({ acao: "suspender" }, ADMIN, AGORA);
  assert.equal(e.blocked_until, new Date(AGORA.getTime() + SUSPENSAO_PADRAO_HORAS * 3600_000).toISOString());
  assert.equal(e.block_reason, "suspensao_manual");
  assert.equal(e.blocked_by, ADMIN);
  const e48 = estadoDoControle({ acao: "suspender", horas: 48 }, ADMIN, AGORA);
  assert.equal(e48.blocked_until, new Date(AGORA.getTime() + 48 * 3600_000).toISOString());
});

test("liberar: zera o bloqueio, o motivo e o autor", () => {
  assert.deepEqual(estadoDoControle({ acao: "liberar" }, ADMIN, AGORA), { blocked_until: null, block_reason: null, blocked_by: null });
});

test("alvo: equipe não pode ser suspensa; partner e papel desconhecido sofrem a cota; inexistente é recusado", () => {
  for (const p of ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"]) assert.equal(alvoPodeSerSuspenso(p).ok, false, p);
  for (const p of ["PARTNER", "PARTNER_PRO", "STARTER", "FINANCEIRO"]) assert.equal(alvoPodeSerSuspenso(p).ok, true, p);
  assert.deepEqual(alvoPodeSerSuspenso(null), { ok: false, erro: "Usuário não encontrado." });
});

test("config: exige motivo e pelo menos um valor, com limites", () => {
  assert.equal(schemaConfig.safeParse({ motivo: "Ajuste de limite" }).success, false, "sem valor");
  assert.equal(schemaConfig.safeParse({ hora: 10 }).success, false, "sem motivo");
  assert.equal(schemaConfig.safeParse({ motivo: "Ajuste de limite", hora: 10 }).success, true);
  assert.equal(schemaConfig.safeParse({ motivo: "Ajuste de limite", hora: 0 }).success, false);
  assert.equal(schemaConfig.safeParse({ motivo: "Ajuste de limite", dia: 10001 }).success, false);
  assert.equal(schemaConfig.safeParse({ motivo: "Ajuste de limite", intervalo_s: 0 }).success, true);
  assert.equal(schemaConfig.safeParse({ motivo: "Ajuste de limite", ip_registro_ativo: true }).success, true);
  assert.equal(schemaConfig.safeParse({ motivo: "Ajuste de limite", ip_registro_ativo: "sim" }).success, false);
});

test("config: a diferença traz só o que mudou, com valor anterior e novo", () => {
  const atual = { hora: 10, dia: 20, intervalo_s: 60, ip_registro_ativo: false, bloqueio_automatico_ativo: false };
  const pedido = schemaConfig.parse({ motivo: "Ajuste de limite", hora: 15, dia: 20, bloqueio_automatico_ativo: true });
  assert.deepEqual(diferencaDeConfig(atual, pedido), [
    { campo: "hora", antes: 10, depois: 15 },
    { campo: "bloqueio_automatico_ativo", antes: false, depois: true },
  ]);
  assert.deepEqual(diferencaDeConfig(atual, schemaConfig.parse({ motivo: "Ajuste de limite", hora: 10 })), []);
});

test("log para o ADMIN: IP só aparece com a chave ligada", () => {
  const linha = { id: "1", ip: "203.0.113.7" };
  assert.deepEqual(linhaDoLogParaAdmin(linha, true), linha);
  assert.deepEqual(linhaDoLogParaAdmin(linha, false), { id: "1", ip: null });
});
