// Lista o que o tema do Enterprise ainda NÃO cobre (2ª etapa), sem o build escrever arquivo.
// Uso: npm run tema:pendencias  → docs/tema-enterprise-pendencias.md
// BRIEF docs/briefs/2026-11-21_tema-visual-enterprise-manual-de-marca.md
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const raiz = process.cwd();
const cores = JSON.parse(readFileSync(join(raiz, "lib/tema-enterprise-cores.json"), "utf8")).papeis;
const naTabela = new Set(Object.values(cores).flat().map((h) => h.toUpperCase()));

function arquivos(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === "node_modules" || n.startsWith(".")) continue;
    if (statSync(p).isDirectory()) arquivos(p, out);
    else if (/\.(tsx|ts)$/.test(n)) out.push(p);
  }
  return out;
}

const foraDaTabela = new Map();
const inline = new Map();
for (const f of ["app", "components", "lib"].flatMap((d) => arquivos(join(raiz, d)))) {
  const t = readFileSync(f, "utf8");
  for (const m of t.matchAll(/\[#([0-9A-Fa-f]{6})\]/g)) {
    const hex = `#${m[1].toUpperCase()}`;
    if (!naTabela.has(hex)) foraDaTabela.set(hex, (foraDaTabela.get(hex) ?? 0) + 1);
  }
  const n = (t.match(/rgba\(\s*(201\s*,\s*168\s*,\s*76|196\s*,\s*146\s*,\s*46)/g) ?? []).length;
  if (n) inline.set(relative(raiz, f).split("\\").join("/"), n);
}

const linhas = [
  "# Tema do Enterprise: pendências da 2ª etapa",
  "",
  "> Gerado por `npm run tema:pendencias`. Não editar à mão.",
  "",
  "## Cores em classe do Tailwind fora da tabela (continuam V3 para o Enterprise)",
  "",
  "| Cor | Ocorrências |",
  "|---|---|",
  ...[...foraDaTabela].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([h, n]) => `| \`${h}\` | ${n} |`),
  "",
  "## Arquivos com dourado em estilo inline (`rgba(201,168,76,...)` ou `rgba(196,146,46,...)`)",
  "",
  "| Arquivo | Ocorrências |",
  "|---|---|",
  ...[...inline].sort((a, b) => b[1] - a[1]).map(([f, n]) => `| \`${f}\` | ${n} |`),
  "",
];
writeFileSync(join(raiz, "docs/tema-enterprise-pendencias.md"), linhas.join("\n"));
console.log(`fora da tabela: ${foraDaTabela.size} cores; inline: ${inline.size} arquivos`);
