// Descarte do log de criação de operações (BRIEF 15/11/2026, item 1.13): simulação não altera nada, o início é auditado
// ANTES de apagar, e qualquer falha interrompe sem apagar.
import test from "node:test";
import assert from "node:assert/strict";
import { executarDescarteDoLog, type ContagemDescarte, type PortaDescarte } from "../../lib/creation-log-retention";

function porta(opc?: { contarFalha?: boolean; apagarFalha?: boolean; auditarFalhaEm?: string }) {
  const eventos: string[] = [];
  const p: PortaDescarte = {
    async executar(real) {
      eventos.push(real ? "apagar" : "contar");
      if (!real && opc?.contarFalha) return null;
      if (real && opc?.apagarFalha) return null;
      const c: ContagemDescarte = { real, ip_vencidos: 3, ip_de_conta_excluida: 1, linhas_vencidas: 5 };
      return c;
    },
    async auditar(action) {
      eventos.push(`auditar:${action}`);
      return opc?.auditarFalhaEm !== action;
    },
  };
  return { p, eventos };
}

test("simulação: conta, audita o início e NÃO apaga", async () => {
  const { p, eventos } = porta();
  const r = await executarDescarteDoLog(p, { real: false });
  assert.equal(r.ok, true);
  if (r.ok) { assert.equal(r.simulacao, true); assert.equal(r.contagem.ip_vencidos, 3); }
  assert.deepEqual(eventos, ["contar", "auditar:creation_log_retention_inicio"]);
});

test("execução real: o início é auditado ANTES de apagar, e o fim depois", async () => {
  const { p, eventos } = porta();
  const r = await executarDescarteDoLog(p, { real: true });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.simulacao, false);
  assert.deepEqual(eventos, ["contar", "auditar:creation_log_retention_inicio", "apagar", "auditar:creation_log_retention_fim"]);
});

test("falha ao contar: não audita e não apaga", async () => {
  const { p, eventos } = porta({ contarFalha: true });
  assert.deepEqual(await executarDescarteDoLog(p, { real: true }), { ok: false, erro: "falha_ao_contar" });
  assert.deepEqual(eventos, ["contar"]);
});

test("sem trilha não há apagamento: falha ao auditar o início interrompe antes de apagar", async () => {
  const { p, eventos } = porta({ auditarFalhaEm: "creation_log_retention_inicio" });
  assert.deepEqual(await executarDescarteDoLog(p, { real: true }), { ok: false, erro: "falha_ao_auditar" });
  assert.equal(eventos.includes("apagar"), false);
});

test("falha ao apagar: devolve erro e não audita o fim", async () => {
  const { p, eventos } = porta({ apagarFalha: true });
  assert.deepEqual(await executarDescarteDoLog(p, { real: true }), { ok: false, erro: "falha_ao_apagar" });
  assert.equal(eventos.includes("auditar:creation_log_retention_fim"), false);
});
