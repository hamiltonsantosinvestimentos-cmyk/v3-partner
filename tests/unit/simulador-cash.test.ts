import { test } from "node:test";
import assert from "node:assert/strict";
import { creditoPelaRenda, mediaAvaliacoes, parcelaMaxima, prazoMinimoQueCabe, taxaImplicita, simularCash, taxaMediaDoPrazo, PARAMETROS_CASH } from "../../lib/simulador-cash";

const perto = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test("reproduz o demonstrativo da liquidez do fundo (188 meses)", () => {
  const s = simularCash(13_666_029, 188)!;
  assert.equal(s.entrada, 6_559_693.92);
  perto(s.iof, 64_180.31, 1);
  perto(s.emissaoCcb, 33_428, 1);
  perto(s.jurosFundo, 735_399.38, 1);
  perto(s.taxaTransferencia, 136_660.29, 0.01);
  // crédito líquido do demonstrativo menos a transferência de 1%
  perto(s.valorLiberado, 6_273_327.39 - 136_660.29, 2);
  // taxa média 1,29% a.m. sobre o valor liberado
  assert.equal(PARAMETROS_CASH.taxaMensalPadrao, 0.0129);
  perto(taxaImplicita(s.valorLiberado, s.parcela, 188), 0.0129, 1e-6);
});

test("prazo maior baixa a parcela e mantém o valor liberado", () => {
  const a = simularCash(1_000_000, 110)!;
  const b = simularCash(1_000_000, 190)!;
  assert.ok(a.parcela > b.parcela);
  assert.equal(a.valorLiberado, b.valorLiberado);
});

test("média das avaliações ignora campos vazios", () => {
  assert.equal(mediaAvaliacoes([1_000_000, 0, 1_200_000]), 1_100_000);
  assert.equal(mediaAvaliacoes([]), 0);
  assert.equal(simularCash(0, 160), null);
  assert.equal(taxaMediaDoPrazo(150), PARAMETROS_CASH.taxaMensalPadrao);
});

test("renda necessária: parcela de até 30% da renda", () => {
  const s = simularCash(13_666_029, 188)!;
  perto(s.rendaNecessaria * 0.3, s.parcela, 0.01);
  // renda de R$ 100 mil comporta parcela de até R$ 30 mil
  perto(30_000 / PARAMETROS_CASH.comprometimentoRenda, 100_000, 0.001);
});

test("renda do cliente: parcela máxima e menor prazo que cabe", () => {
  assert.equal(parcelaMaxima(100_000), 30_000);
  assert.equal(parcelaMaxima(0), 0);
  const credito = 13_666_029;
  const n = prazoMinimoQueCabe(credito, 300_000)!;
  assert.ok(simularCash(credito, n)!.parcela <= 90_000);
  if (n > 110) assert.ok(simularCash(credito, n - 1)!.parcela > 90_000);
  assert.equal(prazoMinimoQueCabe(credito, 100_000), null);
});

test("renda → crédito máximo e avaliação necessária (ida e volta)", () => {
  const c = creditoPelaRenda(100_000, 190)!;
  assert.equal(c.parcela, 30_000);
  const s = simularCash(c.avaliacaoNecessaria, 190)!;
  perto(s.valorLiberado, c.valorLiberado, 1);
  perto(s.parcela, 30_000, 1);
  assert.equal(creditoPelaRenda(0, 190), null);
});
