import { createClient as sc } from "@supabase/supabase-js";

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

export async function scrapeLetters(): Promise<{ letters: ScrapedLetter[]; rawRows: number }> {
  const email = process.env.CONTEMPLADOS_EMAIL ?? "";
  const senha = process.env.CONTEMPLADOS_SENHA ?? "";

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

    await page.goto(PARTNER_URL, { waitUntil: "load", timeout: 60000 });

    const blockId = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll("script"));
      for (const s of scripts) {
        const m = s.textContent?.match(/block_id["'\s]*:["'\s]*([^"',}\s]+)/);
        if (m) return m[1].replace(/['"]/g, "");
      }
      return "block1759149946234";
    });

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

    await new Promise(r => setTimeout(r, 3000));
    await page.reload({ waitUntil: "load", timeout: 60000 });
    await page.waitForSelector("table", { timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

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
    if (rows.length > 0) console.log("[sync] header row:", JSON.stringify(rows[0]));
    if (rows.length > 1) console.log("[sync] sample row:", JSON.stringify(rows[1]));

    const COL_PATTERNS: Record<string, RegExp> = {
      categoria:       /categ|tipo/i,
      credit_value:    /cr[eé]d|valor.+cr[eé]d/i,
      entrada:         /entrada|lance/i,
      parcelas:        /parcela|presta/i,
      taxa_transf:     /taxa.+transf|transf/i,
      fundo_comum:     /fundo/i,
      disponibilidade: /dispon|status|situa/i,
      administradora:  /admin/i,
      avaliacao:       /avalia/i,
    };

    let colMap: Record<string, number> = {};
    let dataStartIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const row = rows[i];
      const rowText = row.join(" ").toLowerCase();
      if (COL_PATTERNS.categoria.test(rowText) || COL_PATTERNS.credit_value.test(rowText)) {
        for (const [key, re] of Object.entries(COL_PATTERNS)) {
          const idx = row.findIndex(c => re.test(c));
          if (idx !== -1) colMap[key] = idx;
        }
        dataStartIdx = i + 1;
        break;
      }
    }

    const useDynamic = Object.keys(colMap).length >= 3;
    console.log("[sync] colMap:", JSON.stringify(colMap), "dynamic:", useDynamic, "dataStart:", dataStartIdx);

    function getCell(cells: string[], key: string, fallbackOffset: number): string {
      if (useDynamic && colMap[key] !== undefined) return cells[colMap[key]] ?? "";
      const off = (!cells[0] && cells[1]) ? 1 : 0;
      return cells[off + fallbackOffset] ?? "";
    }

    const letters: ScrapedLetter[] = [];
    for (let i = dataStartIdx; i < rows.length; i++) {
      const cells = rows[i];

      const categoria = getCell(cells, "categoria", 0);
      if (!categoria) continue;
      const catLower = categoria.toLowerCase();
      if (catLower === "categoria" || catLower === "tipo" || catLower.includes("observ") || catLower === "th") continue;

      const creditValue = parseBRL(getCell(cells, "credit_value", 1));
      if (creditValue <= 0) continue;

      const entrada         = parseBRL(getCell(cells, "entrada", 2));
      const parcelasRaw     = getCell(cells, "parcelas", 3).trim() || null;
      const taxaTransf      = parseBRL(getCell(cells, "taxa_transf", 4));
      const fundoComum      = parseBRL(getCell(cells, "fundo_comum", 5));
      const disponibilidade = getCell(cells, "disponibilidade", 6) || "Disponível";
      const administradora  = getCell(cells, "administradora", 7) || "Contemplados RS";
      const avaliacaoRaw    = getCell(cells, "avaliacao", 8);
      const avaliacaoCol    = avaliacaoRaw ? parseBRL(avaliacaoRaw) : null;

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

export interface SyncResult {
  ok: true;
  total_scraped: number;
  raw_rows: number;
  inserted: number;
  updated: number;
  skipped: number;
  debug_sample: { admin: string; credit_value: number; status: string }[];
}

export class SyncError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Faz o scraping do portal e substitui as cartas sincronizadas em `consorcio_cartas`. */
export async function runSyncContemplados(createdBy: string | null): Promise<SyncResult> {
  let allLetters: ScrapedLetter[] = [];
  let rawRows = 0;
  try {
    const result = await scrapeLetters();
    allLetters = result.letters;
    rawRows = result.rawRows;
  } catch (e) {
    throw new SyncError(`Erro ao buscar portal: ${String(e)}`, 502);
  }

  if (allLetters.length === 0) {
    throw new SyncError("Nenhuma carta encontrada no portal.", 422);
  }

  const { error: delErr } = await svc()
    .from("consorcio_cartas")
    .delete()
    .not("source_ref", "is", null);

  if (delErr) {
    throw new SyncError(`Erro ao limpar cartas antigas: ${delErr.message}`, 500);
  }

  const { data: manualCodes } = await svc()
    .from("consorcio_cartas")
    .select("code")
    .is("source_ref", null);

  let maxNum = 0;
  for (const row of manualCodes ?? []) {
    const m = String(row.code).match(/(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  let counter = maxNum + 1;

  const toInsert = allLetters.map(letter => {
    const code = `CARTA-26-${String(counter++).padStart(3, "0")}`;
    return {
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
      created_by: createdBy,
      metadata: {
        taxa_transf: letter.taxa_transf,
        fundo_comum: letter.fundo_comum,
        parcelas_qtd: letter.parcelas_qtd,
        parcela_valor: letter.parcela_valor,
        entrada: letter.asking_price,
        saldo_devedor: letter.saldo_devedor,
        avaliacao_minima: letter.avaliacao_minima,
      },
    };
  });

  const { error: insErr } = await svc().from("consorcio_cartas").insert(toInsert);
  if (insErr) throw new SyncError(`Erro ao inserir: ${insErr.message}`, 500);

  return {
    ok: true,
    total_scraped: allLetters.length,
    raw_rows: rawRows,
    inserted: toInsert.length,
    updated: 0,
    skipped: 0,
    debug_sample: allLetters.slice(0, 5).map(l => ({
      admin: l.admin,
      credit_value: l.credit_value,
      status: l.status,
    })),
  };
}
