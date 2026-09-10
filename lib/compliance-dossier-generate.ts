import { createClient as sc } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { buildComplianceDossierData } from "@/lib/compliance-dossier-data";
import { buildComplianceDossierFullHtml, complianceDossierPdfOptions } from "@/lib/compliance-dossier-template";

// Núcleo de geração do Dossiê de Risco (Cockpit de Compliance, Fase 4,
// 10/09/2026). Mesmo padrão de generateAndStoreCreditReportPdf
// (lib/credit-report-generate.ts): Puppeteer + @sparticuz/chromium-min em
// produção, upload no Storage, retorno com bytes/URL assinada. Diferença
// real: o PDF só é gerado depois do quórum fechar (ver rota signoff), nunca
// sob demanda solta -- por isso este módulo também grava o hash SHA-256 do
// PDF final (carimbo de auditoria do fechamento, decisão do BRIEF Fase 4).

// Bucket real confirmado em app/api/cm/listings/[id]/gallery/route.ts: "documents",
// nunca "cm-documents" (isso é só o prefixo de pasta usado por convenção pra
// documentos da Bolsa de Ativos dentro do bucket genérico, não um bucket próprio).
const BUCKET = "documents";
const SIGNED_URL_SECONDS = 30 * 24 * 60 * 60; // 30 dias, mesma ordem de grandeza do Dossiê de Crédito

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
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

export type GenerateDossierResult =
  | { ok: true; listing_id: string; pdf_path: string; pdf_url: string | null; hash: string; bytes: number }
  | { ok: false; error: string };

/** Gera o Dossiê de Risco em PDF pra um listing_id, salva no Storage e carimba o hash. */
export async function generateAndStoreComplianceDossierPdf(listingId: string): Promise<GenerateDossierResult> {
  const data = await buildComplianceDossierData(listingId);
  if (!data) return { ok: false, error: "Ativo não encontrado" };

  const html = buildComplianceDossierFullHtml(data);

  let pdfBuffer: Buffer;
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    const pdf = await page.pdf(complianceDossierPdfOptions(data));
    pdfBuffer = Buffer.from(pdf);
  } catch (e) {
    return { ok: false, error: `Falha ao gerar PDF: ${(e as Error).message}` };
  } finally {
    if (browser) await browser.close();
  }

  const hash = createHash("sha256").update(pdfBuffer).digest("hex");
  const svc = serviceClient();
  const pdfPath = `cm-documents/${data.anonymousId}/dossie-risco-${Date.now()}.pdf`;

  const { error: upErr } = await svc.storage.from(BUCKET).upload(pdfPath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) return { ok: false, error: `Falha ao salvar PDF: ${upErr.message}` };

  const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_SECONDS);

  await svc
    .from("cm_asset_listings")
    .update({
      risk_dossier_pdf_path: pdfPath,
      risk_dossier_hash: hash,
      risk_dossier_finalized_at: new Date().toISOString(),
    })
    .eq("id", listingId);

  return {
    ok: true,
    listing_id: listingId,
    pdf_path: pdfPath,
    pdf_url: signed?.signedUrl ?? null,
    hash,
    bytes: pdfBuffer.length,
  };
}
