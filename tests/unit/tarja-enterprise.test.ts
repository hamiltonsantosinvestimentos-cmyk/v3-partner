// Tarja do Enterprise nas mesas da V3 (BRIEF docs/briefs/2026-11-21_tarja-enterprise-nas-mesas-v3.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { corDaTarja, TARJA_NEUTRA } from "../../lib/enterprise-cor";
import { contraste } from "../../lib/enterprise-tema";
import { passaFiltroOrigem, rotuloPartnerEnterprise } from "../../components/shared/tarja-enterprise";

test("cor da tarja: AGS com contraste, sem tema neutra, cor intermediária cai no neutro", () => {
  const ags = corDaTarja("#040968");
  assert.equal(ags.cor, "#040968");
  assert.ok(contraste(ags.corTexto, ags.cor) >= 4.5);

  const clara = corDaTarja("#F5F5F5");
  assert.ok(contraste(clara.corTexto, clara.cor) >= 4.5);

  const semTema = corDaTarja(null);
  assert.equal(semTema.cor, TARJA_NEUTRA);
  assert.equal(semTema.corFaixa, TARJA_NEUTRA);

  // Cinza médio: nem Cream nem Navy chegam a 4,5:1 → selo neutro, faixa com a cor do cliente.
  const meio = corDaTarja("#7A7A7A");
  if (contraste("#F0ECE4", "#7A7A7A") < 4.5 && contraste("#09081A", "#7A7A7A") < 4.5) {
    assert.equal(meio.cor, TARJA_NEUTRA);
    assert.equal(meio.corFaixa, "#7A7A7A");
  }
  assert.ok(contraste(meio.corTexto, meio.cor) >= 4.5);

  assert.equal(corDaTarja("azul").cor, TARJA_NEUTRA);
});

test("filtro Origem e rótulo do partner", () => {
  const ent = { nome: "AGS Finance", cor: "#040968", corTexto: "#F0ECE4", corFaixa: "#040968", papel: "equipe" as const };
  assert.equal(passaFiltroOrigem({ enterprise: ent }, "todas"), true);
  assert.equal(passaFiltroOrigem({ enterprise: ent }, "enterprise"), true);
  assert.equal(passaFiltroOrigem({ enterprise: ent }, "v3"), false);
  assert.equal(passaFiltroOrigem({ enterprise: null }, "v3"), true);
  assert.equal(passaFiltroOrigem({}, "enterprise"), false);
  assert.equal(rotuloPartnerEnterprise("Fulano", ent), "Fulano · equipe AGS Finance");
  assert.equal(rotuloPartnerEnterprise("Marciano", { ...ent, papel: "master" }), "Marciano · master AGS Finance");
  assert.equal(rotuloPartnerEnterprise("Beltrano", null), "Beltrano");
});
