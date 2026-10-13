import { test } from "node:test";
import assert from "node:assert/strict";
import { mediaAvaliacoes, taxaImplicita, simularCash, taxaMediaDoPrazo, PARAMETROS_CASH } from "../../lib/simulador-cash";

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
