import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { buildCreditReportData, REPORT_VALIDITY_DAYS } from "@/lib/credit-report-data";
import { buildExternalReportFullHtml, creditReportPdfOptions } from "@/lib/credit-report-template";

/**
 * Gera o PDF do dossiê de crédito a partir de QUALQUER credit_profile.
 *
 * Existe porque a rota antiga (orders/[id]/generate-report) só sabia gerar a
 * partir de um partner_service_orders, o que deixava de fora toda análise
 * disparada pela Mesa ou pelo motor. Esta rota é a que o W-CREDIT chama no n8n
 * ao final da análise, para o dossiê nascer junto com o perfil.
 *
 * Autenticação: sessão do portal com papel permitido, OU Bearer CRON_SECRET,
 * que é como o n8n se identifica (o workflow roda sem sessão de usuário).
 *
 * O layout é o padrão único do dossiê V3: buildExternalReportFullHtml para o
 * conteúdo e creditReportPdfOptions para a impressão (faixas navy de cabeçalho
 * e rodapé, numeração de página e respiro por quebra). Nunca montar PDF de
 * crédito por outro caminho, sob risco de dois padrões divergentes.
 */

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
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

interface RouteParams {
  params: Promise<{ profileId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { profileId } = await params;

  // n8n (sem sessão) autentica por Bearer; a Mesa autentica pela sessão do portal.
  const auth = req.headers.get("authorization");
  const viaServico = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;

  if (!viaServico) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !ALLOWED_ROLES.includes(profile.role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
  }

  const reportData = await buildCreditReportData(profileId);
  if (!reportData) {
    return NextResponse.json({ error: "Perfil de crédito não encontrado" }, { status: 404 });
  }

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
    return NextResponse.json({ error: `Falha ao gerar PDF: ${(e as Error).message}` }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }

  const svc = serviceClient();
  const pdfPath = `dossies/${profileId}/dossie-${Date.now()}.pdf`;

  const { error: upErr } = await svc.storage.from(BUCKET).upload(pdfPath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json({ error: `Falha ao salvar PDF: ${upErr.message}` }, { status: 500 });
  }

  const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_SECONDS);

  // Guarda o caminho no perfil para a Mesa reabrir o dossiê sem gerar de novo.
  await svc
    .from("credit_profiles")
    .update({ report_pdf_path: pdfPath, report_generated_at: new Date().toISOString() })
    .eq("id", profileId)
    .then(null, () => {});

  return NextResponse.json({
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
  });
}
