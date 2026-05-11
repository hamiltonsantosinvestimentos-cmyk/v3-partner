import { NextRequest, NextResponse } from "next/server";

const GITHUB_RAW = "https://raw.githubusercontent.com/Jlnetto35/relat-rios-de-intelig-ncia-de-mercado-v3-M-A/main";

// Validacao por padrao — sem allowlist manual que precisa ser atualizado todo dia
// Permite: historico/v3-report-YYYY-MM-DD.html (gerados pelo CCR diariamente)
//          v3-report-*.html (relatorios setoriais na raiz)
// Bloqueia: path traversal, extensoes nao-html, qualquer outro padrao
function isAllowed(file: string): boolean {
  if (!file || file.includes("..") || file.includes("//")) return false;
  const dailyReport = /^historico\/v3-report-\d{4}-\d{2}-\d{2}\.html$/;
  const sectorReport = /^v3-report-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.html$/;
  const legacyReport = /^[a-z0-9-]+\.html$/;
  return dailyReport.test(file) || sectorReport.test(file) || legacyReport.test(file);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file") ?? "";

  if (!isAllowed(file)) {
    return new NextResponse(`Relatório não encontrado: ${file}`, { status: 404 });
  }

  // Token — strip ALL whitespace (newlines from env var)
  const rawToken = process.env.GITHUB_REPORTS_TOKEN ?? "";
  const token = rawToken.replace(/\s/g, "");

  const headers: Record<string, string> = { "User-Agent": "v3-partners-portal" };
  if (token) headers["Authorization"] = `token ${token}`;

  try {
    const res = await fetch(`${GITHUB_RAW}/${file}`, { headers, cache: "no-store" });

    if (!res.ok) {
      // Fallback: tentar sem token
      const res2 = await fetch(`${GITHUB_RAW}/${file}`, {
        headers: { "User-Agent": "v3-partners-portal" },
        cache: "no-store",
      });
      if (!res2.ok) return new NextResponse(`Relatório não encontrado: ${file}`, { status: 404 });
      const html2 = await res2.text();
      return new NextResponse(html2, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=3600" },
      });
    }

    const html = await res.text();
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=3600" },
    });
  } catch (e) {
    console.error("[relatorios/content]", e);
    return new NextResponse("Erro ao carregar relatório", { status: 500 });
  }
}
