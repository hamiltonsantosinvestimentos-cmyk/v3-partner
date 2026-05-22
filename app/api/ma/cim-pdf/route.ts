import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function launchBrowser() {
  // Em produção usa chromium serverless; em dev usa Chrome local
  if (process.env.NODE_ENV === "production") {
    const chromium = await import("@sparticuz/chromium-min");
    const puppeteer = await import("puppeteer-core");
    const executablePath = await chromium.default.executablePath(
      "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar"
    );
    return puppeteer.default.launch({
      args: [...(chromium.default.args ?? []), "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1240, height: 1754 },
      executablePath,
      headless: true,
    });
  } else {
    const puppeteer = await import("puppeteer-core");
    const executablePath = process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "/usr/bin/google-chrome";
    return puppeteer.default.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1240, height: 1754 },
      executablePath,
      headless: true,
    });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dealId   = searchParams.get("dealId");
  const vdrToken = searchParams.get("vdr_token") ?? "";
  const lang     = searchParams.get("lang") ?? "pt-br";

  if (!dealId) return NextResponse.json({ error: "dealId obrigatório" }, { status: 400 });

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Busca dados do investidor via token (para watermark)
  let investorParam = "";
  if (vdrToken) {
    const { data: inv } = await db
      .from("deal_room_invites")
      .select("investor_name, investor_email, investor_company")
      .eq("token", vdrToken)
      .single();
    if (inv) investorParam = `&vdr_token=${encodeURIComponent(vdrToken)}`;
  }

  // ── Gera HTML via fetch interno ──
  // proxy.ts inclui /api/ma/preview-criativo em PUBLIC_ROUTES — acesso sem auth
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? `https://${request.headers.get("host") ?? "app.v3partners.com.br"}`;
  const cimUrl = `${baseUrl}/api/ma/preview-criativo?dealId=${dealId}&type=cim&lang=${lang}${investorParam}`;

  let cimHtml: string;
  try {
    const res = await fetch(cimUrl, { headers: { "User-Agent": "V3-PDF-Engine/1.0" } });
    if (!res.ok) throw new Error(`HTML fetch failed: ${res.status}`);
    cimHtml = await res.text();

    // FIX 1: injeta <base href> para que caminhos relativos (logo, fontes)
    // resolvam corretamente quando usamos page.setContent() sem URL de base
    cimHtml = cimHtml.replace(
      "<head>",
      `<head><base href="${baseUrl}">`
    );
  } catch (fetchErr) {
    return NextResponse.json({ error: `Não foi possível carregar o CIM: ${fetchErr}` }, { status: 500 });
  }

  // ── Puppeteer: injeta HTML e gera PDF ──
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });

    // Injeta HTML diretamente — sem navegação HTTP, sem auth issues
    await page.setContent(cimHtml, { waitUntil: "networkidle0", timeout: 45000 });

    // Aguarda Google Fonts (DM Sans) carregarem
    await page.evaluate(() => document.fonts.ready);

    // Gera PDF — printBackground preserva navy #09081A, gold, todos os fundos
    const pdfBuffer = await page.pdf({
      format:            "A4",
      printBackground:   true,
      margin:            { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
      displayHeaderFooter: false,
      preferCSSPageSize: false,
    });

    // Registra download na fila blockchain
    if (vdrToken) {
      const { data: inv } = await db
        .from("deal_room_invites")
        .select("id")
        .eq("token", vdrToken)
        .single();
      if (inv) {
        await db.from("document_views").insert({
          invite_id:       inv.id,
          document_id:     null,
          ip_address:      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
          device_type:     "desktop",
          status:          "pdf_downloaded",
          duration_seconds: 0,
        });
      }
    }

    // Nome do arquivo
    const { data: deal } = await db
      .from("ma_deals")
      .select("code, target_company")
      .eq("id", dealId)
      .single();
    const code    = deal?.code ?? dealId.slice(0, 8);
    const company = (deal?.target_company ?? "CIM")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(" ")
      .slice(0, 3)
      .join("_");
    const date    = new Date().toISOString().slice(0, 10);
    const filename = `V3_CIM_${company}_${code}_${date}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      pdfBuffer.byteLength.toString(),
        "Cache-Control":       "no-store",
      },
    });
  } catch (err) {
    console.error("[cim-pdf]", err);
    return NextResponse.json(
      { error: `Erro ao gerar PDF: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
