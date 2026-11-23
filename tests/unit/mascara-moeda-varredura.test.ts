/* eslint-disable */
// Varredura de código: a máscara de valor é "reais inteiros" desde 22/11/2026. Quem alimenta a máscara com
// valor*100 (semântica antiga de centavos) grava/mostra valor 100x errado. Este teste falha se isso voltar.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..");
const PASTAS = ["components", "app", "lib"];

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next") continue;
    const p = join(dir, nome);
    const s = statSync(p);
    if (s.isDirectory()) arquivos(p, acc);
    else if (/\.(ts|tsx)$/.test(nome)) acc.push(p);
  }
  return acc;
}

const todos = PASTAS.flatMap((d) => arquivos(join(RAIZ, d)));

test("ninguém alimenta a máscara de valor com String(x * 100)", () => {
  const ruins: string[] = [];
  for (const f of todos) {
    if (f.endsWith("utils.ts")) continue;
    const txt = readFileSync(f, "utf8");
    const re = /mask(?:Currency(?:BRL)?|Money)Input\(\s*String\([^)]*\*\s*100[^)]*\)/g;
    if (re.test(txt)) ruins.push(f.replace(RAIZ, ""));
  }
  assert.deepEqual(ruins, [], `Máscara alimentada com valor*100: ${ruins.join(", ")}`);
});

test("lógica própria de centavos (fmtCentavos/digitsToCentavos) não volta", () => {
  const ruins: string[] = [];
  for (const f of todos) {
    const txt = readFileSync(f, "utf8");
    if (/function\s+(fmtCentavos|digitsToCentavos)\b/.test(txt)) ruins.push(f.replace(RAIZ, ""));
  }
  assert.deepEqual(ruins, [], `Máscara de centavos duplicada: ${ruins.join(", ")}`);
});

test("campos do MoneyCurrencyField gravam com parseCurrencyBRLInput (leitura do formato novo e do antigo)", () => {
  const arqs = [
    "components/ma/novo-deal-form.tsx",
    "components/ma/deal-form-editor-client.tsx",
    "components/mesa-ma/mesa-ma-client.tsx",
  ];
  for (const a of arqs) {
    const txt = readFileSync(join(RAIZ, a), "utf8");
    assert.ok(/parseCurrencyBRLInput\(/.test(txt), `${a} deve ler o valor com parseCurrencyBRLInput`);
    assert.ok(!/Number\(\s*(data\.deal_value|s3\.deal_value|newCard\.value|teaserForm\.valor)\s*\)/.test(txt), `${a} não pode ler o valor com Number()`);
  }
});
