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
    if (rows.length > 0) console.log("[sync] header row:", JSON.stringify(rows[0]));
    if (rows.length > 1) console.log("[sync] sample row:", JSON.stringify(rows[1]));

    // ── Detecta cabeçalho para mapear colunas dinamicamente ──────────────────
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

    // Encontra a linha de cabeçalho (primeira linha que contém "categoria" ou "crédito")
    let colMap: Record<string, number> = {};
    let dataStartIdx = 0;
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const row = rows[i];
      const rowText = row.join(" ").toLowerCase();
      if (COL_PATTERNS.categoria.test(rowText) || COL_PATTERNS.credit_value.test(rowText)) {
        // Mapeia cada coluna pelo seu índice
        for (const [key, re] of Object.entries(COL_PATTERNS)) {
          const idx = row.findIndex(c => re.test(c));
          if (idx !== -1) colMap[key] = idx;
        }
        dataStartIdx = i + 1;
        break;
      }
    }

    // Fallback: mapeamento por posição se cabeçalho não foi detectado
    // (checkbox em [0], dados começam em [1] ou direto em [0])
    const useDynamic = Object.keys(colMap).length >= 3;
    console.log("[sync] colMap:", JSON.stringify(colMap), "dynamic:", useDynamic, "dataStart:", dataStartIdx);

    function getCell(cells: string[], key: string, fallbackOffset: number): string {
      if (useDynamic && colMap[key] !== undefined) return cells[colMap[key]] ?? "";
      // fallback: detecta offset pelo checkbox vazio
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

  // ── Replace completo: apaga cartas do portal e insere as novas ─────────────
  const { error: delErr } = await svc()
    .from("consorcio_cartas")
    .delete()
    .not("source_ref", "is", null);

  if (delErr) {
    return NextResponse.json({ error: `Erro ao limpar cartas antigas: ${delErr.message}` }, { status: 500 });
  }

  // Gera códigos sequenciais a partir do máximo das cartas manuais (source_ref IS NULL)
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
    };
  });

  const { error: insErr } = await svc().from("consorcio_cartas").insert(toInsert);
  if (insErr) return NextResponse.json({ error: `Erro ao inserir: ${insErr.message}` }, { status: 500 });

  return NextResponse.json({
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
  });
}
