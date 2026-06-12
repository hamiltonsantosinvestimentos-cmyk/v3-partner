import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { SQUADS } from "@/lib/squads";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // limite de body da Vercel (~4.5MB)
const MAX_CSV_CHARS = 15000; // por planilha, evita exceder context em arquivos enormes

function buildMindmapHtml({ title, subtitle, markdown, logoUrl }: {
  title: string;
  subtitle: string;
  markdown: string;
  logoUrl: string;
}) {
  const safeTitle = title.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeSubtitle = subtitle.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1080">
<title>Mapa Mental · ${safeTitle} · V3 Partners</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #09081A; font-family: 'DM Sans', sans-serif; overflow: hidden; height: 100vh; width: 100vw; }

#header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: rgba(9,8,26,.95); backdrop-filter: blur(12px);
  border-bottom: 1px solid #162744;
  padding: 12px 24px; height: 58px;
  display: flex; align-items: center; justify-content: space-between;
}
#header img { height: 28px; }
#header .title { font-size: 13px; font-weight: 700; color: #F5F1E8; }
#header .sub { font-size: 10px; color: #9BAFC5; margin-top: 1px; }
#header .controls { display: flex; gap: 8px; }
#header .btn {
  font-family: 'DM Sans', sans-serif;
  font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
  color: #9BAFC5; background: #162744; border: 1px solid #243A66;
  padding: 5px 14px; border-radius: 4px; cursor: pointer; transition: all .2s;
}
#header .btn:hover { color: #F5F1E8; border-color: #C9A84C; }

#mm-container { position: fixed; top: 58px; left: 0; right: 0; bottom: 0; }
#mindmap { width: 100%; height: 100%; }

#legend {
  position: fixed; bottom: 20px; left: 20px; z-index: 100;
  background: rgba(19,34,58,.92); border: 1px solid #243A66;
  border-radius: 8px; padding: 12px 16px; font-size: 10px; color: #9BAFC5;
}
.leg { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.leg:last-child { margin-bottom: 0; }
.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

#status-bar {
  position: fixed; bottom: 20px; right: 20px; z-index: 100;
  background: rgba(201,168,76,.1); border: 1px solid rgba(201,168,76,.3);
  border-radius: 6px; padding: 8px 14px; font-size: 10px; font-weight: 700;
  color: #E8C97A; letter-spacing: 1px; text-transform: uppercase;
}

.markmap-link { stroke-opacity: 0.65; stroke-width: 1.5px; }

#mindmap foreignObject div,
#mindmap foreignObject div div,
#mindmap foreignObject span {
  color: #FFFFFF !important;
  font-family: 'DM Sans', sans-serif !important;
  font-weight: 600 !important;
  font-size: 13px !important;
  line-height: 1.4 !important;
}
</style>
</head>
<body>

<div id="header">
  <div style="display:flex;align-items:center;gap:16px">
    <img src="${logoUrl}" alt="V3">
    <div class="info">
      <div class="title">${safeTitle}</div>
      <div class="sub">${safeSubtitle}</div>
    </div>
  </div>
  <div class="controls">
    <button class="btn" onclick="mm.fit()">Centralizar</button>
    <button class="btn" onclick="expandAll()">Expandir</button>
  </div>
</div>

<div id="mm-container"><svg id="mindmap"></svg></div>

<div id="legend">
  <div class="leg"><span class="dot" style="background:#C9A84C"></span> Operação / Deal</div>
  <div class="leg"><span class="dot" style="background:#4A83CF"></span> Categorias principais</div>
  <div class="leg"><span class="dot" style="background:#10B981"></span> Subcategorias</div>
  <div class="leg"><span class="dot" style="background:#F59E0B"></span> Detalhes</div>
  <div style="margin-top:6px;padding-top:6px;border-top:1px solid #162744;font-size:9px">
    Scroll = zoom · Arrastar = mover · Clique = colapsar
  </div>
</div>

<div id="status-bar">Gerado por IA · Revisar antes de uso oficial</div>

<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/markmap-lib/dist/browser/index.js"></script>
<script src="https://cdn.jsdelivr.net/npm/markmap-view/dist/browser/index.js"></script>

<script>
const markdown = ${JSON.stringify(markdown)};

window.addEventListener('load', () => {
  const { Transformer } = window.markmap;
  const { Markmap } = window.markmap;
  const transformer = new Transformer();
  const { root } = transformer.transform(markdown);

  const colors = ['#C9A84C','#4A83CF','#10B981','#F59E0B','#EF4444','#9B59B6','#E8C97A','#9BAFC5'];

  const svg = document.getElementById('mindmap');
  const mm = Markmap.create(svg, {
    color: (node) => colors[Math.min(node.depth, colors.length-1)],
    duration: 350,
    maxWidth: 320,
    fitRatio: 0.88,
    zoom: true,
    pan: true,
    initialExpandLevel: 2,
    paddingX: 18,
  });
  mm.setData(root);
  mm.fit();
  window.mm = mm;
  window.mmRoot = root;
});

function expandAll() {
  function open(n) { n.payload = {...n.payload, fold:0}; if(n.children) n.children.forEach(open); }
  open(window.mmRoot);
  window.mm.setData(window.mmRoot);
  window.mm.fit();
}

function applyWhiteText() {
  const svg = document.getElementById('mindmap');
  if (!svg) return;

  const styleEl = svg.querySelector('style');
  if (styleEl && !styleEl.dataset.v3patched) {
    styleEl.textContent +=
      '\\n.markmap { --markmap-text-color: #FFFFFF !important; }' +
      '\\n.markmap foreignObject div { color: #FFFFFF !important; font-weight: 600 !important; }';
    styleEl.dataset.v3patched = '1';
  }

  svg.querySelectorAll('foreignObject div').forEach(el => {
    el.style.setProperty('color', '#FFFFFF', 'important');
    el.style.setProperty('font-weight', '600', 'important');
    el.style.setProperty('font-family', '"DM Sans", sans-serif', 'important');
    el.style.setProperty('font-size', '13px', 'important');
  });
}

setTimeout(applyWhiteText, 350);
setTimeout(applyWhiteText, 850);
setTimeout(applyWhiteText, 2000);

const _v3obs = new MutationObserver(() => requestAnimationFrame(applyWhiteText));
window.addEventListener('load', () => {
  const svg = document.getElementById('mindmap');
  if (svg) _v3obs.observe(svg, { childList: true, subtree: true });
});
</script>

<!-- v3-gov: agente=mapa-mental | model=claude-sonnet-4-6 -->
</body>
</html>
`;
}

export async function POST(req: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "API key não configurada" }, { status: 500 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formato de requisição inválido" }, { status: 400 });
  }

  const message = (formData.get("message") as string | null)?.trim() ?? "";
  const sessionId = (formData.get("session_id") as string | null) || null;
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);

  if (!message && files.length === 0) {
    return NextResponse.json({ error: "Descreva o planejamento ou anexe ao menos um arquivo" }, { status: 400 });
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json({
      error: `Arquivos somam ${(totalBytes / 1024 / 1024).toFixed(1)}MB — limite atual é 4MB por requisição. Reduza o tamanho dos anexos.`,
    }, { status: 413 });
  }

  const squad = SQUADS["mapa-mental"];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const documentBlocks: any[] = [];
    const textParts: string[] = [];

    if (message) textParts.push(`PLANEJAMENTO DESCRITO PELO USUÁRIO:\n${message}`);

    for (const file of files) {
      const name = file.name.toLowerCase();
      const buf = Buffer.from(await file.arrayBuffer());

      if (name.endsWith(".pdf")) {
        documentBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
          title: file.name,
        });
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buf, { type: "buffer" });
        let sheetText = "";
        for (const sheetName of wb.SheetNames) {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
          sheetText += `\n--- Planilha: ${sheetName} ---\n${csv.slice(0, MAX_CSV_CHARS)}\n`;
        }
        textParts.push(`CONTEÚDO DA PLANILHA "${file.name}":${sheetText}`);
      } else {
        textParts.push(`[Arquivo "${file.name}" ignorado — formato não suportado. Use .pdf, .xlsx, .xls ou .csv]`);
      }
    }

    if (textParts.length === 0) {
      textParts.push("Gere o mapa mental com base apenas no(s) documento(s) anexado(s).");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const content: any[] = [...documentBlocks, { type: "text", text: textParts.join("\n\n") }];

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: squad.maxTokens ?? 4096,
      system: [{ type: "text", text: squad.prompt, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });

    let markdown = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    // remove eventuais code fences (``` ou ```markdown)
    markdown = markdown.replace(/^```[a-zA-Z]*\n?/, "").replace(/```\s*$/, "").trim();

    if (!markdown.startsWith("#")) {
      return NextResponse.json({ error: "Falha ao gerar a estrutura do mapa mental" }, { status: 500 });
    }

    const titleLine = markdown.split("\n").find(l => l.trim().startsWith("# "));
    const title = titleLine ? titleLine.replace(/^#\s*/, "").trim() : "Mapa Mental V3 Partners";

    const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const subtitle = `Mapa Mental gerado via Hub de Agentes V3 · ${dateStr}`;

    const host = req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const origin = host ? `${proto}://${host}` : "https://app.v3partners.com.br";
    const logoUrl = `${origin}/v3-logo-flat-gold-alpha.png`;

    const html = buildMindmapHtml({ title, subtitle, markdown, logoUrl });

    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: report, error } = await svc
      .from("generated_reports")
      .insert({
        user_id: user.id,
        session_id: sessionId,
        squad_id: "mapa-mental",
        title,
        html,
        output_type: "mindmap",
      })
      .select("id")
      .single();

    if (error) console.error("[mindmap] Supabase error:", error.message);

    return NextResponse.json({ ok: true, report_id: report?.id, html, title });
  } catch (err) {
    console.error("[mindmap]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro interno" }, { status: 500 });
  }
}
