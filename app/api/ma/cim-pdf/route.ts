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

  // ── Busca logo como base64 para o timbrado ──
  // Header/footer templates não carregam URLs externas — precisa de data: URI
  let logoBase64 = "";
  try {
    const logoRes = await fetch(`${baseUrl}/v3-logo-flat-gold-alpha.png`);
    if (logoRes.ok) {
      const logoBuffer = await logoRes.arrayBuffer();
      logoBase64 = `data:image/png;base64,${Buffer.from(logoBuffer).toString("base64")}`;
    }
  } catch { /* logo opcional no timbrado */ }

  // ── Busca dados do deal para o timbrado ──
  const { data: dealInfo } = await db
    .from("ma_deals")
    .select("code, target_company, asset_data")
    .eq("id", dealId)
    .single();

  const dealCode    = dealInfo?.code ?? "";
  const dealName    = (dealInfo?.target_company ?? "").split("/")[0].trim().slice(0, 40);
  const printDate   = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  // ── Templates do papel timbrado — inline styles obrigatório (sem CSS externo) ──
  const headerTemplate = `
    <div style="
      width:100%;padding:0 12mm;height:16mm;
      display:flex;align-items:center;justify-content:space-between;
      background:#09081A;
      border-bottom:2px solid #C9A84C;
      box-sizing:border-box;
      -webkit-print-color-adjust:exact;
      font-family:'DM Sans',Arial,sans-serif;
    ">
      <div style="display:flex;align-items:center;gap:10px">
        ${logoBase64 ? `<img src="${logoBase64}" style="height:20px;width:auto;display:block">` : ""}
        <div>
          <div style="font-size:8px;font-weight:700;color:#F5F1E8;letter-spacing:1.5px;text-transform:uppercase">V3 Partners · Mesa de M&A</div>
          <div style="font-size:7px;color:#9BAFC5;margin-top:1px">${dealName}</div>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:8px;font-weight:700;color:#C9A84C;letter-spacing:1px">${dealCode}</div>
        <div style="font-size:7px;color:#9BAFC5;margin-top:1px">MEMORANDO CONFIDENCIAL</div>
      </div>
    </div>
  `;

  const footerTemplate = `
    <div style="
      width:100%;padding:0 12mm;height:12mm;
      display:flex;align-items:center;justify-content:space-between;
      background:#09081A;
      border-top:1px solid rgba(201,168,76,0.25);
      box-sizing:border-box;
      -webkit-print-color-adjust:exact;
      font-family:'DM Sans',Arial,sans-serif;
    ">
      <div style="font-size:7px;color:#9BAFC5">
        V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br
      </div>
      <div style="font-size:7px;color:#9BAFC5;text-align:center">
        Confidencial · NDA Exigido · ${printDate}
      </div>
      <div style="font-size:7px;color:#C9A84C;font-weight:700;text-align:right">
        Pág. <span class="pageNumber" style="color:#C9A84C"></span>/<span class="totalPages" style="color:#C9A84C"></span>
      </div>
    </div>
  `;

  // ── Puppeteer: injeta HTML e gera PDF ──
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });

    // Injeta HTML — base href já inserido, caminhos relativos resolvem corretamente
    await page.setContent(cimHtml, { waitUntil: "networkidle0", timeout: 45000 });

    // Aguarda DM Sans carregar via Google Fonts
    await page.evaluate(() => document.fonts.ready);

    // Gera PDF com timbrado profissional em cada página
    // top/bottom maior para abrigar header (16mm) e footer (12mm)
    const pdfBuffer = await page.pdf({
      format:              "A4",
      printBackground:     true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: {
        top:    "22mm",   // espaço para o cabeçalho
        right:  "12mm",
        bottom: "18mm",   // espaço para o rodapé
        left:   "12mm",
      },
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

    // Nome do arquivo — usa dealInfo já buscado antes do Puppeteer
    const code    = dealCode || dealId.slice(0, 8);
    const company = (dealInfo?.target_company ?? "CIM")
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
