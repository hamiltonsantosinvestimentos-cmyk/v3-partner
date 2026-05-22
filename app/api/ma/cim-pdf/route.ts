/**
 * /api/ma/cim-pdf — Gerador de PDF profissional V3 Partners
 *
 * REGRAS DE IMPRESSÃO (v3_print_standards no Supabase):
 * R1. html{background:#09081A} preenche canvas completo + margens (não só body)
 * R2. @page :first{margin:0} → sem timbrado na capa (capa tem logo própria)
 * R3. margin left/right = 0 no pdf() → sem bordas brancas laterais
 * R4. overflow:visible global + break-inside:avoid-page em todos containers
 * R5. font-size explícito em cada elemento do template (Puppeteer padrão = 0)
 * R6. preferCSSPageSize:true → respeita @page portrait/landscape do CSS
 * R7. margin.top = header(13mm) + gap(4mm) = 17mm | margin.bottom = footer(9mm) + gap(4mm) = 13mm
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic    = "force-dynamic";

// Tokens V4.2 — verificados linha a linha contra v3-brandbook-v4-2-final.html
const V3 = {
  nd: "#09081A",  // Navy Deep    — fundo absoluto, html canvas, timbrado
  go: "#C9A84C",  // Gold         — acento, código, número de página
  gl: "#E8C97A",  // Gold Light   — labels <12px
  cr: "#F5F1E8",  // Cream V4     — texto principal
  mu: "#9BAFC5",  // Muted V4     — texto secundário, razão social
};

async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    const chromium = await import("@sparticuz/chromium-min");
    const puppeteer = await import("puppeteer-core");
    return puppeteer.default.launch({
      args: [...(chromium.default.args ?? []), "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.default.executablePath(
        "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar"
      ),
      headless: true,
    });
  }
  const puppeteer = await import("puppeteer-core");
  return puppeteer.default.launch({
    args: ["--no-sandbox"],
    defaultViewport: { width: 1240, height: 1754 },
    executablePath:
      process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : "/usr/bin/google-chrome",
    headless: true,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dealId   = searchParams.get("dealId");
  const vdrToken = searchParams.get("vdr_token") ?? "";
  const lang     = searchParams.get("lang") ?? "pt-br";

  if (!dealId) return NextResponse.json({ error: "dealId obrigatório" }, { status: 400 });

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? `https://${request.headers.get("host") ?? "app.v3partners.com.br"}`;

  // ── Dados do deal ──────────────────────────────────────────────────────────
  const { data: deal } = await db
    .from("ma_deals")
    .select("code, target_company, asset_data")
    .eq("id", dealId)
    .single();

  const dealCode = deal?.code ?? "";
  const dealName = (deal?.target_company ?? "").replace(/\/.*/, "").trim().slice(0, 40);

  // ── VDR token → watermark ──────────────────────────────────────────────────
  let investorParam = "";
  if (vdrToken) {
    const { data: inv } = await db
      .from("deal_room_invites")
      .select("investor_name, investor_company")
      .eq("token", vdrToken)
      .single();
    if (inv) investorParam = `&vdr_token=${encodeURIComponent(vdrToken)}`;
  }

  // ── Logo base64 (R5: header templates não carregam URLs externas) ──────────
  let logoBase64 = "";
  try {
    const lr = await fetch(`${baseUrl}/v3-logo-flat-gold-alpha.png`);
    if (lr.ok) logoBase64 = `data:image/png;base64,${Buffer.from(await lr.arrayBuffer()).toString("base64")}`;
  } catch { /* logo opcional */ }

  // ── HTML do CIM ───────────────────────────────────────────────────────────
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

  // ── Templates do timbrado (R5: font-size explícito, hex hardcoded) ─────────
  //
  // Header/footer templates rodam em iframe isolado — SEM CSS da página.
  // font-size OBRIGATÓRIO em cada elemento (padrão Puppeteer = 0 → invisível).
  // CSS variables (var(--gold)) NÃO funcionam aqui → hex hardcoded sempre.
  // background com -webkit-print-color-adjust:exact no container raiz.
  // padding em px (não mm — bug Puppeteer em templates).
  // width:100% com padding:0 e box-sizing:border-box → alinha com margens do pdf().

  const headerTemplate = `
    <div style="
      width:100%;margin:0;padding:8px 42px;
      display:flex;align-items:center;justify-content:space-between;
      background:${V3.nd};
      border-bottom:2px solid ${V3.go};
      -webkit-print-color-adjust:exact;
      box-sizing:border-box;
      font-family:Arial,Helvetica,sans-serif;
    ">
      <div style="display:flex;align-items:center;gap:10px">
        ${logoBase64 ? `<img src="${logoBase64}" style="height:20px;width:auto;display:block">` : ""}
        <div>
          <div style="font-size:8px;font-weight:700;color:${V3.cr};letter-spacing:1.5px;text-transform:uppercase;line-height:1.3">
            V3 Partners &middot; Mesa de M&amp;A
          </div>
          <div style="font-size:7px;color:${V3.mu};margin-top:1px;line-height:1.3">
            ${dealName}
          </div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:8px;font-weight:700;color:${V3.go};letter-spacing:1px;line-height:1.3">
          ${dealCode}
        </div>
        <div style="font-size:7px;color:${V3.mu};margin-top:1px;line-height:1.3">
          CONFIDENCIAL &middot; NDA
        </div>
      </div>
    </div>
  `;

  const footerTemplate = `
    <div style="
      width:100%;margin:0;padding:6px 42px;
      display:flex;align-items:center;justify-content:space-between;
      background:${V3.nd};
      border-top:1px solid rgba(201,168,76,0.3);
      -webkit-print-color-adjust:exact;
      box-sizing:border-box;
      font-family:Arial,Helvetica,sans-serif;
    ">
      <div style="font-size:7px;color:${V3.mu};line-height:1.4">
        V3 Partners Solu&ccedil;&otilde;es Ltda &middot; CNPJ 14.219.287/0001-50 &middot; v3partners.com.br
      </div>
      <div style="font-size:7px;color:${V3.mu};text-align:center;line-height:1.4">
        Confidencial &middot; NDA Exigido &middot; ${printDate}
      </div>
      <div style="font-size:8px;font-weight:700;color:${V3.go};text-align:right;line-height:1.4">
        P&aacute;g.&nbsp;<span class="pageNumber"></span>&nbsp;/&nbsp;<span class="totalPages"></span>
      </div>
    </div>
  `;

  // ── CSS de print injetado via Puppeteer (além do @media print do HTML) ─────
  const printCss = `
    @media print {

      /* R1 — html preenche canvas inteiro (margens, última página) */
      html {
        background: ${V3.nd} !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        height: 100% !important;
      }
      body {
        background: ${V3.nd} !important;
        min-height: 100% !important;
        -webkit-print-color-adjust: exact !important;
      }

      /* R2 — sem timbrado na capa (primeira página tem logo própria) */
      @page :first {
        margin-top: 0 !important;
        margin-bottom: 0 !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }

      /* R3 — margem lateral 6mm no pdf() preenchida por html{background:navy} */
      /* Sem override de padding — cada seção usa seu próprio espaçamento */
      /* NÃO sobrescrever cover padding — causa corte lateral dos títulos */

      /* R4 — overflow:visible libera o algoritmo de quebra de página */
      * { overflow: visible !important; }

      /* R4 — break-inside em todos os containers de conteúdo */
      .section, .section-alt,
      .cover,
      .exec-grid,
      .info-card, .info-row,
      .kpi-card, .kpi-grid, .kpi-grid-3,
      .thesis-item, .thesis-grid,
      .upside-scenario,
      .fin-grid, .fin-table tr,
      .risk-table tr,
      .tenant-table tr,
      .doc-footer {
        break-inside: avoid-page !important;
        page-break-inside: avoid !important;
      }

      /* R4 — orphans/widows: evita linhas soltas no topo/base de páginas */
      p, li, span { orphans: 4; widows: 4; }

      /* R6 — orientação detectada via CSS */
      @page          { size: A4 portrait; }
      @page landscape { size: A4 landscape; }
    }
  `;

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });
    await page.setContent(cimHtml, { waitUntil: "networkidle0", timeout: 45000 });
    await page.evaluate(() => document.fonts.ready);

    // R1 — define background no html programaticamente (garante último página)
    await page.evaluate((navyHex: string) => {
      const html = document.documentElement;
      html.style.background = navyHex;
      html.style.setProperty("-webkit-print-color-adjust", "exact");
      html.style.setProperty("print-color-adjust", "exact");
      document.body.style.background = navyHex;
      document.body.style.minHeight = "100%";
    }, V3.nd);

    // Injeta CSS adicional de print (complementa o @media print do HTML)
    await page.addStyleTag({ content: printCss });

    // ── Gera PDF com timbrado profissional ────────────────────────────────────
    // R3: right/left = 0 (sem bordas brancas laterais)
    // R7: top = header(~13mm) + gap(4mm) = 17mm | bottom = footer(~9mm) + gap(4mm) = 13mm
    // R6: preferCSSPageSize:true → @page portrait/landscape do CSS
    const pdfBuffer = await page.pdf({
      preferCSSPageSize:   true,
      printBackground:     true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: {
        top:    "17mm",  // R7: header 13mm + gap 4mm
        right:  "6mm",   // R3: html{background:#09081A} preenche esta margem — sem borda branca
        bottom: "13mm",  // R7: footer 9mm + gap 4mm
        left:   "6mm",   // R3: idem — html background naval preenche, não aparece branco
      },
    });

    // Registra download na fila blockchain
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

    // Nome do arquivo
    const company  = (deal?.target_company ?? "CIM")
      .replace(/[^a-zA-Z0-9\s]/g, "").split(" ").slice(0, 3).join("_");
    const date     = new Date().toISOString().slice(0, 10);
    const filename = `V3_CIM_${company}_${dealCode}_${date}.pdf`;

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
