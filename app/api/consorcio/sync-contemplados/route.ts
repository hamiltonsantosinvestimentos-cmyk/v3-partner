import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const SOURCE_URL = "https://contempladosrs.com.br/area-do-parceiro";

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

async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    // String literals (não variáveis) para que serverExternalPackages funcione
    // corretamente com Turbopack — o bundler precisa detectar o pacote estaticamente
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const chromium = (await import("@sparticuz/chromium-min")).default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const puppeteer = (await import("puppeteer-core")).default;
    return puppeteer.launch({
      args: [...(chromium.args ?? []), "--no-sandbox", "--disable-setuid-sandbox"],
      executablePath: await chromium.executablePath(
        "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar"
      ),
      headless: true,
    });
  }
  const puppeteer = (await import("puppeteer-core")).default;
  return puppeteer.launch({
    args: ["--no-sandbox"],
    executablePath:
      process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : "/usr/bin/google-chrome",
    headless: true,
  });
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
}

async function scrapeLetters(): Promise<ScrapedLetter[]> {
  const email = process.env.CONTEMPLADOS_EMAIL;
  const senha = process.env.CONTEMPLADOS_SENHA;

  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36");

    // ── Navega para área do parceiro (usa "load" — networkidle2 falha em SPAs) ─
    await page.goto(SOURCE_URL, { waitUntil: "load", timeout: 60000 });

    // ── Login (se houver campo de senha na página atual) ──────────────────────
    if (email && senha) {
      // Aguarda até 8s pelo campo de senha aparecer (pode ser renderizado por JS)
      const senhaSel = 'input[type="password"]';
      const hasSenha = await page.waitForSelector(senhaSel, { timeout: 8000 }).catch(() => null);

      if (hasSenha) {
        // Encontrou formulário de login — preenche via evaluate (mais estável)
        await page.evaluate((em, pw) => {
          const inputs = Array.from(document.querySelectorAll<HTMLInputElement>("input"));
          const emailField = inputs.find(i =>
            i.type !== "password" && i.type !== "hidden" &&
            i.type !== "submit" && i.type !== "checkbox" && i.type !== "radio"
          );
          const passField = inputs.find(i => i.type === "password");
          if (emailField) { emailField.focus(); emailField.value = em; emailField.dispatchEvent(new Event("input", { bubbles: true })); }
          if (passField)  { passField.focus();  passField.value  = pw; passField.dispatchEvent(new Event("input", { bubbles: true })); }
        }, email, senha);

        await new Promise(r => setTimeout(r, 500));

        // Submete — tenta botão, senão Enter no campo de senha
        const submitted = await page.evaluate(() => {
          const btn = document.querySelector<HTMLElement>('button[type="submit"], input[type="submit"]');
          if (btn) { btn.click(); return true; }
          const form = document.querySelector("form");
          if (form) { form.submit(); return true; }
          return false;
        });
        if (!submitted) await page.keyboard.press("Enter");

        // Aguarda desaparecimento do form ou tabela aparecer (até 20s)
        await page.waitForFunction(
          () => !document.querySelector('input[type="password"]') || !!document.querySelector("table"),
          { timeout: 20000 }
        ).catch(() => {});

        await new Promise(r => setTimeout(r, 2000));
        console.log("[sync-contemplados] pós-login URL:", page.url());
      } else {
        const html = await page.evaluate(() => document.body.innerHTML.substring(0, 3000));
        console.log("[sync-contemplados] sem form login. URL:", page.url(), "| HTML:", html);
      }
    }

    // Aguarda a tabela aparecer (até 20s)
    await page.waitForSelector("table", { timeout: 20000 }).catch(() => {});

    // Debug: captura URL final e título para diagnóstico
    const debugUrl   = page.url();
    const debugTitle = await page.title();

    // Extrai todas as linhas da tabela via DOM
    const rows = await page.evaluate(() => {
      const results: string[][] = [];
      document.querySelectorAll("table tr").forEach(tr => {
        const cells: string[] = [];
        tr.querySelectorAll("td, th").forEach(td => {
          cells.push((td.textContent ?? "").trim().replace(/\s+/g, " "));
        });
        if (cells.length >= 6) results.push(cells);
      });
      return results;
    });

    if (rows.length === 0) {
      throw new Error(`Nenhuma linha encontrada. URL final: ${debugUrl} | Título: ${debugTitle}`);
    }

    const letters: ScrapedLetter[] = [];

    for (const cells of rows) {
      const categoria = cells[0];
      if (!categoria) continue;
      const catLower = categoria.toLowerCase();
      // Pula cabeçalhos
      if (catLower === "categoria" || catLower === "tipo" || catLower.includes("observ")) continue;

      const creditValue = parseBRL(cells[1]);
      if (creditValue <= 0) continue;

      const entrada = parseBRL(cells[2]);
      const parcelasRaw = cells[3]?.trim() || null;
      const taxaTransf = parseBRL(cells[4]);
      const fundoComum = parseBRL(cells[5]);
      const disponibilidade = cells[6] || "Disponível";
      const administradora = cells[7] || "Contemplados RS";

      // Parse parcelas: "184x7869,00" → qtd=184, valor=7869
      let parcelas_qtd: number | null = null;
      let parcela_valor: number | null = null;
      if (parcelasRaw) {
        const m = parcelasRaw.replace(/\s/g, "").match(/^(\d+)[xX×]([0-9.,]+)/);
        if (m) {
          parcelas_qtd = parseInt(m[1], 10);
          parcela_valor = parseBRL(m[2]);
        }
      }

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
      });
    }

    return letters;
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

  const { count } = await svc()
    .from("consorcio_cartas")
    .select("*", { count: "exact", head: true });

  let counter = (count ?? 0) + 1;
  const toInsert = [];
  const toUpdate = [];

  for (const letter of allLetters) {
    const existing_entry = existingMap.get(letter.source_ref);
    if (existing_entry) {
      if (existing_entry.status !== letter.status) {
        toUpdate.push({ id: existing_entry.id, status: letter.status });
      }
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
    await svc().from("consorcio_cartas").update({ status: u.status }).eq("id", u.id);
    updated++;
  }

  return NextResponse.json({
    ok: true,
    total_scraped: allLetters.length,
    inserted,
    updated,
    skipped: allLetters.length - inserted - updated,
  });
}
