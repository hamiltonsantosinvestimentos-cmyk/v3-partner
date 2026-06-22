import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const SOURCE_URL = "https://contempladosrs.com.br/area-do-parceiro";
const SOURCE_URL_NC = "https://contempladosrs.com.br/area-do-parceiro-nao-contemplada";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function parseBRL(raw: string): number {
  if (!raw) return 0;
  return parseFloat(raw.replace(/[R$\s.]/g, "").replace(",", ".")) || 0;
}

interface ScrapedLetter {
  type: "IMOVEL" | "VEICULO" | "SERVICO" | "OUTROS";
  credit_value: number;
  admin: string;
  group_name: string | null;
  quota: string | null;
  status: "DISPONIVEL" | "NEGOCIACAO";
  asking_price: number;
  discount: number;
  source_ref: string; // hash para deduplicação
  parcelas_raw: string | null;
  taxa_transf: number;
  fundo_comum: number;
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

/** Extrai linhas de uma tabela HTML simples sem cheerio */
function parseTable(html: string): ScrapedLetter[] {
  const letters: ScrapedLetter[] = [];

  // Encontra todas as linhas <tr>
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1];
    // Extrai células <td>
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      // Remove tags HTML e decode HTML entities
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#8209;/g, "-")
        .replace(/\s+/g, " ")
        .trim();
      cells.push(text);
    }

    // Espera ao menos 6 células: Categoria, Crédito, Entrada, Parcelas, Taxa, Fundo, Disponibilidade, Obs
    if (cells.length < 6) continue;

    const categoria = cells[0];
    if (!categoria || categoria.toLowerCase() === "categoria") continue; // pula header

    const creditValue = parseBRL(cells[1]);
    if (creditValue <= 0) continue;

    const entrada = parseBRL(cells[2]);
    const parcelasRaw = cells[3] || null;
    const taxaTransf = parseBRL(cells[4]);
    const fundoComum = parseBRL(cells[5]);
    const disponibilidade = cells[6] || "Disponível";
    const administradora = cells[7] || "Contemplados RS";

    // Desconto = (crédito - entrada) / crédito * 100
    const discount = creditValue > 0 && entrada > 0
      ? Math.round(((creditValue - entrada) / creditValue) * 100 * 10) / 10
      : 0;

    // Hash simples para deduplicação
    const sourceRef = `${categoria}-${creditValue}-${entrada}-${administradora}`.toLowerCase().replace(/\s+/g, "-");

    letters.push({
      type: parseCategory(categoria),
      credit_value: creditValue,
      admin: administradora,
      group_name: null,
      quota: parcelasRaw,
      status: parseStatus(disponibilidade),
      asking_price: entrada,
      discount,
      source_ref: sourceRef,
      parcelas_raw: parcelasRaw,
      taxa_transf: taxaTransf,
      fundo_comum: fundoComum,
    });
  }

  return letters;
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao buscar ${url}`);
  return res.text();
}

export async function POST() {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  // Scraping das duas páginas em paralelo
  let html1 = "", html2 = "";
  try {
    [html1, html2] = await Promise.all([fetchPage(SOURCE_URL), fetchPage(SOURCE_URL_NC)]);
  } catch (e) {
    return NextResponse.json({ error: `Erro ao buscar portal: ${String(e)}` }, { status: 502 });
  }

  const letters1 = parseTable(html1);
  const letters2 = parseTable(html2);
  const allLetters = [...letters1, ...letters2];

  if (allLetters.length === 0) {
    return NextResponse.json({ error: "Nenhuma carta encontrada no portal. O site pode ter mudado de estrutura." }, { status: 422 });
  }

  // Busca cartas já existentes com source_ref para deduplicar
  const { data: existing } = await svc()
    .from("consorcio_cartas")
    .select("id, source_ref, status")
    .not("source_ref", "is", null);

  const existingRefs = new Set((existing ?? []).map((r: { source_ref: string }) => r.source_ref));

  // Conta cartas existentes para gerar códigos
  const { count } = await svc()
    .from("consorcio_cartas")
    .select("*", { count: "exact", head: true });

  let counter = (count ?? 0) + 1;
  const toInsert = [];
  const toUpdate = [];

  for (const letter of allLetters) {
    if (existingRefs.has(letter.source_ref)) {
      // Atualiza status se mudou
      const existing_entry = (existing ?? []).find((r: { source_ref: string }) => r.source_ref === letter.source_ref);
      if (existing_entry && existing_entry.status !== letter.status) {
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
      group_name: letter.group_name,
      quota: letter.quota,
      status: letter.status,
      asking_price: letter.asking_price,
      discount: letter.discount,
      source_ref: letter.source_ref,
      created_by: user.id,
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
