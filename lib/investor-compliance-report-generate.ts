import { createClient as sc } from "@supabase/supabase-js";
import {
  buildInvestorComplianceReportFullHtml,
  investorComplianceReportPdfOptions,
  REPORT_VALIDITY_DAYS,
  type InvestorComplianceReportData,
} from "@/lib/investor-compliance-report-template";

/**
 * Núcleo de geração do dossiê de Due Diligence Inicial de Investidor (Mesa M&A),
 * mesmo padrão de lib/credit-report-generate.ts (launchBrowser duplicado de
 * propósito, mesma convenção já usada em 6 outros geradores deste repo).
 */

const BUCKET = "ma-investor-compliance";
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

function maskCpf(digits: string): string {
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

type CheckRow = {
  id: string;
  entity_name: string;
  entity_doc: string;
  dd_level: string | null;
  created_at: string;
  score: number | null;
  risk_label: string | null;
  verdict: string | null;
  escavador_result: Record<string, unknown> | null;
  checktudo_scr_result: Record<string, unknown> | null;
  checktudo_dossie_result: Record<string, unknown> | null;
  blacklist_match: Record<string, unknown> | null;
  source_errors: { source: string; message: string }[] | null;
  social_summary_text: string | null;
  social_summary_sources: string[] | null;
};

function buildReportData(row: CheckRow): InvestorComplianceReportData {
  const errors = row.source_errors ?? [];
  const errFor = (source: string) => errors.find((e) => e.source === source)?.message ?? null;

  const esc = row.escavador_result as {
    total_processos?: number;
    processos?: { numero_cnj: string; polo_ativo: string | null; polo_passivo: string | null; tribunal: string | null; status: string | null; valor_causa: number | null }[];
  } | null;

  const scrFlags = (row.checktudo_scr_result as { risk_flags?: Record<string, unknown> } | null)?.risk_flags;
  const dossieFlags = (row.checktudo_dossie_result as { risk_flags?: Record<string, unknown> } | null)?.risk_flags;

  const bl = row.blacklist_match as { name?: string; type?: string; notes?: string } | null;

  return {
    checkId: row.id,
    entityName: row.entity_name,
    entityDoc: maskCpf(row.entity_doc),
    ddLevel: row.dd_level ?? "Padrão",
    emittedAt: fmtDateTime(row.created_at),
    validUntil: fmtDate(new Date(Date.now() + REPORT_VALIDITY_DAYS * 86400000).toISOString()),
    score: row.score,
    riskLabel: row.risk_label,
    verdict: row.verdict,
    escavador: {
      consultado: !!row.escavador_result || !!errFor("escavador"),
      totalProcessos: esc?.total_processos ?? null,
      processos: (esc?.processos ?? []).map((p) => ({
        numeroCnj: p.numero_cnj,
        poloAtivo: p.polo_ativo,
        poloPassivo: p.polo_passivo,
        tribunal: p.tribunal,
        status: p.status,
        valorCausa: p.valor_causa,
      })),
      erro: errFor("escavador"),
    },
    checktudo: {
      consultado: !!row.checktudo_scr_result || !!row.checktudo_dossie_result || !!errFor("checktudo"),
      scr: scrFlags
        ? {
            quantidadeOperacoes: (scrFlags.scr_quantidade_operacoes as number) ?? null,
            quantidadeInstituicoes: (scrFlags.scr_quantidade_instituicoes as number) ?? null,
            coobrigacaoAssumida: (scrFlags.scr_coobrigacao_assumida as number) ?? null,
            coobrigacaoRecebida: (scrFlags.scr_coobrigacao_recebida as number) ?? null,
          }
        : null,
      dossie: dossieFlags
        ? {
            totalProcessos: (dossieFlags.lawsuit_total_count as number) ?? null,
            poloPassivoQuantidade: (dossieFlags.lawsuit_defendant_count as number) ?? null,
            poloPassivoValor: (dossieFlags.lawsuit_defendant_value as number) ?? null,
            poloAtivoQuantidade: (dossieFlags.lawsuit_plaintiff_count as number) ?? null,
            poloAtivoValor: (dossieFlags.lawsuit_plaintiff_value as number) ?? null,
          }
        : null,
      erro: errFor("checktudo"),
    },
    blacklistMatch: bl ? { name: bl.name ?? "", type: bl.type ?? "", notes: bl.notes ?? null } : null,
    socialSummary: row.social_summary_text,
    socialSources: row.social_summary_sources ?? [],
  };
}

export type GenerateInvestorComplianceReportResult =
  | { ok: true; check_id: string; pdf_path: string; pdf_url: string | null; bytes: number }
  | { ok: false; error: string };

/** Gera o dossiê de due diligence inicial de investidor e salva no Storage. */
export async function generateAndStoreInvestorComplianceReportPdf(
  checkId: string
): Promise<GenerateInvestorComplianceReportResult> {
  const svc = serviceClient();

  const { data: row, error: fetchErr } = await svc
    .from("ma_investor_compliance_checks")
    .select(
      "id, entity_name, entity_doc, dd_level, created_at, score, risk_label, verdict, escavador_result, checktudo_scr_result, checktudo_dossie_result, blacklist_match, source_errors, social_summary_text, social_summary_sources"
    )
    .eq("id", checkId)
    .single();

  if (fetchErr || !row) return { ok: false, error: "Checagem não encontrada" };

  const reportData = buildReportData(row as CheckRow);
  const html = buildInvestorComplianceReportFullHtml(reportData);

  let pdfBuffer: Buffer;
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 60000 });
    const pdf = await page.pdf(investorComplianceReportPdfOptions(reportData));
    pdfBuffer = Buffer.from(pdf);
  } catch (e) {
    return { ok: false, error: `Falha ao gerar PDF: ${(e as Error).message}` };
  } finally {
    if (browser) await browser.close();
  }

  const pdfPath = `checks/${checkId}/dossie-${Date.now()}.pdf`;

  const { error: upErr } = await svc.storage.from(BUCKET).upload(pdfPath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (upErr) return { ok: false, error: `Falha ao salvar PDF: ${upErr.message}` };

  const { data: signed } = await svc.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_SECONDS);

  await svc
    .from("ma_investor_compliance_checks")
    .update({ pdf_path: pdfPath, pdf_generated_at: new Date().toISOString() })
    .eq("id", checkId)
    .then(null, () => {});

  return { ok: true, check_id: checkId, pdf_path: pdfPath, pdf_url: signed?.signedUrl ?? null, bytes: pdfBuffer.length };
}
