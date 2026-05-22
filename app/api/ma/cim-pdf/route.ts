import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

// Externalizado via serverExternalPackages no next.config.ts
// Importação dinâmica para evitar bundling
async function launchBrowser() {
  const chromium = await import("@sparticuz/chromium-min");
  const puppeteer = await import("puppeteer-core");

  // Em prod usa o Chromium serverless; em dev usa o Chrome local
  const executablePath = process.env.NODE_ENV === "production"
    ? await chromium.default.executablePath(
        "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar"
      )
    : process.platform === "win32"
    ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    : "/usr/bin/google-chrome";

  const browser = await puppeteer.default.launch({
    args: [...(chromium.default.args ?? []), "--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: { width: 1280, height: 900 },
    executablePath,
    headless: true,
  });
  return browser;
}

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dealId   = searchParams.get("dealId");
  const vdrToken = searchParams.get("vdr_token") ?? "";
  const lang     = searchParams.get("lang") ?? "pt-br";

  if (!dealId) {
    return NextResponse.json({ error: "dealId obrigatório" }, { status: 400 });
  }

  // Valida vdr_token se presente
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  let investorName = "";
  if (vdrToken) {
    const { data: invite } = await svc
      .from("deal_room_invites")
      .select("investor_name, investor_company")
      .eq("token", vdrToken)
      .single();
    if (invite) {
      investorName = invite.investor_name + (invite.investor_company ? ` · ${invite.investor_company}` : "");
    }
  }

  // URL do CIM HTML (o mesmo que o investidor vê no browser)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${request.headers.get("host")}`;
  const cimUrl  = `${baseUrl}/api/ma/preview-criativo?dealId=${dealId}&type=cim&lang=${lang}${vdrToken ? `&vdr_token=${encodeURIComponent(vdrToken)}` : ""}`;

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Configura viewport A4 a 96dpi
    await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 1 });

    // Aguarda CIM carregar completamente (fontes Google Fonts incluídas)
    await page.goto(cimUrl, { waitUntil: "networkidle0", timeout: 45000 });

    // Aguarda DM Sans carregar
    await page.evaluateHandle("document.fonts.ready");

    // Gera PDF com qualidade profissional
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,   // preserva navy, gold, todos os backgrounds
      margin: { top: "12mm", right: "12mm", bottom: "12mm", left: "12mm" },
      displayHeaderFooter: false,
      preferCSSPageSize: false,
    });

    // Registra download na fila blockchain (se token presente)
    if (vdrToken) {
      const { data: invite } = await svc
        .from("deal_room_invites")
        .select("id")
        .eq("token", vdrToken)
        .single();
      if (invite) {
        await svc.from("document_views").insert({
          invite_id:   invite.id,
          document_id: null,
          ip_address:  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
          device_type: "desktop",
          status:      "pdf_downloaded",
          duration_seconds: 0,
        });
      }
    }

    // Nome do arquivo para o download
    const { data: deal } = await svc.from("ma_deals").select("code, target_company").eq("id", dealId).single();
    const code    = deal?.code ?? dealId.slice(0, 8);
    const company = (deal?.target_company ?? "CIM").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30);
    const date    = new Date().toISOString().slice(0, 10);
    const filename = `V3_CIM_${company}_${code}_${date}.pdf`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length":      pdfBuffer.byteLength.toString(),
        "Cache-Control":       "no-store, no-cache",
      },
    });
  } catch (err) {
    console.error("[cim-pdf] ERRO:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Erro ao gerar PDF: ${msg}` }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }
}
