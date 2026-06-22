/**
 * /api/ma/cim-pdf — Gerador PDF profissional V3 Partners
 *
 * ARQUITETURA: 2 PDFs → merge via pdf-lib
 *   PDF A: capa (pág 1) — sem header/footer, margin zero, full-bleed navy
 *   PDF B: conteúdo (pág 2+) — com timbrado (header+footer)
 *   MERGE: pdf-lib combina A + B em documento único
 *
 * PROBLEMAS RESOLVIDOS:
 *   1. Header na capa ELIMINADO — PDF A não usa displayHeaderFooter
 *   2. Fundo navy sólido — html+body background + margin zero
 *   3. Espaço otimizado — sections sem page-break-before obrigatório
 *   4. Footer última página — pdf-lib controla paginação exata
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 300;
export const dynamic    = "force-dynamic";

// Tokens V3 V4.2 — fonte da verdade: v3-brandbook-v4-2-final.html
const V3 = {
  nd: "#09081A",
  go: "#C9A84C",
  gl: "#E8C97A",
  cr: "#F5F1E8",
  mu: "#9BAFC5",
};

async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    // String literals para que serverExternalPackages funcione com Turbopack
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    return puppeteer.launch({
      args: [...(chromium.args ?? []), "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.executablePath(
        "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar"
      ),
      headless: true,
    });
  }
  const puppeteer = (await import("puppeteer-core")).default;
  return puppeteer.launch({
    args: ["--no-sandbox"],
    defaultViewport: { width: 1240, height: 1754 },
    executablePath:
      process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : "/usr/bin/google-chrome",
    headless: true,
  });
}

// CSS injetado em ambos os PDFs — garante navy em toda a área da página
const BASE_PRINT_CSS = `
  @page { size: A4 portrait; margin: 0; }
  html, body {
    background: #09081A !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    height: 100% !important;
    min-height: 100% !important;
  }
  /* Camada de fundo que cobre toda a área incluindo gaps entre seções */
  body::before {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: #09081A;
    z-index: -1;
    -webkit-print-color-adjust: exact !important;
  }
  * { box-shadow: none !important; overflow: visible !important; }
  .section, .section-alt {
    padding-left: 14mm !important;
    padding-right: 14mm !important;
  }
`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dealId   = searchParams.get("dealId");
  const vdrToken = searchParams.get("vdr_token") ?? "";
  const lang     = searchParams.get("lang") ?? "pt-br";

  if (!dealId) return NextResponse.json({ error: "dealId obrigatório" }, { status: 400 });

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? `https://${request.headers.get("host") ?? "app.v3partners.com.br"}`;

  // Dados do deal
  const { data: deal } = await db
    .from("ma_deals").select("code, target_company").eq("id", dealId).single();
  const dealCode = deal?.code ?? "";
  const dealName = (deal?.target_company ?? "").replace(/\/.*/, "").trim().slice(0, 40);

  // VDR token
  let investorParam = "";
  if (vdrToken) {
    const { data: inv } = await db
      .from("deal_room_invites").select("investor_name, investor_company").eq("token", vdrToken).single();
    if (inv) investorParam = `&vdr_token=${encodeURIComponent(vdrToken)}`;
  }

  // Logo base64 para o timbrado
  let logoBase64 = "";
  try {
    const lr = await fetch(`${baseUrl}/v3-logo-flat-gold-alpha.png`);
    if (lr.ok) logoBase64 = `data:image/png;base64,${Buffer.from(await lr.arrayBuffer()).toString("base64")}`;
  } catch { /* opcional */ }

  // HTML do CIM
  const cimUrl = `${baseUrl}/api/ma/preview-criativo?dealId=${dealId}&type=cim&lang=${lang}${investorParam}`;
  let cimHtml: string;
  try {
    const res = await fetch(cimUrl, { headers: { "User-Agent": "V3-PDF-Engine/1.0" } });
    if (!res.ok) throw new Error(`HTML fetch ${res.status}`);
    cimHtml = await res.text();
    cimHtml = cimHtml.replace("<head>", `<head><base href="${baseUrl}">`);
  } catch (e) {
    return NextResponse.json({ error: `Erro ao carregar CIM: ${e}` }, { status: 500 });
  }

  const printDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });

  // Templates do timbrado (font-size explícito — Puppeteer padrão = 0)
  const headerTemplate = `
    <div style="
      width:100%;margin:0;padding:7px 42px;
      display:flex;align-items:center;justify-content:space-between;
      background:${V3.nd};border-bottom:2px solid ${V3.go};
      -webkit-print-color-adjust:exact;box-sizing:border-box;
      font-family:Arial,sans-serif;
    ">
      <div style="display:flex;align-items:center;gap:10px">
        ${logoBase64 ? `<img src="${logoBase64}" style="height:20px;width:auto;display:block">` : ""}
        <div>
          <div style="font-size:8px;font-weight:700;color:${V3.cr};letter-spacing:1.5px;text-transform:uppercase;line-height:1.3">V3 Partners &middot; Mesa de M&amp;A</div>
          <div style="font-size:7px;color:${V3.mu};margin-top:1px;line-height:1.3">${dealName}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:8px;font-weight:700;color:${V3.go};letter-spacing:1px;line-height:1.3">${dealCode}</div>
        <div style="font-size:7px;color:${V3.mu};margin-top:1px;line-height:1.3">CONFIDENCIAL &middot; NDA</div>
      </div>
    </div>`;

  const footerTemplate = `
    <div style="
      width:100%;margin:0;padding:5px 42px;
      display:flex;align-items:center;justify-content:space-between;
      background:${V3.nd};border-top:1px solid rgba(201,168,76,0.3);
      -webkit-print-color-adjust:exact;box-sizing:border-box;
      font-family:Arial,sans-serif;
    ">
      <div style="font-size:7px;color:${V3.mu};line-height:1.4">V3 Partners Solu&ccedil;&otilde;es Ltda &middot; CNPJ 14.219.287/0001-50 &middot; v3partners.com.br</div>
      <div style="font-size:7px;color:${V3.mu};text-align:center;line-height:1.4">Confidencial &middot; NDA &middot; ${printDate}</div>
      <div style="font-size:8px;font-weight:700;color:${V3.go};text-align:right;line-height:1.4">P&aacute;g.&nbsp;<span class="pageNumber"></span>&nbsp;/&nbsp;<span class="totalPages"></span></div>
    </div>`;

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
    await page.setContent(cimHtml, { waitUntil: "load", timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);

    // Garante navy no html programaticamente
    await page.evaluate((navy: string) => {
      document.documentElement.style.background = navy;
      document.documentElement.style.setProperty("-webkit-print-color-adjust", "exact");
      document.body.style.background = navy;
    }, V3.nd);

    await page.addStyleTag({ content: BASE_PRINT_CSS });

    // ── PDF A: CAPA (página 1) — sem header/footer, full-bleed ────────────
    const coverPdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground:   true,
      displayHeaderFooter: false,   // SEM timbrado na capa
      pageRanges:        "1",
      margin:            { top: "0", right: "0", bottom: "0", left: "0" },
    });

    // ── PDF B: CONTEÚDO (páginas 2+) — com timbrado ───────────────────────
    const contentPdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground:   true,
      displayHeaderFooter: true,    // COM timbrado nas páginas de conteúdo
      headerTemplate,
      footerTemplate,
      pageRanges:        "2-",
      margin:            { top: "17mm", right: "0", bottom: "13mm", left: "0" },
    });

    // ── MERGE: pdf-lib une capa + conteúdo ───────────────────────────────
    const pdfLibPkg = "pdf-lib";
    const { PDFDocument } = await import(/* webpackIgnore: true */ pdfLibPkg);

    const finalDoc   = await PDFDocument.create();
    const coverDoc   = await PDFDocument.load(coverPdf);
    const contentDoc = await PDFDocument.load(contentPdf);

    // Copia a capa (página 1)
    const [coverPage] = await finalDoc.copyPages(coverDoc, [0]);
    finalDoc.addPage(coverPage);

    // Copia todas as páginas de conteúdo
    const contentPageIndices = Array.from({ length: contentDoc.getPageCount() }, (_, i) => i);
    const contentPages = await finalDoc.copyPages(contentDoc, contentPageIndices);
    contentPages.forEach((p: import("pdf-lib").PDFPage) => finalDoc.addPage(p));

    // Metadata
    finalDoc.setTitle(`CIM — ${deal?.target_company ?? dealCode}`);
    finalDoc.setAuthor("V3 Partners — Mesa de M&A");
    finalDoc.setSubject("Memorando de Informação Confidencial");
    finalDoc.setKeywords(["V3 Partners", "CIM", dealCode, "M&A", "Confidencial"]);
    finalDoc.setCreationDate(new Date());

    const mergedPdf = await finalDoc.save();

    // Registra na fila blockchain
    if (vdrToken) {
      const { data: inv } = await db
        .from("deal_room_invites").select("id").eq("token", vdrToken).single();
      if (inv) {
        await db.from("document_views").insert({
          invite_id: inv.id, document_id: null,
          ip_address: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
          device_type: "desktop", status: "pdf_downloaded", duration_seconds: 0,
        });
      }
    }

    const company  = (deal?.target_company ?? "CIM").replace(/[^a-zA-Z0-9\s]/g, "").split(" ").slice(0, 3).join("_");
    const date     = new Date().toISOString().slice(0, 10);
    const filename = `V3_CIM_${company}_${dealCode}_${date}.pdf`;

    return new Response(Buffer.from(mergedPdf), {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      mergedPdf.byteLength.toString(),
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
