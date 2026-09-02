import { createClient as sc } from "@supabase/supabase-js";
import { buildCreditReportData, REPORT_VALIDITY_DAYS } from "@/lib/credit-report-data";
import { buildExternalReportFullHtml, creditReportPdfOptions } from "@/lib/credit-report-template";

/**
 * Núcleo de geração do dossiê de crédito, extraído de
 * app/api/credit-engine/report/[profileId]/route.ts em 02/09/2026 para ser
 * chamado tanto pela rota (n8n / Mesa) quanto direto de dentro de
 * app/api/credit-engine/trigger/route.ts, sem round-trip HTTP.
 *
 * Motivo: o node "Gerar Dossiê PDF" do n8n roda DENTRO do webhook do motor,
 * ou seja, o primeiro PDF é sempre gerado antes do BACEN via CheckTudo
 * responder (CheckTudo roda depois, no trigger/route.ts, só quando o webhook
 * do n8n já retornou). Sem chamar isto de novo depois do CheckTudo, nenhum
 * dossiê automático jamais teria o BACEN. Nunca montar PDF de crédito por
 * outro caminho (ver v3-credit-report-layout skill).
 */

const BUCKET = "credit-documents";
const SIGNED_URL_SECONDS = REPORT_VALIDITY_DAYS * 24 * 60 * 60;

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

export type GenerateReportResult =
  | {
      ok: true;
      profile_id: string;
      subject_name: string;
      tier: string | null;
      score_total: number | null;
      pdf_path: string;
      pdf_url: string | null;
      valido_ate: string;
      validade_dias: number;
      bytes: number;
    }
  | { ok: false; error: string };

/** Gera o dossiê de crédito em PDF pra um profile_id e salva no Storage. */
export async function generateAndStoreCreditReportPdf(profileId: string): Promise<GenerateReportResult> {
  const reportData = await buildCreditReportData(profileId);
  if (!reportData) return { ok: false, error: "Perfil de crédito não encontrado" };

  const html = buildExternalReportFullHtml(reportData);

  let pdfBuffer: Buffer;
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    const pdf = await page.pdf(creditReportPdfOptions(reportData));
    pdfBuffer = Buffer.from(pdf);
  } catch (e) {
    return { ok: false, error: `Falha ao gerar PDF: ${(e as Error).message}` };
  } finally {
    if (browser) await browser.close();
  }

  const svc = serviceClient();
  const pdfPath = `dossies/${profileId}/dossie-${Date.now()}.pdf`;

  const { error: upErr } = await svc.storage.from(BUCKET).upload(pdfPath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) return { ok: false, error: `Falha ao salvar PDF: ${upErr.message}` };

  const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_SECONDS);

  // Guarda o caminho no perfil para a Mesa reabrir o dossiê sem gerar de novo.
  // Regenerar (ex.: depois do CheckTudo responder) sobrescreve esse ponteiro
  // de propósito: o PDF mais completo é sempre o que deve valer.
  await svc
    .from("credit_profiles")
    .update({ report_pdf_path: pdfPath, report_generated_at: new Date().toISOString() })
    .eq("id", profileId)
    .then(null, () => {});

  return {
    ok: true,
    profile_id: profileId,
    subject_name: reportData.subjectName,
    tier: reportData.scores.tier,
    score_total: reportData.scores.total,
    pdf_path: pdfPath,
    pdf_url: signed?.signedUrl ?? null,
    valido_ate: reportData.validUntil,
    validade_dias: REPORT_VALIDITY_DAYS,
    bytes: pdfBuffer.length,
  };
}
