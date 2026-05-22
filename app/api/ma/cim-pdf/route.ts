import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 60;
export const dynamic    = "force-dynamic";

// ── Tokens V3 V4.2 (fonte da verdade: v3-brandbook-v4-2-final.html) ──────────
const V3 = {
  nd:  "#09081A",  // Navy Deep — fundo absoluto
  nb:  "#13223A",  // Navy Base V4
  nc:  "#162744",  // Navy Card
  nm:  "#243A66",  // Navy Surface
  go:  "#C9A84C",  // Gold — acento ≥12px/700
  gl:  "#E8C97A",  // Gold Light — labels
  cr:  "#F5F1E8",  // Cream V4
  mu:  "#9BAFC5",  // Muted V4
  pt:  "#F5F6F8",  // Platinum — impressão A4 (nunca tela)
};

// ── Lança browser (prod = chromium-min serverless | dev = Chrome local) ──────
async function launchBrowser() {
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

  // ── 1. Dados do deal ──────────────────────────────────────────────────────
  const { data: deal } = await db
    .from("ma_deals")
    .select("code, target_company, asset_data")
    .eq("id", dealId)
    .single();

  const dealCode = deal?.code ?? "";
  const dealName = (deal?.target_company ?? "")
    .replace(/\/.*/, "").trim().slice(0, 40);

  // ── 2. Token VDR → parâmetro de watermark ────────────────────────────────
  let investorParam = "";
  if (vdrToken) {
    const { data: inv } = await db
      .from("deal_room_invites")
      .select("investor_name, investor_company")
      .eq("token", vdrToken)
      .single();
    if (inv) investorParam = `&vdr_token=${encodeURIComponent(vdrToken)}`;
  }

  // ── 3. Logo como base64 (header/footer templates não carregam URLs externas) ─
  let logoBase64 = "";
  try {
    const lr  = await fetch(`${baseUrl}/v3-logo-flat-gold-alpha.png`);
    if (lr.ok) logoBase64 = `data:image/png;base64,${Buffer.from(await lr.arrayBuffer()).toString("base64")}`;
  } catch { /* logo opcional */ }

  // ── 4. HTML do CIM ───────────────────────────────────────────────────────
  const cimUrl = `${baseUrl}/api/ma/preview-criativo?dealId=${dealId}&type=cim&lang=${lang}${investorParam}`;
  let cimHtml: string;
  try {
    const res = await fetch(cimUrl, { headers: { "User-Agent": "V3-PDF-Engine/1.0" } });
    if (!res.ok) throw new Error(`HTML fetch ${res.status}`);
    cimHtml = await res.text();
    // Injeta <base> para que caminhos relativos resolvam via page.setContent()
    cimHtml = cimHtml.replace("<head>", `<head><base href="${baseUrl}">`);
  } catch (e) {
    return NextResponse.json({ error: `Erro ao carregar CIM: ${e}` }, { status: 500 });
  }

  const printDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric",
  });

  // ── 5. Templates do timbrado ─────────────────────────────────────────────
  //
  // REGRA PUPPETEER: header/footer rodam em iframe isolado — sem CSS da página.
  //   • font-size DEVE ser declarado em CADA elemento (padrão = 0 → invisível)
  //   • CSS variables da página NÃO existem aqui → usar hex hardcoded
  //   • background só renderiza com -webkit-print-color-adjust:exact no próprio elemento
  //   • largura útil = calc(100% - 2 * margin.left/right) → usar margin nos templates
  //   • NÃO usar unidades mm em padding (bug Puppeteer) → usar px
  //
  // Brandbook: Gold=#C9A84C · GoldLight=#E8C97A · Cream=#F5F1E8 · Muted=#9BAFC5 · NavyDeep=#09081A

  const headerTemplate = `
    <div style="
      width:100%;
      margin:0;
      padding:6px 42px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      background:${V3.nd};
      border-bottom:1.5px solid ${V3.go};
      -webkit-print-color-adjust:exact;
      font-family:Arial,sans-serif;
      box-sizing:border-box;
    ">
      <!-- ESQUERDA: logo + identidade -->
      <div style="display:flex;align-items:center;gap:10px">
        ${logoBase64 ? `<img src="${logoBase64}" style="height:22px;width:auto;display:block;opacity:1">` : ""}
        <div>
          <div style="font-size:8px;font-weight:700;color:${V3.cr};letter-spacing:1.5px;text-transform:uppercase;line-height:1.3">
            V3 Partners · Mesa de M&amp;A
          </div>
          <div style="font-size:7px;color:${V3.mu};margin-top:1px;line-height:1.3">
            ${dealName}
          </div>
        </div>
      </div>
      <!-- DIREITA: código + classificação -->
      <div style="text-align:right">
        <div style="font-size:8px;font-weight:700;color:${V3.go};letter-spacing:1px;line-height:1.3">
          ${dealCode}
        </div>
        <div style="font-size:7px;color:${V3.mu};margin-top:1px;line-height:1.3">
          CONFIDENCIAL · NDA
        </div>
      </div>
    </div>
  `;

  const footerTemplate = `
    <div style="
      width:100%;
      margin:0;
      padding:5px 42px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      background:${V3.nd};
      border-top:1px solid rgba(201,168,76,0.3);
      -webkit-print-color-adjust:exact;
      font-family:Arial,sans-serif;
      box-sizing:border-box;
    ">
      <!-- ESQUERDA: razão social -->
      <div style="font-size:7px;color:${V3.mu};line-height:1.4">
        V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br
      </div>
      <!-- CENTRO: confidencialidade + data -->
      <div style="font-size:7px;color:${V3.mu};text-align:center;line-height:1.4">
        Confidencial · NDA Exigido · ${printDate}
      </div>
      <!-- DIREITA: número de página -->
      <div style="font-size:8px;font-weight:700;color:${V3.go};text-align:right;line-height:1.4">
        Pág.&#32;<span class="pageNumber"></span>/<span class="totalPages"></span>
      </div>
    </div>
  `;

  // ── 6. Puppeteer → PDF ───────────────────────────────────────────────────
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });

    // Injeta HTML — base href garante que logo e fontes resolvam
    await page.setContent(cimHtml, { waitUntil: "networkidle0", timeout: 45000 });

    // Aguarda Google Fonts (DM Sans) antes de gerar
    await page.evaluate(() => document.fonts.ready);

    // Injeta CSS adicional para calibrar espaço do timbrado
    // O @page do HTML define margens do conteúdo; Puppeteer sobrescreve com margin abaixo.
    // Matching: margin.top deve = header height + gap acima do conteúdo
    //           margin.bottom deve = footer height + gap abaixo do conteúdo
    // Header template ~13px padding + 22px logo = ~35px ≈ 13mm
    // Footer template ~10px padding + 14px texto = ~24px ≈ 9mm
    // gap seguro: +4mm cada lado
    // → top = 13 + 4 = 17mm | bottom = 9 + 4 = 13mm
    await page.addStyleTag({ content: `
      @media print {
        /* Espaço de timbrado: top 17mm (header) + bottom 13mm (footer) */
        @page { size: A4 portrait; margin: 17mm 14mm 13mm 14mm; }
        /* Detecta landscape automaticamente via @page landscape */
        @page landscape { size: A4 landscape; margin: 14mm 17mm 13mm 17mm; }
        /* Cover não precisa do gap extra — ocupa a página inteira */
        .cover { page-break-after: always !important; }
      }
    ` });

    const pdfBuffer = await page.pdf({
      // preferCSSPageSize:true → respeita @page do CSS (portrait/landscape)
      // e detecta automaticamente a orientação de cada página
      preferCSSPageSize: true,
      printBackground:   true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: {
        top:    "17mm",  // espaço para header (~13mm) + 4mm gap
        right:  "14mm",  // brandbook: margin 13mm 14mm
        bottom: "13mm",  // espaço para footer (~9mm) + 4mm gap
        left:   "14mm",
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
