// Tema visual do Enterprise (BRIEF docs/briefs/2026-11-21_tema-visual-enterprise-manual-de-marca.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { validarTema, verificarContraste, contraste, tonsDerivados, cssVariaveis, prefixoBucketWhiteLabel } from "../../lib/enterprise-tema";
import { conferirIcone, conferirLogoClaro, tipoPelosBytes } from "../../lib/enterprise-arquivos";
import { nomeDaMarca } from "../../lib/enterprise";

const BUCKET = prefixoBucketWhiteLabel("https://exemplo.supabase.co")!;

test("validador: hex, URL só do bucket, inválido vira null", () => {
  assert.equal(validarTema(null), null);
  assert.equal(validarTema({ cor_principal: "040968", cor_acento: "#00E000" }), null);
  assert.equal(validarTema({ cor_principal: "#040968", cor_acento: "verde" }), null);
  const t = validarTema({ cor_principal: "#040968", cor_acento: "#00e000", icone_url: "https://outro.site/x.png", logo_claro_url: `${BUCKET}m/logo.png` }, BUCKET);
  assert.deepEqual(t, { cor_principal: "#040968", cor_acento: "#00E000", icone_url: null, logo_claro_url: `${BUCKET}m/logo.png` });
  assert.equal(validarTema({ cor_principal: "#040968", cor_acento: "#00E000", icone_url: `${BUCKET}a"onload=x` }, BUCKET)?.icone_url, null);
});

test("contraste: branco sobre o azul AGS passa; branco sobre o verde AGS reprova", () => {
  assert.ok(contraste("#FFFFFF", "#040968") >= 4.5);
  assert.ok(contraste("#FFFFFF", "#00E000") < 4.5);
  assert.deepEqual(verificarContraste({ cor_principal: "#040968", cor_acento: "#00E000" }), []);
  assert.ok(verificarContraste({ cor_principal: "#9AA0FF", cor_acento: "#A0A0A0" }).length > 0);
});

test("tons derivados: determinísticos e valores da AGS", () => {
  const a = tonsDerivados({ cor_principal: "#040968", cor_acento: "#00E000" });
  const b = tonsDerivados({ cor_principal: "#040968", cor_acento: "#00E000" });
  assert.deepEqual(a, b);
  assert.equal(a.acento, "#00E000");
  assert.equal(a.texto, "#FFFFFF");
  assert.equal(a.fundo, "#01002C");
  assert.equal(a.cartao, "#030356");
  assert.match(cssVariaveis({ cor_principal: "#040968", cor_acento: "#00E000" }), /^:root\{--wl-principal:#040968;--wl-fundo:#01002C;.*\}$/);
});

test("arquivos: tipo pelos bytes, ícone quadrado, ICO até 256", () => {
  const png = (w: number, h: number) => {
    const b = new Uint8Array(40);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    new DataView(b.buffer).setUint32(16, w);
    new DataView(b.buffer).setUint32(20, h);
    return b;
  };
  const ico = (dims: number[]) => {
    const b = new Uint8Array(6 + dims.length * 16 + 10);
    b.set([0, 0, 1, 0, dims.length, 0], 0);
    dims.forEach((d, i) => { b[6 + i * 16] = d === 256 ? 0 : d; b[7 + i * 16] = d === 256 ? 0 : d; });
    return b;
  };
  assert.equal(tipoPelosBytes(png(64, 64)), "png");
  assert.equal(tipoPelosBytes(new TextEncoder().encode("<svg>")), null);
  assert.equal(conferirIcone(png(128, 128)).ok, true);
  assert.equal(conferirIcone(png(128, 64)).ok, false);
  assert.equal(conferirIcone(png(32, 32)).ok, false);
  assert.equal(conferirIcone(ico([64, 256])).ok, true);
  assert.equal(conferirIcone(ico([64, 32])).ok, false);
  assert.equal(conferirLogoClaro(png(500, 200)).ok, true);
  assert.equal(conferirLogoClaro(ico([64])).ok, false); // ICO renomeado não passa como logo
});

test("nomeDaMarca: nunca vazio nem null", () => {
  assert.equal(nomeDaMarca({ marcaNome: "AGS Finance", masterNome: "Marciano" }), "AGS Finance");
  assert.equal(nomeDaMarca({ marcaNome: "  ", masterNome: "Marciano" }), "Marciano");
  assert.equal(nomeDaMarca({ marcaNome: null, masterNome: null }), "Enterprise");
  assert.equal(nomeDaMarca(null), "Enterprise");
});
