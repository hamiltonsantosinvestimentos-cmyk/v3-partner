#!/usr/bin/env node
/**
 * Gate de CI criado 18/09/2026, depois da auditoria que achou 12 paginas
 * internas (mesa-ma, mesa-consorcio-op, bolsa/mesa, marketplace/mesa-
 * capitais, juridico/contratos e assinados, pasta-publica, clientes,
 * admin-marketplace, usuarios, docs, docs/usuario) protegidas so pelo link
 * escondido no sidebar -- sem nenhum redirect no servidor. Qualquer role
 * autenticada que soubesse a URL via o conteudo direto.
 *
 * Este script le components/layout/sidebar.tsx, extrai todo href (item pai
 * e filhos) cujo roles[] exclui todos os roles externos de partner, e
 * confere que o page.tsx correspondente chama requireRole(). Falha o CI
 * (exit 1) se achar alguma pagina nova sem o gate.
 *
 * Rodar local: npm run audit:access
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SIDEBAR_PATH = path.join(ROOT, "components", "layout", "sidebar.tsx");

// Roles de conta externa de partner -- uma pagina cujo roles[] inclui
// qualquer um destes NAO e "interna", fica fora da auditoria.
const PARTNER_ROLES = ["PARTNER", "PARTNER_PRO", "PARTNER_HE", "STARTER", "ENTERPRISE"];

// Paginas confirmadas seguras por um padrao diferente de gate (escopo por
// created_by/requester_id em vez de redirect por role) -- auditoria
// 17/09/2026, verificado manualmente. Adicionar aqui SO depois de conferir
// de verdade que todo dado sensivel esta escopado ao proprio usuario.
const EXCEPTIONS = new Set(["/mesa-operacional", "/deal-rooms"]);

// Paginas que ja tinham gate real no servidor ANTES desta auditoria (17-
// 18/09/2026), so que em padroes diferentes de requireRole() -- redirect
// direto pra /unauthorized escrito inline, ou mensagem "Acesso restrito"
// renderizada no lugar do conteudo real (confirmado ao vivo em producao
// pra /socios, /hub e /relatorios; as demais foram lidas e tem o mesmo
// tipo de bloqueio real). Nunca tentar detectar esses padroes por regex
// aqui -- e mais seguro listar explicitamente o que ja foi auditado do
// que arriscar um "PASS" falso por coincidencia de texto. Toda pagina
// NOVA fora desta lista precisa de requireRole() de verdade.
const LEGACY_SAFE_HREFS = new Set([
  "/chat/admin", "/chat/equipe", "/prospeccao", "/prospeccao/dashboard",
  "/mesa-credito/fontes", "/relatorios", "/hub", "/prompts", "/propostas",
  "/ma/oportunidades", "/mesa-operacional/pedidos", "/mesa-trafego",
  "/logistica", "/logistica/voos", "/logistica/carros", "/logistica/locacoes",
  "/agentes", "/sdr", "/projeto", "/plan-strategy", "/compliance",
  "/financeiro", "/docs/tecnico", "/socios", "/admin-dashboard",
  "/admin-cadastros", "/admin-links", "/admin-sdr-addon",
]);

function hrefToPagePath(href) {
  // app/(platform)/<href sem a barra inicial>/page.tsx
  const clean = href.replace(/^\//, "");
  return path.join(ROOT, "app", "(platform)", clean, "page.tsx");
}

function extractSidebarEntries(sidebarSrc) {
  const hrefRe = /href:\s*"([^"]+)"/g;
  const matches = [];
  let m;
  while ((m = hrefRe.exec(sidebarSrc)) !== null) {
    matches.push({ href: m[1], index: m.index });
  }

  const entries = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : sidebarSrc.length;
    const window = sidebarSrc.slice(start, end);
    const rolesMatch = window.match(/roles:\s*(\[[^\]]*\])/);
    if (!rolesMatch) continue; // ROLE_LABELS e outros objetos sem roles[] ficam de fora
    let roles;
    try {
      // roles vem como array de strings JS -- JSON.parse aceita aspas duplas
      roles = JSON.parse(rolesMatch[1].replace(/'/g, '"'));
    } catch {
      continue;
    }
    entries.push({ href: matches[i].href, roles });
  }
  return entries;
}

function main() {
  const sidebarSrc = fs.readFileSync(SIDEBAR_PATH, "utf8");
  const entries = extractSidebarEntries(sidebarSrc);

  // dedup por href (item pai e filho as vezes repetem o mesmo href, ex: /bolsa)
  const byHref = new Map();
  for (const e of entries) {
    if (!byHref.has(e.href)) byHref.set(e.href, e.roles);
  }

  const internalOnly = [...byHref.entries()].filter(
    ([, roles]) => !roles.some((r) => PARTNER_ROLES.includes(r))
  );

  const fails = [];
  const passes = [];
  const skipped = [];

  for (const [href, roles] of internalOnly) {
    if (EXCEPTIONS.has(href)) {
      skipped.push({ href, reason: "allowlist (escopado por created_by/requester_id)" });
      continue;
    }
    if (LEGACY_SAFE_HREFS.has(href)) {
      skipped.push({ href, reason: "legacy, gate real confirmado manualmente em 17-18/09/2026 (padrao != requireRole)" });
      continue;
    }
    const pagePath = hrefToPagePath(href);
    if (!fs.existsSync(pagePath)) {
      skipped.push({ href, reason: `page.tsx nao encontrado em ${path.relative(ROOT, pagePath)}` });
      continue;
    }
    const content = fs.readFileSync(pagePath, "utf8");
    if (content.includes("requireRole(")) {
      passes.push(href);
    } else {
      fails.push({ href, roles, pagePath: path.relative(ROOT, pagePath) });
    }
  }

  console.log(`Auditoria de acesso: ${internalOnly.length} rotas internas encontradas no sidebar.`);
  console.log(`  ${passes.length} com requireRole() confirmado.`);
  console.log(`  ${skipped.length} na allowlist ou sem page.tsx correspondente (ver detalhe se necessario).`);

  if (fails.length > 0) {
    console.error(`\n${fails.length} pagina(s) interna(s) SEM requireRole():\n`);
    for (const f of fails) {
      console.error(`  ${f.href}`);
      console.error(`    arquivo: ${f.pagePath}`);
      console.error(`    roles esperados: ${f.roles.join(", ")}`);
    }
    console.error(
      "\nAdicione `await requireRole([...])` como primeira linha do componente de pagina " +
      "(ver lib/auth/require-role.ts), ou, se o dado ja e escopado por created_by/requester_id " +
      "em vez de bloqueado por role, adicione o href na allowlist EXCEPTIONS deste script " +
      "SO depois de confirmar isso de verdade."
    );
    process.exit(1);
  }

  console.log("\nOK — nenhuma pagina interna sem gate.");
}

main();
