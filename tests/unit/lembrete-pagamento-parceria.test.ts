import { test } from "node:test";
import assert from "node:assert/strict";
import { dataPagamentoDoContrato, planoDoContrato, hojeBrasilia, lembreteDevido, mensagemLembrete } from "../../lib/lembrete-pagamento-parceria";

const html = `<p>3.1 Plano contratado: Partner PRO, anuidade de R$ 15.897,00 (Anexo III). Data prevista de pagamento: 25/10/2026.</p>`;

test("lê data e plano do item 3.1", () => {
  assert.equal(dataPagamentoDoContrato(html), "2026-10-25");
  assert.deepEqual(planoDoContrato(html), { plano: "Partner PRO", anuidade: "R$ 15.897,00" });
  assert.equal(dataPagamentoDoContrato("<p>3.1 Plano contratado: Partner</p>"), null);
});

test("janela de 2 dias antes até o dia", () => {
  assert.equal(lembreteDevido("2026-10-25", "2026-10-22"), false);
  assert.equal(lembreteDevido("2026-10-25", "2026-10-23"), true);
  assert.equal(lembreteDevido("2026-10-25", "2026-10-25"), true);
  assert.equal(lembreteDevido("2026-10-25", "2026-10-26"), false);
});

test("hoje no fuso de Brasília", () => {
  assert.equal(hojeBrasilia(new Date("2026-10-23T02:00:00Z")), "2026-10-22");
});

test("mensagem", () => {
  const m = mensagemLembrete({ nome: "Fulano Ltda", dataPagamento: "2026-10-25", hoje: "2026-10-23", plano: planoDoContrato(html), contractCode: "V3C-PAR-2026-0001", statusContrato: "assinado", telefone: "(51) 9", email: "a@b.com" });
  assert.match(m, /em 2 dias/);
  assert.match(m, /25\/10\/2026/);
  assert.match(m, /Partner PRO, anuidade de R\$ 15\.897,00/);
  assert.match(m, /V3C-PAR-2026-0001 \(assinado\)/);
});
