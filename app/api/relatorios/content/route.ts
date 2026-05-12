import { NextRequest, NextResponse } from "next/server";

const GITHUB_API = "https://api.github.com/repos/Jlnetto35/relat-rios-de-intelig-ncia-de-mercado-v3-M-A/contents";

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

  const rawToken = process.env.GITHUB_REPORTS_TOKEN ?? "";
  const token = rawToken.replace(/\s/g, "");

  const headers: Record<string, string> = {
    "User-Agent": "v3-partners-portal",
    "Accept": "application/vnd.github.v3+json",
  };
  if (token) headers["Authorization"] = `token ${token}`;

  try {
    // Usa GitHub Contents API (mais confiável que raw.githubusercontent.com em Vercel)
    const res = await fetch(`${GITHUB_API}/${file}`, { headers, cache: "no-store" });

    if (!res.ok) {
      console.error(`[relatorios/content] GitHub API ${res.status} for ${file}`);
      return new NextResponse(`Relatório não encontrado: ${file}`, { status: 404 });
    }

    const data = await res.json();

    // GitHub Contents API retorna conteúdo em base64
    if (!data.content) {
      return new NextResponse(`Relatório não encontrado: ${file}`, { status: 404 });
    }

    const html = Buffer.from(data.content.replace(/\s/g, ""), "base64").toString("utf-8");

    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, max-age=3600" },
    });
  } catch (e) {
    console.error("[relatorios/content]", e);
    return new NextResponse("Erro ao carregar relatório", { status: 500 });
  }
}
