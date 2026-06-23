import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const BASE_URL = "https://contempladosrs.com.br";
const PARTNER_URL = `${BASE_URL}/area-do-parceiro`;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const WIRE_TOKEN = "%2FJIwSEOOrlvahP%2Fv5qJlXidyHYoowD8K%2B%2Fc83PkU9VjcDsYOWAsOXw1b7BQShiEG07q%2FNSh5ofwppRJpUzPWglrhEKtksz6LZcgJrCSjkgw%3D";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function parseBRL(raw: string): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
}

function parseCategory(cat: string): "IMOVEL" | "VEICULO" | "SERVICO" | "OUTROS" {
  const c = cat.toLowerCase();
  if (c.includes("imóv") || c.includes("imovel") || c.includes("imov")) return "IMOVEL";
  if (c.includes("veíc") || c.includes("veiculo") || c.includes("auto") || c.includes("moto")) return "VEICULO";
  if (c.includes("serv")) return "SERVICO";
  return "OUTROS";
}

function parseStatus(s: string): "DISPONIVEL" | "NEGOCIACAO" {
  return s.toLowerCase().includes("reserv") ? "NEGOCIACAO" : "DISPONIVEL";
}

// ── Cookie jar simples ────────────────────────────────────────────────────────
function mergeCookies(jar: Record<string, string>, res: Response): void {
  // Node 18+ tem getSetCookie(); fallback para get("set-cookie")
  const h = res.headers as unknown as { getSetCookie?: () => string[] };
  const raw = h.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
  for (const c of raw) {
    if (!c) continue;
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar[pair.substring(0, idx).trim()] = pair.substring(idx + 1).trim();
  }
}

function cookieStr(jar: Record<string, string>): string {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
}

// ── Extrai texto puro de um bloco HTML ───────────────────────────────────────
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ").trim();
}

// ── Parseia tabela HTML → array de linhas (array de células) ─────────────────
function parseHtmlTable(html: string): string[][] {
  const rows: string[][] = [];
  // Remove comentários e scripts antes de parsear
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<script[\s\S]*?<\/script>/gi, "");
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRe.exec(clean)) !== null) {
    const cells: string[] = [];
    const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRe.exec(trMatch[1])) !== null) {
      cells.push(stripHtml(tdMatch[1]));
    }
    // Aceita linhas com >= 4 células (algumas podem ter menos colunas)
    if (cells.length >= 4) rows.push(cells);
  }
  return rows;
}

interface ScrapedLetter {
  type: "IMOVEL" | "VEICULO" | "SERVICO" | "OUTROS";
  credit_value: number;
  admin: string;
  status: "DISPONIVEL" | "NEGOCIACAO";
  asking_price: number;
  discount: number;
  source_ref: string;
  parcelas_raw: string | null;
  parcelas_qtd: number | null;
  parcela_valor: number | null;
  taxa_transf: number;
  fundo_comum: number;
  saldo_devedor: number | null;
  avaliacao_minima: number | null;
}

function rowsToLetters(rows: string[][]): ScrapedLetter[] {
  const letters: ScrapedLetter[] = [];
  for (const cells of rows) {
    const categoria = cells[0];
    if (!categoria) continue;
    const catLower = categoria.toLowerCase();
    if (catLower === "categoria" || catLower === "tipo" || catLower.includes("observ") || catLower === "th") continue;

    const creditValue = parseBRL(cells[1]);
    if (creditValue <= 0) continue;

    const entrada       = parseBRL(cells[2]);
    const parcelasRaw   = cells[3]?.trim() || null;
    const taxaTransf    = parseBRL(cells[4]);
    const fundoComum    = parseBRL(cells[5]);
    const disponibilidade = cells[6] || "Disponível";
    const administradora  = cells[7] || "Contemplados RS";
    // Colunas extras (se existirem na tabela)
    const avaliacaoMinima = cells[8] ? parseBRL(cells[8]) : null;

    let parcelas_qtd: number | null = null;
    let parcela_valor: number | null = null;
    if (parcelasRaw) {
      const m = parcelasRaw.replace(/\s/g, "").match(/^(\d+)[xX×]([0-9.,]+)/);
      if (m) {
        parcelas_qtd  = parseInt(m[1], 10);
        parcela_valor = parseBRL(m[2]);
      }
    }

    // Saldo devedor = total das parcelas restantes
    const saldo_devedor = parcelas_qtd && parcela_valor ? Math.round(parcelas_qtd * parcela_valor) : null;
    // Avaliação mínima: da coluna extra ou estimativa (credit_value × 1.335)
    const avaliacao_minima = (avaliacaoMinima && avaliacaoMinima > 0)
      ? avaliacaoMinima
      : (creditValue > 0 ? Math.round(creditValue * 1.335) : null);

    const discount = creditValue > 0 && entrada > 0
      ? Math.round(((creditValue - entrada) / creditValue) * 100 * 10) / 10
      : 0;

    const sourceRef = `${categoria}-${creditValue}-${entrada}-${parcelasRaw}-${administradora}`
      .toLowerCase().replace(/[^a-z0-9-]/g, "-").substring(0, 200);

    letters.push({
      type: parseCategory(categoria),
      credit_value: creditValue,
      admin: administradora,
      status: parseStatus(disponibilidade),
      asking_price: entrada,
      discount,
      source_ref: sourceRef,
      parcelas_raw: parcelasRaw,
      parcelas_qtd,
      parcela_valor,
      taxa_transf: taxaTransf,
      fundo_comum: fundoComum,
      saldo_devedor,
      avaliacao_minima,
    });
  }
  return letters;
}

// ── Wire API — tenta buscar via proxy autenticado ────────────────────────────
async function fetchViaWire(pageUrl: string): Promise<string | null> {
  const wireToken = process.env.CONTEMPLADOS_WIRE_TOKEN ?? WIRE_TOKEN;
  const wireUrl = `https://api.wire.spbx.app/wire?token=${wireToken}&u=${encodeURIComponent(pageUrl)}`;
  try {
    const res = await fetch(wireUrl, {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return html;
  } catch {
    return null;
  }
}

async function scrapeLetters(): Promise<ScrapedLetter[]> {
  // ── Tenta via Wire API primeiro (mais rápido, sem login) ─────────────────
  const wireHtml = await fetchViaWire(PARTNER_URL);
  if (wireHtml && /<table/i.test(wireHtml)) {
    const allRows: string[][] = [...parseHtmlTable(wireHtml)];

    // Paginação via wire
    const pageLinkRe = /href=["']([^"']*[?&]page=(\d+)[^"']*)["']/gi;
    const pageNums = new Set<number>();
    let plm: RegExpExecArray | null;
    while ((plm = pageLinkRe.exec(wireHtml)) !== null) {
      pageNums.add(parseInt(plm[2], 10));
    }
    if (pageNums.size === 0 && allRows.length >= 20) {
      for (let p = 2; p <= 10; p++) pageNums.add(p);
    }
    for (const p of pageNums) {
      const pageHtml = await fetchViaWire(`${PARTNER_URL}?page=${p}`);
      if (!pageHtml || !/<table/i.test(pageHtml)) break;
      const pageRows = parseHtmlTable(pageHtml);
      if (pageRows.length <= 1) break;
      allRows.push(...pageRows);
    }

    const letters = rowsToLetters(allRows);
    if (letters.length > 0) return letters;
  }

  // ── Fallback: login direto ────────────────────────────────────────────────
  const email = process.env.CONTEMPLADOS_EMAIL ?? "";
  const senha = process.env.CONTEMPLADOS_SENHA ?? "";
  const jar: Record<string, string> = {};

  // ── Passo 1: GET /area-do-parceiro para obter sessão + CSRF + form action ───
  const r1 = await fetch(PARTNER_URL, {
    headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  mergeCookies(jar, r1);
  const html1 = await r1.text();

  // Se já tem tabela (sessão ativa), parseia direto
  if (/<table/i.test(html1)) {
    const rows = parseHtmlTable(html1);
    const letters = rowsToLetters(rows);
    if (letters.length > 0) return letters;
  }

  // ── Extrai CSRF token e form action ─────────────────────────────────────────
  const csrfMatch = html1.match(/name=["']_token["'][^>]*value=["']([^"']+)["']|value=["']([^"']+)["'][^>]*name=["']_token["']/i);
  const csrf = csrfMatch?.[1] ?? csrfMatch?.[2] ?? "";

  const actionMatch = html1.match(/<form[^>]+action=["']([^"']+)["']/i);
  let formAction = actionMatch?.[1] ?? PARTNER_URL;
  if (formAction.startsWith("/")) formAction = BASE_URL + formAction;
  if (!formAction.startsWith("http")) formAction = PARTNER_URL;

  // ── Passo 2: POST login ──────────────────────────────────────────────────────
  const body = new URLSearchParams();
  body.set("email", email);
  body.set("password", senha);
  if (csrf) body.set("_token", csrf);

  const r2 = await fetch(formAction, {
    method: "POST",
    headers: {
      "User-Agent": UA,
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookieStr(jar),
      "Referer": PARTNER_URL,
      "Origin": BASE_URL,
      "Accept": "text/html,application/xhtml+xml",
    },
    body: body.toString(),
    redirect: "manual",
  });
  mergeCookies(jar, r2);

  // ── Passo 3: Segue redirect pós-login ────────────────────────────────────────
  const location = r2.headers.get("location");
  const nextUrl = location
    ? (location.startsWith("http") ? location : BASE_URL + location)
    : PARTNER_URL;

  const r3 = await fetch(nextUrl, {
    headers: { "User-Agent": UA, "Cookie": cookieStr(jar), "Accept": "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  mergeCookies(jar, r3);
  const html3 = await r3.text();

  // Se landing não é a área do parceiro, busca explicitamente
  let htmlFinal = html3;
  if (!/<table/i.test(html3) && r3.url !== PARTNER_URL) {
    const r4 = await fetch(PARTNER_URL, {
      headers: { "User-Agent": UA, "Cookie": cookieStr(jar), "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    mergeCookies(jar, r4);
    htmlFinal = await r4.text();
  }

  if (!/<table/i.test(htmlFinal)) {
    const snippet = stripHtml(htmlFinal).substring(0, 500);
    throw new Error(`Tabela não encontrada após login. Página retornou: ${snippet}`);
  }

  // ── Coleta todas as páginas ───────────────────────────────────────────────
  const allRows: string[][] = [...parseHtmlTable(htmlFinal)];

  // Detecta links de paginação: ?page=N ou /area-do-parceiro?page=N
  const pageLinks = new Set<string>();
  const pageLinkRe = /href=["']([^"']*[?&]page=(\d+)[^"']*)["']/gi;
  let plm: RegExpExecArray | null;
  while ((plm = pageLinkRe.exec(htmlFinal)) !== null) {
    const pageNum = parseInt(plm[2], 10);
    if (pageNum > 1) {
      const href = plm[1].startsWith("http") ? plm[1] : BASE_URL + plm[1];
      pageLinks.add(href);
    }
  }

  // Fallback: tenta pages 2..10 se não encontrou links de paginação mas tabela tem muitas linhas
  if (pageLinks.size === 0 && allRows.length >= 20) {
    for (let p = 2; p <= 10; p++) {
      pageLinks.add(`${PARTNER_URL}?page=${p}`);
    }
  }

  for (const pageUrl of pageLinks) {
    const rp = await fetch(pageUrl, {
      headers: { "User-Agent": UA, "Cookie": cookieStr(jar), "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    if (!rp.ok) break;
    const htmlPage = await rp.text();
    if (!/<table/i.test(htmlPage)) break;
    const pageRows = parseHtmlTable(htmlPage);
    if (pageRows.length <= 1) break; // só header, acabou
    allRows.push(...pageRows);
  }

  const letters = rowsToLetters(allRows);
  return letters;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  let allLetters: ScrapedLetter[] = [];
  try {
    allLetters = await scrapeLetters();
  } catch (e) {
    return NextResponse.json({ error: `Erro ao buscar portal: ${String(e)}` }, { status: 502 });
  }

  if (allLetters.length === 0) {
    return NextResponse.json({ error: "Nenhuma carta encontrada no portal." }, { status: 422 });
  }

  // Busca existentes para deduplicar
  const { data: existing } = await svc()
    .from("consorcio_cartas")
    .select("id, source_ref, status")
    .not("source_ref", "is", null);

  const existingMap = new Map(
    (existing ?? []).map((r: { id: string; source_ref: string; status: string }) => [r.source_ref, r])
  );

  // Busca todos os códigos e extrai o maior número para evitar colisão
  const { data: allCodes } = await svc()
    .from("consorcio_cartas")
    .select("code");
  let maxNum = 0;
  for (const row of allCodes ?? []) {
    const m = String(row.code).match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  let counter = maxNum + 1;
  const toInsert = [];
  const toUpdate = [];

  for (const letter of allLetters) {
    const existing_entry = existingMap.get(letter.source_ref);
    if (existing_entry) {
      // Atualiza status e enriquece metadata com novos campos
      toUpdate.push({
        id: existing_entry.id,
        status: letter.status,
        saldo_devedor: letter.saldo_devedor,
        avaliacao_minima: letter.avaliacao_minima,
        parcelas_qtd: letter.parcelas_qtd,
        parcela_valor: letter.parcela_valor,
        taxa_transf: letter.taxa_transf,
        fundo_comum: letter.fundo_comum,
      });
      continue;
    }

    const code = `CARTA-26-${String(counter).padStart(3, "0")}`;
    counter++;

    toInsert.push({
      code,
      type: letter.type,
      credit_value: letter.credit_value,
      admin: letter.admin,
      group_name: null,
      quota: letter.parcelas_raw,
      status: letter.status,
      asking_price: letter.asking_price,
      discount: letter.discount,
      source_ref: letter.source_ref,
      created_by: user.id,
      metadata: {
        taxa_transf: letter.taxa_transf,
        fundo_comum: letter.fundo_comum,
        parcelas_qtd: letter.parcelas_qtd,
        parcela_valor: letter.parcela_valor,
        entrada: letter.asking_price,
        saldo_devedor: letter.saldo_devedor,
        avaliacao_minima: letter.avaliacao_minima,
      },
    });
  }

  let inserted = 0, updated = 0;

  if (toInsert.length > 0) {
    const { error } = await svc().from("consorcio_cartas").insert(toInsert);
    if (error) return NextResponse.json({ error: `Erro ao inserir: ${error.message}` }, { status: 500 });
    inserted = toInsert.length;
  }

  for (const u of toUpdate) {
    await svc().from("consorcio_cartas").update({
      status: u.status,
      metadata: {
        saldo_devedor: u.saldo_devedor,
        avaliacao_minima: u.avaliacao_minima,
        parcelas_qtd: u.parcelas_qtd,
        parcela_valor: u.parcela_valor,
        taxa_transf: u.taxa_transf,
        fundo_comum: u.fundo_comum,
      },
    }).eq("id", u.id);
    updated++;
  }

  return NextResponse.json({
    ok: true,
    total_scraped: allLetters.length,
    inserted,
    updated,
    skipped: allLetters.length - inserted - updated,
    debug_sample: allLetters.slice(0, 5).map(l => ({
      admin: l.admin,
      credit_value: l.credit_value,
      asking_price: l.asking_price,
      parcelas_raw: l.parcelas_raw,
      status: l.status,
      source_ref: l.source_ref.substring(0, 60),
    })),
  });
}
