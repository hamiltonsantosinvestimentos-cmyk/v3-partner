// Retenção de 36 meses do chat (BRIEF 07/11/2026): caminho de apagar, com porta falsa (sem tocar banco nem Storage).
import { test } from "node:test";
import assert from "node:assert/strict";
import { executarRetencao, mesesAtras, RETENCAO_MESES, type PortaRetencao, type MensagemVencida } from "../../lib/chat-retention";

function fake(msgs: MensagemVencida[], opt: { storageFalha?: boolean; auditoriaInicioFalha?: boolean } = {}) {
  const fila = [...msgs];
  const log: string[] = [];
  const apagadas: string[] = [];
  const anexos: string[] = [];
  const porta: PortaRetencao = {
    async contarVencidas() { return fila.length; },
    async lerLote(_c, n) { return fila.slice(0, n); },
    async removerAnexos(p) { if (opt.storageFalha) return false; anexos.push(...p); return true; },
    async apagarMensagens(ids) { for (const id of ids) { fila.splice(fila.findIndex((m) => m.id === id), 1); apagadas.push(id); } return true; },
    async auditar(a) { log.push(a); return !(opt.auditoriaInicioFalha && a === "chat_retencao_inicio"); },
  };
  return { porta, log, apagadas, anexos, restante: () => fila.length };
}
const M = (id: string, path?: string): MensagemVencida => ({ id, anexos: path ? [{ path }] : null });

test("o prazo é de 36 meses e a data de corte é calculada para trás", () => {
  assert.equal(RETENCAO_MESES, 36);
  assert.equal(mesesAtras(36, new Date("2026-11-07T12:00:00Z")), "2023-11-07T12:00:00.000Z");
});

test("simulação não apaga nada e grava só a linha de simulação", async () => {
  const f = fake([M("a", "r/a.pdf"), M("b")]);
  const { resultado } = await executarRetencao(f.porta, { real: false, corteIso: "x" });
  assert.equal(resultado?.mensagens_vencidas, 2);
  assert.equal(f.apagadas.length, 0);
  assert.deepEqual(f.log, ["chat_retencao_simulacao"]);
});

test("modo real: anexo e mensagem saem, auditoria de início vem antes e há linha por lote", async () => {
  const f = fake([M("a", "r/a.pdf"), M("b"), M("c")]);
  const { resultado, erro } = await executarRetencao(f.porta, { real: true, corteIso: "x", tamanhoLote: 2 });
  assert.equal(erro, undefined);
  assert.equal(resultado?.mensagens_apagadas, 3);
  assert.equal(resultado?.anexos_apagados, 1);
  assert.deepEqual(f.anexos, ["r/a.pdf"]);
  assert.equal(f.restante(), 0);
  assert.deepEqual(f.log, ["chat_retencao_inicio", "chat_retencao_lote", "chat_retencao_lote", "chat_retencao_execucao"]);
});

test("falha do Storage mantém o lote inteiro e conta a falha", async () => {
  const f = fake([M("a", "r/a.pdf"), M("b")], { storageFalha: true });
  const { resultado } = await executarRetencao(f.porta, { real: true, corteIso: "x" });
  assert.equal(resultado?.lotes_com_falha, 1);
  assert.equal(resultado?.mensagens_apagadas, 0);
  assert.equal(f.restante(), 2);
});

test("sem a auditoria de início, nada é apagado", async () => {
  const f = fake([M("a"), M("b")], { auditoriaInicioFalha: true });
  const { resultado, erro } = await executarRetencao(f.porta, { real: true, corteIso: "x" });
  assert.equal(resultado, null);
  assert.ok(erro);
  assert.equal(f.restante(), 2);
});

test("orçamento de tempo esgotado interrompe os lotes e registra", async () => {
  const f = fake([M("a"), M("b"), M("c"), M("d")]);
  let t = 0;
  const { resultado } = await executarRetencao(f.porta, { real: true, corteIso: "x", tamanhoLote: 2, orcamentoMs: 10, agora: () => (t += 6) });
  assert.equal(resultado?.interrompida_por_tempo, true);
  assert.ok((resultado?.mensagens_apagadas ?? 0) < 4);
  assert.equal(f.log.at(-1), "chat_retencao_execucao");
});

test("modo real sem mensagens vencidas: só a linha final, nada de início ou lote", async () => {
  const f = fake([]);
  await executarRetencao(f.porta, { real: true, corteIso: "x" });
  assert.deepEqual(f.log, ["chat_retencao_execucao"]);
});
