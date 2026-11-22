// Gera os fixtures do plugin do tema (BRIEF 2026-11-21 tema visual): a saída real do
// @tailwindcss/postcss para app/globals.css, crua (como no `next dev`) e otimizada pelo Lightning CSS
// (como no `next build`, NODE_ENV=production). É exatamente o CSS que entra no plugin.
// Uso: node scripts/tema-enterprise-fixtures.mjs
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const raiz = process.cwd();
const origem = resolve(raiz, "app/globals.css");
const css = readFileSync(origem, "utf8");
mkdirSync(resolve(raiz, "tests/fixtures/tema-enterprise"), { recursive: true });

for (const [nome, optimize] of [["dev", false], ["build", { minify: true }]]) {
  const out = await postcss([tailwind({ base: raiz, optimize })]).process(css, { from: origem });
  writeFileSync(resolve(raiz, `tests/fixtures/tema-enterprise/${nome}.css`), out.css);
  console.log(nome, out.css.length, "bytes");
}
