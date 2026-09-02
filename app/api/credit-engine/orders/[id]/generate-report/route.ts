import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { buildCreditReportData, REPORT_VALIDITY_DAYS } from "@/lib/credit-report-data";
import { buildExternalReportFullHtml, creditReportPdfOptions } from "@/lib/credit-report-template";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;
const BUCKET = "credit-documents";
const SIGNED_URL_SECONDS = REPORT_VALIDITY_DAYS * 24 * 60 * 60; // acompanha a validade declarada no relatório

interface RouteParams { params: Promise<{ id: string }> }

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

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const svc = serviceClient();

  const { data: order, error: orderErr } = await svc
    .from("partner_service_orders")
    .select("id, credit_desk_proposal_id")
    .eq("id", id)
    .single();
  if (orderErr || !order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  if (!order.credit_desk_proposal_id) {
    return NextResponse.json({ error: "Pedido ainda não foi vinculado a uma proposta" }, { status: 409 });
  }

  const { data: proposal } = await svc
    .from("credit_desk_proposals")
    .select("credit_profile_id")
    .eq("id", order.credit_desk_proposal_id)
    .single();
  if (!proposal?.credit_profile_id) {
    return NextResponse.json({ error: "Análise ainda não foi rodada para esta proposta" }, { status: 409 });
  }

  const reportData = await buildCreditReportData(proposal.credit_profile_id);
  if (!reportData) {
    return NextResponse.json({ error: "Não foi possível montar os dados do relatório" }, { status: 500 });
  }

  const html = buildExternalReportFullHtml(reportData);

  let browser;
  let pdfBuffer: Buffer;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 45000 });
    const pdf = await page.pdf(creditReportPdfOptions(reportData));
    pdfBuffer = Buffer.from(pdf);
  } catch (e) {
    return NextResponse.json({ error: `Falha ao gerar PDF: ${(e as Error).message}` }, { status: 500 });
  } finally {
    if (browser) await browser.close();
  }

  const pdfPath = `partner-orders/${id}/relatorio-${Date.now()}.pdf`;
  const { error: uploadErr } = await svc.storage.from(BUCKET).upload(pdfPath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadErr) return NextResponse.json({ error: `Falha ao salvar PDF: ${uploadErr.message}` }, { status: 500 });

  const reportToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);

  // report_delivered_at volta pra null sempre que um relatório é (re)gerado —
  // o token muda a cada geração (ver reportToken acima), então um eventual
  // link já enviado ao cliente com o token antigo para de funcionar (a busca
  // em /relatorio-credito/[token] é por igualdade exata). Resetar aqui faz o
  // passo "Entregue" da Mesa voltar a pendente, sinalizando que precisa
  // reenviar o link novo — em vez de mostrar "Entregue" com um link morto.
  const { error: updateErr } = await svc
    .from("partner_service_orders")
    .update({ report_public_token: reportToken, report_pdf_path: pdfPath, report_delivered_at: null })
    .eq("id", id);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const { data: signedData } = await svc.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_SECONDS);

  return NextResponse.json({
    success: true,
    report_public_token: reportToken,
    pdf_url: signedData?.signedUrl ?? null,
  });
}
