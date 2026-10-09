import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasDueDiligenceAccess } from "@/lib/cm/dd-access";
import { loadParty, namesByUserId, resolveContractCode, resolveDocument, svc } from "@/lib/cm/dd-party";
import {
  buildDdReportHtml, ddFolderPaths, ddReportExpiryBr, ddReportFileName, isNcndaCode, DD_RETENTION_MONTHS, type DdReportRun,
} from "@/lib/cm/dd-report";
import { ROLE_LABELS } from "@/lib/qualification-roles";

// Relatorios de Due Diligence da parte (Entrega 3, 08/10/2026), guardados na pasta Compliance/DueDiligence.
// BRIEF: scratchpad brief-e3-dd.md (REVISAO v2).
// GET: LISTA os relatorios (nunca entrega arquivo). POST: gera o PDF. Abrir passa SEMPRE por .../reports/[reportId]/open.
// Gate por usuario (due_diligence_qualificacao), sem bypass para ADMIN. Sem NCNDA de origem, nao gera.

export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
const BUCKET = "dd-compliance";
const PDF_TIMEOUT_MS = 45_000;

async function authorize() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE }) };
  if (!(await hasDueDiligenceAccess(user.id))) {
    return { error: NextResponse.json({ error: "Sem permissão para Due Diligence" }, { status: 403, headers: NO_STORE }) };
  }
  return { userId: user.id };
}

async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    return puppeteer.launch({
      args: [...(chromium.args ?? []), "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.executablePath(
        "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar",
      ),
      headless: true,
    });
  }
  const puppeteer = (await import("puppeteer-core")).default;
  return puppeteer.launch({
    args: ["--no-sandbox"],
    defaultViewport: { width: 1240, height: 1754 },
    executablePath: process.platform === "win32" ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" : "/usr/bin/google-chrome",
    headless: true,
  });
}

async function renderPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: PDF_TIMEOUT_MS });
    const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" }, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const db = svc();
  const party = await loadParty(db, id);
  if (!party) return NextResponse.json({ error: "Qualificação não encontrada" }, { status: 404, headers: NO_STORE });

  const { data } = await db
    .from("cm_party_dd_reports")
    .select("id, contract_code, folder_path, file_name, created_by, created_at")
    .eq("party_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  const names = await namesByUserId(db, (data ?? []).map((r) => r.created_by as string));
  const reports = (data ?? [])
    .map((r) => ({
      id: r.id,
      contract_code: r.contract_code,
      folder_path: r.folder_path,
      file_name: r.file_name,
      created_at: r.created_at,
      created_by_name: names[r.created_by as string] ?? "Usuário",
      expires_br: ddReportExpiryBr(new Date(r.created_at as string)),
    }))
    // mais recente primeiro; empate (mesmo instante) por nome do arquivo, pt-BR
    .sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime() || String(a.file_name).localeCompare(String(b.file_name), "pt-BR"));
  return NextResponse.json({ reports }, { headers: NO_STORE });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorize();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const db = svc();

  const party = await loadParty(db, id);
  if (!party) return NextResponse.json({ error: "Qualificação não encontrada" }, { status: 404, headers: NO_STORE });
  if (party.status !== "preenchido") {
    return NextResponse.json({ error: "A parte ainda não preencheu a qualificação" }, { status: 409, headers: NO_STORE });
  }
  const doc = resolveDocument(party);
  if (!doc.ok) return NextResponse.json({ error: doc.reason }, { status: 422, headers: NO_STORE });

  const contractCode = await resolveContractCode(db, party.batch_id as string | null);
  if (!isNcndaCode(contractCode)) {
    return NextResponse.json(
      { error: contractCode ? `Sem NCNDA de origem: o contrato de origem é ${contractCode}` : "Sem NCNDA de origem: a parte não tem contrato de origem no lote" },
      { status: 422, headers: NO_STORE },
    );
  }
  const paths = ddFolderPaths(contractCode as string, id, doc.kind);
  if (!paths) return NextResponse.json({ error: "Não foi possível montar a pasta do relatório" }, { status: 422, headers: NO_STORE });

  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - DD_RETENTION_MONTHS);
  const { data: runRows } = await db
    .from("cm_party_dd_runs")
    .select("tool, status, result_summary, created_at, requested_by")
    .eq("party_id", id)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });
  if (!runRows || runRows.length === 0) {
    return NextResponse.json({ error: `Nenhuma consulta nos últimos ${DD_RETENTION_MONTHS} meses` }, { status: 422, headers: NO_STORE });
  }

  const names = await namesByUserId(db, [auth.userId, ...runRows.map((r) => r.requested_by as string)]);
  const runs: DdReportRun[] = runRows.map((r) => ({
    tool: r.tool as DdReportRun["tool"],
    status: r.status as DdReportRun["status"],
    result_summary: (r.result_summary ?? {}) as Record<string, unknown>,
    created_at: r.created_at as string,
    requested_by_name: names[r.requested_by as string] ?? "Usuário",
  }));

  const { data: existing } = await db.from("cm_party_dd_reports").select("file_name").eq("party_id", id).eq("contract_code", contractCode);
  const now = new Date();
  const fileName = ddReportFileName(now, contractCode as string, (existing ?? []).map((e) => e.file_name as string));
  const partyName = (party.person_type === "PJ" ? (party.company_name as string | null) : null) ?? (party.full_name as string);
  const html = buildDdReportHtml({
    contractCode: contractCode as string,
    partyName,
    partyKind: doc.kind,
    partyDocument: doc.value,
    roleLabel: ROLE_LABELS[party.role_in_document as string] ?? (party.role_in_document as string),
    folderPath: paths.party,
    generatedAt: now,
    generatedByName: names[auth.userId] ?? "Usuário",
    runs,
  });

  // PDF com limite de tempo: estourou, devolve "NAO GERADO" e nunca um arquivo vazio.
  let pdf: Buffer;
  try {
    pdf = await Promise.race([
      renderPdf(html),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("tempo esgotado")), PDF_TIMEOUT_MS)),
    ]);
  } catch (e) {
    console.error("[dd-report] falha ao gerar PDF", { party_id: id, motivo: (e as Error).message });
    return NextResponse.json({ error: "NÃO GERADO: o relatório não pôde ser gerado agora, tente novamente" }, { status: 504, headers: NO_STORE });
  }
  if (pdf.length < 1000) {
    return NextResponse.json({ error: "NÃO GERADO: o arquivo saiu vazio, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  // Pastas governadas (MPS): cria o que faltar, na ordem raiz, NCNDA, parte. Falha de pasta nao deixa arquivo solto.
  const folders = [
    { path: paths.root, parent: null as string | null },
    { path: paths.ncnda, parent: paths.root },
    { path: paths.party, parent: paths.ncnda },
  ];
  for (const f of folders) {
    const { data: found } = await db.from("folder_registry").select("id").eq("full_path", f.path).maybeSingle();
    if (found) continue;
    const { error: folderError } = await db.from("folder_registry").insert({
      vertical: "Compliance",
      full_path: f.path,
      parent_path: f.parent,
      depth: f.path.split("/").length - 1,
      status: "active",
      created_by: auth.userId,
    });
    if (folderError && folderError.code !== "23505") {
      console.error("[dd-report] falha ao criar pasta", { code: folderError.code });
      return NextResponse.json({ error: "Não foi possível criar a pasta do relatório" }, { status: 500, headers: NO_STORE });
    }
  }

  const filePath = `${paths.party}/${fileName}`;
  const { error: uploadError } = await db.storage.from(BUCKET).upload(filePath, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    console.error("[dd-report] falha ao guardar o arquivo", { party_id: id, message: uploadError.message.slice(0, 120) });
    return NextResponse.json({ error: "Não foi possível guardar o relatório" }, { status: 500, headers: NO_STORE });
  }

  const { data: saved, error: insertError } = await db
    .from("cm_party_dd_reports")
    .insert({ party_id: id, contract_code: contractCode, folder_path: paths.party, file_path: filePath, file_name: fileName, created_by: auth.userId })
    .select("id, contract_code, folder_path, file_name, created_at")
    .single();
  if (insertError || !saved) {
    console.error("[dd-report] falha ao registrar o relatorio", { party_id: id, code: insertError?.code });
    await db.storage.from(BUCKET).remove([filePath]); // sem registro, o arquivo nao fica
    return NextResponse.json({ error: "O relatório foi gerado mas não pôde ser registrado, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json(
    { report: { ...saved, created_by_name: names[auth.userId] ?? "Usuário", expires_br: ddReportExpiryBr(new Date(saved.created_at as string)) } },
    { headers: NO_STORE },
  );
}
