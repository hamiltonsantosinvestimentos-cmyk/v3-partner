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
  // Bloco D (BRIEF 01/11/2026): leitura aberta a logado ou anônimo fechada no banco; nenhuma tela lê pela sessão.
  "deal_qa_threads", "deal_qa_messages", "meeting_action_items", "docs_ingeridos", "generated_reports",
  "consorcio_cartas", "deal_intakes", "deal_partner_submissions", "portfolio_linhas", "integration_partners",
  "mesa_sla_config", "platform_settings",
  // Tickets operacionais (BRIEF 01/11/2026): leitura e escrita pela rota com chave de serviço.
  "operational_tickets", "ticket_comments",
];

// Tabelas com leitura aberta deixadas por desenho (BRIEF 01/11/2026, seção 2.2), sem dado de cliente, deal ou pessoa:
// market_benchmarks, deal_sector_codes, v3_code_series, academy_comments, academy_video_overrides, academy_yt_links,
// marketplace_product_reviews, ma_origination_units. operational_tickets segue pendente (BRIEF próprio, prazo 08/11/2026).

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

// ---------------------------------------------------------------------------------------------------------------
// Anexo do chat de equipe (BRIEF 01/11/2026): bucket privado, caminho no banco, leitura só pela rota.
// getPublicUrl segue em uso nos buckets públicos white-label, marketplace, avatars e sdr-media (fora deste escopo,
// conferência de conteúdo já registrada no BRIEF de Storage); aqui só o bucket do chat é proibido.
test("nenhum arquivo gera endereço público do bucket do chat de equipe", () => {
  const ruins: string[] = [];
  for (const f of todos) {
    const r = rel(f);
    if (r === "lib/team-chat-anexo.ts") continue;
    const src = fs.readFileSync(f, "utf8");
    if (!/getPublicUrl/.test(src)) continue;
    if (/team-chat-attachments|BUCKET_ANEXO_CHAT/.test(src)) ruins.push(r);
  }
  assert.deepEqual(ruins, [], "o bucket do chat é privado: leitura só por /api/team-chat/anexo com link assinado");
});

test("anexo do chat: só caminho no formato gravado pelo upload, da própria sala", async () => {
  const { salaDoCaminhoAnexo } = await import("../../lib/team-chat-anexo");
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  assert.equal(salaDoCaminhoAnexo(`mesa_ma/${uuid}.pdf`), "mesa_ma");
  assert.equal(salaDoCaminhoAnexo(`socios/${uuid}.png`), "socios");
  for (const ruim of [
    `https://x.supabase.co/storage/v1/object/public/team-chat-attachments/mesa_ma/${uuid}.pdf`,
    `mesa_ma/../socios/${uuid}.pdf`,
    `mesa_ma/${uuid}.exe`,
    `MESA/${uuid}.pdf`,
    `mesa_ma/outra/${uuid}.pdf`,
    `mesa_ma/arquivo.pdf`,
    "",
    null,
  ]) assert.equal(salaDoCaminhoAnexo(ruim), null, String(ruim));
});

// ---------------------------------------------------------------------------------------------------------------
// Chat do partner (BRIEF 01/11/2026): o partner não acessa o banco, nem para ouvir o canal Realtime. Só a equipe
// assina o canal de chat_messages; arquivo que assina precisa carregar a marca e não pode filtrar por sala de partner.
test("canal Realtime de chat_messages só para a equipe", () => {
  const ruins: string[] = [];
  for (const f of todos) {
    const src = fs.readFileSync(f, "utf8");
    if (!/postgres_changes/.test(src) || !/table:\s*["']chat_messages["']/.test(src)) continue;
    const r = rel(f);
    if (!/realtime-so-equipe/.test(src)) ruins.push(`${r}: falta a marca realtime-so-equipe`);
    if (/room_id=eq\./.test(src)) ruins.push(`${r}: filtro por sala de partner no canal do banco`);
    if (!/if\s*\(\s*!?isAdmin\s*\)/.test(src)) ruins.push(`${r}: assinatura do canal não está condicionada à equipe`);
  }
  assert.deepEqual(ruins, [], "partner lê o chat só pela API; canal do banco só para a equipe");
});

// Chamada direta com o cliente de sessão (sem variável): createClient().from(...) e (await createClient()).from(...).
// Limitação declarada: cliente de sessão passado como parâmetro a uma função auxiliar não é detectável por texto.
test("nenhuma leitura de tabela sensível com createClient() direto", () => {
  const ruins: string[] = [];
  const tabelas = SENSIVEIS.join("|");
  const re = new RegExp("createClient\\(\\s*\\)\\s*\\)?\\s*\\.from\\(\\s*[\"'`](" + tabelas + ")[\"'`]", "g");
  for (const f of todos) {
    const r = rel(f);
    if (r.startsWith("lib/supabase/")) continue;
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(re)) ruins.push(`${r}: createClient().from("${m[1]}")`);
  }
  assert.deepEqual(ruins, [], "leitura de tabela sensível pelo cliente de sessão: use o carregador do servidor ou a chave de serviço com recorte por papel");
});

// Tickets operacionais (BRIEF 01/11/2026): regra por RECEPTOR, que cobre o que o scanner por variável não vê (cliente
// obtido por desestruturação ou recebido por parâmetro). Todo X.from("operational_tickets") ou X.from("ticket_comments")
// precisa ter como receptor svc, svc2, db, svc() ou serviceClient(); qualquer outro (por exemplo supabase) falha.
// Limitação declarada: uma variável com nome permitido que na verdade seja cliente de sessão não é pega aqui; o scanner
// por variável do teste anterior cobre esse caso quando o cliente nasce de createClient() no mesmo arquivo.
const RECEPTORES_SERVICO = new Set(["svc", "svc2", "db"]);

function receptoresInvalidos(src: string, tabelas: string[]): string[] {
  const re = new RegExp("(\\w+|\\))\\s*\\n?\\s*\\.from\\(\\s*[\"'`](" + tabelas.join("|") + ")[\"'`]", "g");
  const ruins: string[] = [];
  for (const m of src.matchAll(re)) {
    const receptor = m[1];
    if (RECEPTORES_SERVICO.has(receptor)) continue;
    if (receptor === ")") {
      const antes = src.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
      if (/(svc|serviceClient)\(\s*$/.test(antes)) continue;
    }
    ruins.push(`${receptor}.from("${m[2]}")`);
  }
  return ruins;
}

test("receptoresInvalidos pega o cliente de sessão e aceita o de serviço (caso negativo e positivo)", () => {
  const tabelas = ["operational_tickets", "ticket_comments"];
  assert.equal(receptoresInvalidos('const { user, supabase } = await getAuthedUser();\n  await supabase.from("operational_tickets").insert({})', tabelas).length, 1);
  assert.equal(receptoresInvalidos('const { data } = await (await createClient()).from("ticket_comments").select("*")', tabelas).length, 1);
  assert.equal(receptoresInvalidos('await supabase\n    .from("ticket_comments")', tabelas).length, 1);
  assert.equal(receptoresInvalidos('await svc().from("operational_tickets").select("id")', tabelas).length, 0);
  assert.equal(receptoresInvalidos('await svc\n    .from("operational_tickets")', tabelas).length, 0);
  assert.equal(receptoresInvalidos('await db.from("ticket_comments").insert({})', tabelas).length, 0);
  assert.equal(receptoresInvalidos('await serviceClient()\n    .from("operational_tickets")', tabelas).length, 0);
  assert.equal(receptoresInvalidos('await supabase.from("profiles").select("id")', tabelas).length, 0);
});

test("tickets: todo acesso às duas tabelas usa cliente de serviço", () => {
  const ruins: string[] = [];
  for (const f of todos) {
    const src = fs.readFileSync(f, "utf8");
    if (!/operational_tickets|ticket_comments/.test(src)) continue;
    for (const r of receptoresInvalidos(src, ["operational_tickets", "ticket_comments"])) ruins.push(`${rel(f)}: ${r}`);
  }
  assert.deepEqual(ruins, [], "tickets: leitura e escrita só com cliente de serviço e filtro por papel na rota");
});
