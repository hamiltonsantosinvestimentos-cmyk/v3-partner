import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const BASE_URL    = "https://contempladosrs.com.br";
const PARTNER_URL = `${BASE_URL}/area-do-parceiro`;

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

async function scrapeLetters(): Promise<{ letters: ScrapedLetter[]; rawRows: number }> {
  const email = process.env.CONTEMPLADOS_EMAIL ?? "";
  const senha = process.env.CONTEMPLADOS_SENHA ?? "";

  // ── Lança browser ─────────────────────────────────────────────────────────
  const puppeteerArgs = [
    "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
    "--disable-gpu", "--single-process", "--no-zygote",
  ];

  let browser;
  if (process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    browser = await puppeteer.launch({
      args: [...chromium.args, ...puppeteerArgs],
      executablePath: await chromium.executablePath(
        "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar"
      ),
      headless: true,
      protocolTimeout: 90000,
    });
  } else {
    const puppeteer = (await import("puppeteer-core")).default;
    browser = await puppeteer.launch({
      args: puppeteerArgs,
      executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
      headless: false,
      protocolTimeout: 90000,
    });
  }

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36");

    // ── Passo 1: Acessa a página para obter cookies + block_id ───────────────
    await page.goto(PARTNER_URL, { waitUntil: "load", timeout: 60000 });

    // Extrai block_id do JS da página
    const blockId = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script"));
      for (const s of scripts) {
        const m = s.textContent?.match(/block_id["'\s]*:["'\s]*([^"',}\s]+)/);
        if (m) return m[1].replace(/['"]/g, "");
      }
      return "block1759149946234";
    });

    // ── Passo 2: Login via API JS ─────────────────────────────────────────────
    const loginResult = await page.evaluate(async (url, bid, lg, pw) => {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
          body: JSON.stringify({ block_id: bid, login: lg, senha: pw }),
        });
        return { ok: r.ok, status: r.status, body: await r.text() };
      } catch (e) {
        return { ok: false, status: 0, body: String(e) };
      }
    }, `${BASE_URL}/api/login-credentials`, blockId, email, senha);

    console.log("[sync] login result:", loginResult.status, loginResult.body.substring(0, 100));

    if (!loginResult.ok) {
      throw new Error(`Login falhou: ${loginResult.status} ${loginResult.body}`);
    }

    // ── Passo 3: Aguarda tabela recarregar com dados autenticados ─────────────
    await new Promise(r => setTimeout(r, 3000));
    await page.reload({ waitUntil: "load", timeout: 60000 });
    await page.waitForSelector("table", { timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    // ── Extrai dados da tabela ────────────────────────────────────────────────
    const rows = await page.evaluate(() => {
      const results: string[][] = [];
      document.querySelectorAll("table tr").forEach(tr => {
        const cells: string[] = [];
        tr.querySelectorAll("td, th").forEach(td => {
          cells.push((td.textContent ?? "").trim().replace(/\s+/g, " "));
        });
        if (cells.length >= 4) results.push(cells);
      });
      return results;
    });

    console.log("[sync] rows capturadas:", rows.length);

    const letters: ScrapedLetter[] = [];
    for (const cells of rows) {
      // A tabela tem coluna extra de checkbox no início (cells[0] = "")
      // Detecta offset: se cells[0] está vazio, categoria está em cells[1]
      const offset = (!cells[0] && cells[1]) ? 1 : 0;

      const categoria = cells[offset];
      if (!categoria) continue;
      const catLower = categoria.toLowerCase();
      if (catLower === "categoria" || catLower === "tipo" || catLower.includes("observ") || catLower === "th") continue;

      const creditValue = parseBRL(cells[offset + 1]);
      if (creditValue <= 0) continue;

      const entrada         = parseBRL(cells[offset + 2]);
      const parcelasRaw     = cells[offset + 3]?.trim() || null;
      const taxaTransf      = parseBRL(cells[offset + 4]);
      const fundoComum      = parseBRL(cells[offset + 5]);
      const disponibilidade = cells[offset + 6] || "Disponível";
      const administradora  = cells[offset + 7] || "Contemplados RS";
      const avaliacaoCol    = cells[offset + 8] ? parseBRL(cells[offset + 8]) : null;

      let parcelas_qtd: number | null = null;
      let parcela_valor: number | null = null;
      if (parcelasRaw) {
        const m = parcelasRaw.replace(/\s/g, "").match(/^(\d+)[xX×]([0-9.,]+)/);
        if (m) {
          parcelas_qtd  = parseInt(m[1], 10);
          parcela_valor = parseBRL(m[2]);
        }
      }

      const saldo_devedor    = parcelas_qtd && parcela_valor ? Math.round(parcelas_qtd * parcela_valor) : null;
      const avaliacao_minima = (avaliacaoCol && avaliacaoCol > 0) ? avaliacaoCol : (creditValue > 0 ? Math.round(creditValue * 1.335) : null);

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

    return { letters, rawRows: rows.length };
  } finally {
    await browser.close();
  }
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
  let rawRows = 0;
  try {
    const result = await scrapeLetters();
    allLetters = result.letters;
    rawRows = result.rawRows;
  } catch (e) {
    return NextResponse.json({ error: `Erro ao buscar portal: ${String(e)}` }, { status: 502 });
  }

  if (allLetters.length === 0) {
    return NextResponse.json({ error: "Nenhuma carta encontrada no portal." }, { status: 422 });
  }

  const { data: existing } = await svc()
    .from("consorcio_cartas")
    .select("id, source_ref, status")
    .not("source_ref", "is", null);

  const existingMap = new Map(
    (existing ?? []).map((r: { id: string; source_ref: string; status: string }) => [r.source_ref, r])
  );

  const { data: allCodes } = await svc().from("consorcio_cartas").select("code");
  let maxNum = 0;
  for (const row of allCodes ?? []) {
    const m = String(row.code).match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  let counter = maxNum + 1;

  const toInsert = [];
  const toUpdate: Array<{ id: string; status: string; saldo_devedor: number | null; avaliacao_minima: number | null; parcelas_qtd: number | null; parcela_valor: number | null; taxa_transf: number; fundo_comum: number }> = [];

  for (const letter of allLetters) {
    const existing_entry = existingMap.get(letter.source_ref);
    if (existing_entry) {
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
    raw_rows: rawRows,
    inserted,
    updated,
    skipped: 0,
    debug_sample: allLetters.slice(0, 5).map(l => ({
      admin: l.admin,
      credit_value: l.credit_value,
      status: l.status,
    })),
  });
}
