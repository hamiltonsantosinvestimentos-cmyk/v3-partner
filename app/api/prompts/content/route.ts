import { NextResponse } from "next/server";

const GITHUB_RAW = "https://raw.githubusercontent.com/Jlnetto35/relat-rios-de-intelig-ncia-de-mercado-v3-M-A/main/prompts.html";

export async function GET() {
  const rawToken = (process.env.GITHUB_REPORTS_TOKEN ?? "").replace(/\s/g, "");
  const headers: Record<string, string> = { "User-Agent": "v3-partners-portal" };
  if (rawToken) headers["Authorization"] = `token ${rawToken}`;

  try {
    const res = await fetch(GITHUB_RAW, { headers, cache: "no-store" });
    if (!res.ok) return new NextResponse("Banco de Prompts não disponível", { status: 502 });

    let html = await res.text();

    // ── 1. CSS: ocultar lock screen, mostrar portal ──────────────────────
    html = html.replace("</head>", `<style>
#lock-screen{display:none!important;visibility:hidden!important;pointer-events:none!important}
#portal{display:block!important;visibility:visible!important}
</style>
</head>`);

    // ── 2. Script no final do body — executa APÓS todos os scripts da página ──
    html = html.replace("</body>", `<script>
(function run() {
  // Remover lock screen do DOM completamente
  var ls = document.getElementById('lock-screen');
  if (ls) ls.parentNode.removeChild(ls);

  // Garantir que o portal está visível
  var portal = document.getElementById('portal');
  if (portal) portal.style.cssText = 'display:block!important';

  // Chamar initChars se existir (renderiza stats do banco de prompts)
  if (typeof initChars === 'function') { try { initChars(); } catch(e) {} }
})();
</script>
</body>`);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[prompts/content]", e);
    return new NextResponse("Erro ao carregar Banco de Prompts", { status: 500 });
  }
}
