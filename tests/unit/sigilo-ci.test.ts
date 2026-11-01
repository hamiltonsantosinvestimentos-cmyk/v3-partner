// Política de sigilo (31/10/2026): externo nunca lê o banco direto. Este teste varre o código e falha se
// (a) um componente de navegador importar o carregador do servidor, (b) código de navegador ou de servidor ler
// tabela sensível com o cliente de SESSÃO do usuário, fora da lista de exceções declaradas.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "..", "..");
const PASTAS = ["app", "components", "lib", "hooks"];

// Tabelas sensíveis do BRIEF (4.1) mais as de deal e cliente. crm_leads (override do João, prazo 30/11/2026) e
// kyc_analyses (RLS já só interna, não muda) ficam fora de propósito.
const SENSIVEIS = [
  "ma_deals", "ma_documents", "ma_document_requests", "ma_captacao_links", "ma_deal_clients", "v3_clients",
  "cm_asset_listings", "cm_bids", "cm_listing_documents", "cm_deal_room_access", "credit_desk_proposals",
  "consorcio_projetos", "creative_jobs", "creative_files",
];

// Exceções declaradas (arquivo relativo, motivo). Vazia de propósito: nenhuma leitura de sessão é aceita.
const EXCECOES: Record<string, string> = {};

function arquivos(dir: string, saida: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) arquivos(p, saida);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) saida.push(p);
  }
  return saida;
}

const todos = PASTAS.flatMap((d) => (fs.existsSync(path.join(RAIZ, d)) ? arquivos(path.join(RAIZ, d)) : []));
const rel = (f: string) => path.relative(RAIZ, f).split(path.sep).join("/");

test("componente de navegador nunca importa o carregador de deal do servidor", () => {
  const ruins: string[] = [];
  for (const f of todos) {
    const src = fs.readFileSync(f, "utf8");
    if (/^\s*["']use client["']/m.test(src.slice(0, 200)) && /lib\/ma\/deal-para-originador/.test(src)) ruins.push(rel(f));
  }
  assert.deepEqual(ruins, []);
});

test("nenhuma leitura de tabela sensível com o cliente de sessão do usuário", () => {
  const ruins: string[] = [];
  const tabelas = SENSIVEIS.join("|");
  for (const f of todos) {
    const r = rel(f);
    if (r in EXCECOES || r.startsWith("lib/supabase/")) continue;
    const src = fs.readFileSync(f, "utf8");
    if (!/lib\/supabase\/(server|client)/.test(src)) continue;
    // variáveis que recebem o cliente de sessão: createClient() sem argumentos
    const vars = new Set<string>();
    for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?createClient\(\s*\)/g)) vars.add(m[1]);
    for (const v of vars) {
      const re = new RegExp(`\\b${v}\\s*\\n?\\s*\\.from\\(\\s*["'\`](${tabelas})["'\`]`, "g");
      for (const m of src.matchAll(re)) ruins.push(`${r}: ${v}.from("${m[1]}")`);
    }
    // padrão createServerClient/createBrowserClient (sessão por cookie)
    for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*create(?:Server|Browser)Client\(/g)) {
      const re = new RegExp(`\\b${m[1]}\\s*\\n?\\s*\\.from\\(\\s*["'\`](${tabelas})["'\`]`, "g");
      for (const x of src.matchAll(re)) ruins.push(`${r}: ${m[1]}.from("${x[1]}")`);
    }
  }
  assert.deepEqual(ruins, [], "leitura de tabela sensível pelo cliente de sessão: use o carregador do servidor ou a chave de serviço com recorte por papel");
});

test("o carregador do originador aplica o recorte de colunas ao partner", () => {
  const src = fs.readFileSync(path.join(RAIZ, "lib/ma/deal-para-originador.ts"), "utf8");
  assert.match(src, /recorteDealParaOriginador\(/);
  assert.match(src, /recorteListaParaOriginador\(/);
  assert.match(src, /clientesDoLadoDoOriginador\(/);
  assert.match(src, /registrarAcesso\(/);
});

// ---------------------------------------------------------------------------------------------------------------
// Storage (BRIEF 31/10/2026): o navegador nunca lê, lista, apaga nem monta endereço de arquivo do Storage com a
// sessão do usuário. Só o envio por link assinado (emitido pelo servidor) é permitido.

// Únicos arquivos que montam o endereço de envio assinado (/storage/v1/object/upload/sign/).
const ENVIO_ASSINADO_PERMITIDO = new Set([
  "components/mesa-ma/mesa-ma-client.tsx",
  "lib/credit-documents/upload.ts",
]);

test("nenhum arquivo monta endereço direto do Storage, exceto o envio assinado dos dois arquivos de envio", () => {
  const ruins: string[] = [];
  for (const f of todos) {
    const r = rel(f);
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/\/storage\/v1\/object\/[^"'`\s)]*/g)) {
      const trecho = m[0];
      const ehEnvioAssinado = trecho.startsWith("/storage/v1/object/upload/sign/");
      if (!(ehEnvioAssinado && ENVIO_ASSINADO_PERMITIDO.has(r))) ruins.push(`${r}: ${trecho}`);
    }
  }
  assert.deepEqual(ruins, [], "endereço direto do Storage: use a rota do servidor com link assinado");
});

test("receptor de sessão (variável ou chamada inline) só chama storage com uploadToSignedUrl", () => {
  const ruins: string[] = [];
  for (const f of todos) {
    const r = rel(f);
    if (r.startsWith("lib/supabase/")) continue;
    const src = fs.readFileSync(f, "utf8");
    if (!/lib\/supabase\/(server|client)/.test(src)) continue;
    const receptores: string[] = ["(?:createClient|createBrowserSupabaseClient|createBrowserClient)\\(\\s*\\)"];
    for (const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:createClient|createBrowserSupabaseClient|createBrowserClient)\(\s*\)/g)) receptores.push(`\\b${m[1]}`);
    for (const recep of receptores) {
      const re = new RegExp(`${recep}\\s*\\n?\\s*\\.storage([\\s\\S]{0,200})`, "g");
      for (const m of src.matchAll(re)) {
        if (!/^\s*\n?\s*\.from\([^)]*\)\s*\n?\s*\.uploadToSignedUrl\(/.test(m[1])) ruins.push(`${r}: .storage${m[1].slice(0, 60).replace(/\s+/g, " ")}`);
      }
    }
  }
  assert.deepEqual(ruins, [], "o navegador só pode enviar por link assinado; leitura, listagem e remoção passam pelo servidor");
});
