// BRIEF docs/briefs/2026-11-23_enterprise-assinatura-da-equipe.md
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataBr, dataDoBr, dataValida, hojeSaoPaulo, lerAssinatura, lerValor, primeiroVencimento, situacaoAssinatura,
  somarMeses, vencimentoAnterior, vencimentoEmAberto, type AssinaturaEquipe,
} from "../../lib/enterprise-assinatura";

const base = (x: Partial<AssinaturaEquipe> = {}): AssinaturaEquipe => ({
  cobra: true, valor: 150, periodicidade: "MENSAL", dia_vencimento: 10, inicio: "2026-11-05", pago_ate: null, ...x,
});

test("sem cobrança", () => {
  assert.deepEqual(situacaoAssinatura(null, "2026-11-23"), { tipo: "SEM_COBRANCA" });
  assert.deepEqual(situacaoAssinatura(base({ cobra: false }), "2026-11-23"), { tipo: "SEM_COBRANCA" });
});

test("primeiro vencimento: igual ou posterior ao início", () => {
  assert.equal(primeiroVencimento(base({ inicio: "2026-11-05" })), "2026-11-10");
  assert.equal(primeiroVencimento(base({ inicio: "2026-11-10" })), "2026-11-10", "no próprio dia já vence");
  assert.equal(primeiroVencimento(base({ inicio: "2026-11-11" })), "2026-12-10", "depois do dia: mês seguinte");
  assert.equal(primeiroVencimento(base({ inicio: "2026-12-29", dia_vencimento: 5 })), "2027-01-05", "virada de ano");
});

test("mensal em dia e vencida", () => {
  assert.deepEqual(situacaoAssinatura(base(), "2026-11-10"), { tipo: "EM_DIA", vencimento: "2026-11-10" });
  assert.deepEqual(situacaoAssinatura(base(), "2026-11-11"), { tipo: "VENCIDA", vencimento: "2026-11-10" });
  assert.deepEqual(situacaoAssinatura(base({ pago_ate: "2026-11-10" }), "2026-11-23"), { tipo: "EM_DIA", vencimento: "2026-12-10" });
});

test("trimestral e anual", () => {
  const tri = base({ periodicidade: "TRIMESTRAL", pago_ate: "2026-11-10" });
  assert.equal(vencimentoEmAberto(tri), "2027-02-10");
  assert.equal(vencimentoEmAberto(base({ periodicidade: "ANUAL", pago_ate: "2026-11-10" })), "2027-11-10");
  assert.equal(vencimentoEmAberto(base({ periodicidade: "TRIMESTRAL" })), "2026-11-10", "nunca pago: D0");
});

test("dia 28 em fevereiro e virada de ano", () => {
  assert.equal(somarMeses("2027-01-28", 1), "2027-02-28");
  assert.equal(somarMeses("2026-12-10", 1), "2027-01-10");
  assert.equal(somarMeses("2027-01-10", -1), "2026-12-10");
});

test("desfazer: vencimento anterior e volta a null no primeiro", () => {
  assert.equal(vencimentoAnterior(base({ pago_ate: "2027-01-10" })), "2026-12-10");
  assert.equal(vencimentoAnterior(base({ pago_ate: "2026-11-10" })), null);
  assert.equal(vencimentoAnterior(base()), null);
});

test("hoje em America/Sao_Paulo: 23h30 de Brasília não vira o dia", () => {
  // 23/11/2026 23:30 em Brasília = 24/11/2026 02:30 UTC
  assert.equal(hojeSaoPaulo(new Date("2026-11-24T02:30:00Z")), "2026-11-23");
});

test("datas e valores pt-BR", () => {
  assert.equal(dataDoBr("05/11/2026"), "2026-11-05");
  assert.equal(dataDoBr("31/02/2026"), null);
  assert.equal(dataDoBr("2026-11-05"), null);
  assert.equal(dataBr("2026-11-05"), "05/11/2026");
  assert.equal(dataValida("2028-02-29"), true);
  assert.equal(dataValida("2027-02-29"), false);
  assert.equal(lerValor("1.234,56"), 1234.56);
  assert.equal(lerValor("R$ 150,00"), 150);
  assert.equal(lerValor("12.5"), 12.5);
  assert.equal(lerValor("abc"), null);
  assert.equal(lerValor(99.999), 100);
});

test("jsonb inválido do banco vira sem cobrança", () => {
  assert.equal(lerAssinatura({ cobra: true, valor: 10, periodicidade: "SEMANAL", dia_vencimento: 5, inicio: "2026-11-01" }), null);
  assert.equal(lerAssinatura({ cobra: true, valor: 10, periodicidade: "MENSAL", dia_vencimento: 30, inicio: "2026-11-01" }), null);
  assert.equal(lerAssinatura("x"), null);
  assert.deepEqual(lerAssinatura({ cobra: true, valor: "10", periodicidade: "MENSAL", dia_vencimento: 5, inicio: "2026-11-01", pago_ate: "lixo" })?.pago_ate, null);
});
