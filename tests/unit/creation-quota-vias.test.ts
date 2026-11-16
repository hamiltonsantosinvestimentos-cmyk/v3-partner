// Varredura de CI da cota de criação (BRIEF 15/11/2026, item 1.4): lista FINAL e única das vias que emitem código
// oficial (issueV3Code, insertWithLegacyCode, rpc next_v3_code). Falha se surgir via nova fora da lista, ou se uma via
// que deve ter cota deixar de reservar a vaga ANTES de emitir o código. Lê o fonte, sem rede e sem criar nada.
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = join(__dirname, "..", "..");
const PASTAS = ["app", "lib", "components"];
const EMISSAO = /\b(issueV3Code|insertWithLegacyCode)\s*\(|\.rpc\(\s*["']next_v3_code["']/;

// Vias com cota: reservam a vaga ANTES de emitir o código.
const COM_COTA = new Set([
  "app/api/ma-deals/route.ts",
  "app/api/cm/intake/[token]/route.ts",
  "app/api/consorcio/projetos/route.ts",
  "app/api/consorcio/cartas/route.ts",
  "app/api/contratos/parceria/route.ts",
]);

// Vias isentas, cada uma com o motivo verificado no código em 16/11/2026.
const ISENTAS: Record<string, string> = {
  "app/api/cm/listings/route.ts": "POST só aceita ADMIN, GESTAO e MESA_OPERACIONAL (getCallerRole); partner só lê",
  "app/api/contracts/generate/route.ts": "ADMIN, GESTAO e MESA_OPERACIONAL",
  "app/api/contracts/manual-intake/route.ts": "só ADMIN e GESTAO (requireRole)",
  "app/api/ma/meetings/ingest/route.ts": "só ADMIN e GESTAO",
};
// Fora da varredura por não emitirem código no TypeScript: /api/ma/destino/[id]/confirmar-classificacao emite dentro da
// função SQL ma_desk_confirm_classification (requireDeskActor: ADMIN, GESTAO, MESA_OPERACIONAL; idempotente) e
// lib/clicksign-archive.ts só cita código em comentário (tarefa de sistema, sem partner).

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next") continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, acc);
    else if (/\.(ts|tsx)$/.test(nome)) acc.push(p);
  }
  return acc;
}

/** Remove comentários para que uma menção em texto não conte como emissão de código. */
function semComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");
}

const achados = new Map<string, string>();
for (const pasta of PASTAS) {
  for (const f of arquivos(join(RAIZ, pasta))) {
    const rel = relative(RAIZ, f).split(sep).join("/");
    if (rel === "lib/v3-codes.ts") continue; // a definição do helper
    const limpo = semComentarios(readFileSync(f, "utf8"));
    if (EMISSAO.test(limpo)) achados.set(rel, limpo);
  }
}

test("nenhuma via nova emite código oficial fora da lista aprovada", () => {
  const conhecidas = new Set([...COM_COTA, ...Object.keys(ISENTAS)]);
  const novas = [...achados.keys()].filter((r) => !conhecidas.has(r));
  assert.deepEqual(novas, [], `via nova de emissão de código: decidir se leva cota (reservarVagaOuNegar) ou se é só da equipe, e incluir na lista deste teste: ${novas.join(", ")}`);
});

test("toda via da lista ainda existe e ainda emite código (lista sem entradas mortas)", () => {
  const mortas = [...COM_COTA, ...Object.keys(ISENTAS)].filter((r) => !achados.has(r));
  assert.deepEqual(mortas, [], `entrada da lista sem emissão no código, atualizar a varredura: ${mortas.join(", ")}`);
});

test("via com cota reserva a vaga ANTES de emitir o código", () => {
  for (const rel of COM_COTA) {
    const src = achados.get(rel);
    assert.ok(src, `${rel} não encontrado`);
    const reserva = src.indexOf("reservarVagaOuNegar(");
    const emissao = src.search(EMISSAO);
    assert.ok(reserva > 0, `${rel}: precisa chamar reservarVagaOuNegar`);
    assert.ok(reserva < emissao, `${rel}: a vaga tem de ser reservada ANTES de emitir o código (negação não pode queimar numeração)`);
  }
});

test("via com cota devolve a vaga quando a criação falha depois da reserva", () => {
  for (const rel of COM_COTA) {
    const src = achados.get(rel)!;
    assert.ok(/(vaga|vaga\?)\.devolver\(\)/.test(src), `${rel}: precisa devolver a vaga nas saídas de erro`);
  }
});

test("via com cota não devolve detalhe do banco nem mensagem de exceção ao cliente", () => {
  for (const rel of COM_COTA) {
    const src = achados.get(rel)!;
    const ini = src.indexOf("export async function POST");
    const fim = src.indexOf("export async function", ini + 10);
    const post = src.slice(ini, fim === -1 ? undefined : fim);
    assert.doesNotMatch(post, /NextResponse\.json\(\{\s*error:\s*(error|e|err)\.message/, `${rel}: devolve error.message ao cliente`);
    assert.doesNotMatch(post, /error:\s*`[^`]*\$\{msg\}/, `${rel}: devolve a mensagem da exceção ao cliente`);
  }
});
