// Vitrine de cartas (BRIEF docs/briefs/2026-11-21_consorcio-projetos-ofertas-vazamento.md, item 3).
import { test } from "node:test";
import assert from "node:assert/strict";
import { cartaParaVitrine, descontoPartner, entradaPartner, ehInterno } from "../../app/api/consorcio/vitrine";

const carta = {
  id: "c1", code: "CS-26-0001", type: "IMOVEL", credit_value: 500000, admin: "Porto", group_name: "G1", quota: "12",
  status: "DISPONIVEL", created_at: "2026-11-23T00:00:00Z", asking_price: 150000, discount: 70, source_ref: "portal-x",
  created_by: "u1", deleted_at: null,
  metadata: { entrada: 150000, parcelas_qtd: 120, parcela_valor: 3000, taxa_transf: 1, fundo_comum: 20, saldo_devedor: 360000, avaliacao_minima: 400000, custo_portal: 140000 },
};

// Cálculo que a tela fazia no navegador até 23/11 (partnerEntrada/partnerDiscount).
const antigoEntrada = (l: typeof carta) => l.asking_price + l.credit_value * 0.07;
const antigoDesconto = (l: typeof carta) => {
  const pe = antigoEntrada(l);
  return l.credit_value > 0 ? Math.max(0, Math.round(((l.credit_value - pe) / l.credit_value) * 1000) / 10) : 0;
};

test("partner não recebe nada que revele o preço de custo", () => {
  const v = cartaParaVitrine(carta, false);
  for (const k of ["asking_price", "discount", "source_ref", "created_by", "deleted_at"]) assert.equal(k in v, false, k);
  const meta = v.metadata as Record<string, unknown>;
  assert.deepEqual(Object.keys(meta).sort(), ["avaliacao_minima", "fundo_comum", "parcela_valor", "parcelas_qtd", "saldo_devedor", "taxa_transf"]);
  assert.equal("entrada" in meta, false);
  assert.equal(v.entrada_partner, antigoEntrada(carta));
  assert.equal(v.desconto_partner, antigoDesconto(carta));
});

test("equipe interna recebe tudo e os valores do partner", () => {
  const v = cartaParaVitrine(carta, true);
  assert.equal(v.asking_price, 150000);
  assert.equal(v.discount, 70);
  assert.deepEqual(v.metadata, carta.metadata);
  assert.equal(v.entrada_partner, 185000);
});

test("bordas do cálculo e papéis internos", () => {
  assert.equal(descontoPartner(100, 0), 0);
  assert.equal(descontoPartner(600000, 500000), 0);
  assert.ok(Math.abs(entradaPartner(0, 100000) - 7000) < 1e-6);
  assert.equal(ehInterno("ADMIN"), true);
  assert.equal(ehInterno("GESTAO"), true);
  assert.equal(ehInterno("MESA_OPERACIONAL"), true);
  assert.equal(ehInterno("ENTERPRISE"), false);
  assert.equal(ehInterno("PARTNER"), false);
  assert.equal(ehInterno(null), false);
});
