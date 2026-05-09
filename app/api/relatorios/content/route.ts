import { NextRequest, NextResponse } from "next/server";

const GITHUB_RAW = "https://raw.githubusercontent.com/Jlnetto35/relat-rios-de-intelig-ncia-de-mercado-v3-M-A/main";

// Allowed files — validated allowlist
const ALLOWED_PATHS = new Set([
  "v3-report-esmeraldas-mg-2026-04-19.html",
  "v3-report-frigorificos-nordeste-ba-2026-04-19.html",
  "v3-report-mineracao-terras-raras-ouro-brasil-2026-04-25.html",
  "historico/v3-report-2026-04-11.html",
  "historico/v3-report-2026-04-24.html",
  "historico/v3-report-2026-05-01.html",
  "historico/v3-report-2026-05-06.html",
  "historico/v3-report-2026-05-08.html",
]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file") ?? "";

  // Only allow known files
  if (!ALLOWED_PATHS.has(file)) {
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
