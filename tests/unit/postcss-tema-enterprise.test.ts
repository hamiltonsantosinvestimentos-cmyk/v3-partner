// Plugin do tema sobre o CSS REAL do Tailwind 4.2.2 (fixtures gerados por
// scripts/tema-enterprise-fixtures.mjs): forma crua do `next dev` e otimizada do `next build`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import postcss, { type Root } from "postcss";

const require = createRequire(import.meta.url);
const plugin = require("../../postcss-tema-enterprise.cjs");
const { interpretar, papelDa, ehReservaDePar } = plugin._interno;

const RE_COR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|oklab|oklch|lab)\([^()]*\)/g;

function contar(root: Root) {
  let regras = 0, blocos = 0;
  root.walkRules(() => { regras++; });
  root.walkAtRules(() => { blocos++; });
  return { regras, blocos };
}

/** Cores da tabela que sobraram fora de var(--wl-...) e que não são reserva de par. */
function sobras(root: Root): string[] {
  const out: string[] = [];
  root.walkDecls((d) => {
    let m: RegExpExecArray | null;
    RE_COR.lastIndex = 0;
    while ((m = RE_COR.exec(d.value))) {
      const antes = d.value.slice(Math.max(0, m.index - 40), m.index);
      if (antes.includes("var(--wl-")) continue;
      const cor = interpretar(m[0]);
      if (!cor || !papelDa(cor)) continue;
      if (cor.a < 0.999 && ehReservaDePar(d)) continue;
      out.push(`${d.prop}: ${d.value}`);
    }
  });
  return out;
}

for (const nome of ["dev", "build"]) {
  test(`fixture ${nome}: nenhuma cor da V3 sobra, mesma árvore, reservas intactas`, async () => {
    const css = readFileSync(`tests/fixtures/tema-enterprise/${nome}.css`, "utf8");
    const antes = postcss.parse(css);
    const depois = (await postcss([plugin()]).process(css, { from: undefined })).root;
    assert.deepEqual(contar(depois), contar(antes));
    assert.deepEqual(sobras(depois), []);
    assert.ok(depois.toString().includes("var(--wl-acento"), "acento trocado");
    // As variáveis do @theme viram var(--wl-x, cor V3): é por elas que o par @supports do Tailwind pega o tema.
    assert.match(depois.toString(), /--color-primary:\s*var\(--wl-acento,\s*#C9A84C\)/i);
  });
}

test("cores avulsas: maiúsculas, rgb com espaço, translúcida sem par, fora da tabela", async () => {
  const css = ".a{color:#c9a84c}.b{color:rgb(201 168 76)}.c{background:rgba(201,168,76,.2)}.d{color:#123456}.e{box-shadow:0 0 0 1px #C9A84C !important}";
  const out = (await postcss([plugin()]).process(css, { from: undefined })).css;
  assert.match(out, /\.a\{color:var\(--wl-acento, #c9a84c\)\}/);
  assert.match(out, /\.b\{color:var\(--wl-acento, rgb\(201 168 76\)\)\}/);
  assert.match(out, /\.c\{background:color-mix\(in srgb, var\(--wl-acento, #C9A84C\) 20%, transparent\)\}/);
  assert.match(out, /\.d\{color:#123456\}/);
  assert.match(out, /!important/);
});

test("par do Tailwind desaninhado: reserva fica, @supports não ganha literal", async () => {
  const css = ".x{background-color:#c9a84c33}@supports (color:color-mix(in lab, red, red)){.x{background-color:color-mix(in oklab, var(--color-primary) 20%, transparent)}}";
  const out = (await postcss([plugin()]).process(css, { from: undefined })).css;
  assert.ok(out.startsWith(".x{background-color:#c9a84c33}"), out);
});
