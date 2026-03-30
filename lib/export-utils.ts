// ─── Tipos genéricos ──────────────────────────────────────────────────────────

export interface ExportColumn {
  header: string;
  key: string;
  width?: number; // Excel column width
  format?: "moeda" | "percent" | "date" | "text";
}

export interface ExportOptions {
  titulo: string;
  subtitulo?: string;
  mes?: string;
  colunas: ExportColumn[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dados: any[];
  totais?: { label: string; valores: Record<string, unknown> };
  orientacao?: "portrait" | "landscape";
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtMoeda(v: unknown): string {
  const n = Number(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtCell(v: unknown, format?: ExportColumn["format"]): string {
  if (v === null || v === undefined) return "—";
  if (format === "moeda") return fmtMoeda(v);
  if (format === "percent") return `${v}%`;
  if (format === "date") {
    try { return new Date(String(v) + "T00:00:00").toLocaleDateString("pt-BR"); }
    catch { return String(v); }
  }
  return String(v);
}

// ─── PDF via HTML/Print ───────────────────────────────────────────────────────
// Gera um HTML estilizado e abre em nova aba para salvar como PDF via Ctrl+P / Imprimir

export async function exportPDF(opts: ExportOptions): Promise<void> {
  const isLandscape = opts.orientacao === "landscape" || opts.colunas.length > 7;
  const agora = new Date().toLocaleString("pt-BR");
  const titulo = opts.titulo.toUpperCase();
  const sub = [opts.mes, opts.subtitulo].filter(Boolean).join("  ·  ");

  // Build table rows
  const thead = opts.colunas.map(c =>
    `<th>${c.header}</th>`
  ).join("");

  const tbody = opts.dados.map((row, i) => {
    const cells = opts.colunas.map(c =>
      `<td>${fmtCell(row[c.key], c.format)}</td>`
    ).join("");
    return `<tr class="${i % 2 === 0 ? "" : "alt"}">${cells}</tr>`;
  }).join("");

  let tfoot = "";
  if (opts.totais) {
    const firstKey = Object.keys(opts.totais.valores)[0];
    const cells = opts.colunas.map(c => {
      if (c.key === firstKey) return `<td class="tot-label">${opts.totais!.label}</td>`;
      const v = opts.totais!.valores[c.key];
      return `<td class="tot-val">${v !== undefined ? fmtCell(v, c.format) : ""}</td>`;
    }).join("");
    tfoot = `<tfoot><tr>${cells}</tr></tfoot>`;
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>V3 Partners — ${opts.titulo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: ${isLandscape ? "A4 landscape" : "A4 portrait"}; margin: 15mm 12mm; }
    body { font-family: "Segoe UI", Arial, sans-serif; font-size: 11px; color: #1a1a2e; background: #fff; }

    /* ── Header ── */
    .header { background: #0F1E35; color: #fff; padding: 14px 18px 10px; display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #C4922E; margin-bottom: 18px; }
    .brand { display: flex; align-items: baseline; gap: 6px; }
    .brand-v3 { font-size: 26px; font-weight: 900; color: #C4922E; letter-spacing: -1px; }
    .brand-name { font-size: 12px; font-weight: 600; color: #e0e0e0; letter-spacing: 3px; }
    .header-right { text-align: right; }
    .report-title { font-size: 16px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 1px; }
    .report-sub { font-size: 10px; color: #C4922E; margin-top: 3px; }
    .gen-date { font-size: 9px; color: #aaa; margin-top: 5px; }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    thead tr { background: #0F1E35; }
    thead th { padding: 8px 10px; text-align: left; color: #C4922E; font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #C4922E; }
    tbody tr { border-bottom: 1px solid #e8edf2; }
    tbody tr.alt { background: #F5F8FC; }
    td { padding: 7px 10px; color: #2a2a3e; }
    tfoot tr { background: #0F1E35; border-top: 2px solid #C4922E; }
    tfoot td { padding: 8px 10px; font-weight: 700; color: #C4922E; }
    td.tot-label { color: #C4922E; }
    td.tot-val { color: #C4922E; }

    /* ── Footer ── */
    .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #C4922E; display: flex; justify-content: space-between; font-size: 9px; color: #888; }
    .footer strong { color: #C4922E; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <span class="brand-v3">V3</span>
      <span class="brand-name">PARTNERS</span>
    </div>
    <div class="header-right">
      <div class="report-title">${titulo}</div>
      ${sub ? `<div class="report-sub">${sub}</div>` : ""}
      <div class="gen-date">Gerado em: ${agora}</div>
    </div>
  </div>

  <table>
    <thead><tr>${thead}</tr></thead>
    <tbody>${tbody}</tbody>
    ${tfoot}
  </table>

  <div class="footer">
    <span><strong>V3 Partners</strong> — Documento Confidencial</span>
    <span>${opts.titulo} · ${opts.mes ?? agora}</span>
  </div>

  <div class="no-print" style="margin-top:24px; text-align:center;">
    <button onclick="window.print()" style="background:#C4922E;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">
      🖨️ Imprimir / Salvar como PDF
    </button>
    <p style="margin-top:8px;font-size:11px;color:#888;">No diálogo de impressão, selecione <strong>"Salvar como PDF"</strong> como destino.</p>
  </div>

  <script>
    // Auto-print after small delay so styles load
    setTimeout(() => window.print(), 600);
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    // Fallback: download HTML file
    const a = document.createElement("a");
    a.href = url;
    a.download = `V3Partners_${opts.titulo.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.html`;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ─── Excel via SheetJS ────────────────────────────────────────────────────────

export async function exportExcel(opts: ExportOptions): Promise<void> {
  const XLSX = await import("xlsx");

  const headerRows: unknown[][] = [
    ["V3 PARTNERS", "", "", "", ""],
    [opts.titulo, "", "", "", ""],
    [opts.mes ?? "", "", "", "", `Gerado em: ${new Date().toLocaleString("pt-BR")}`],
    [],
    opts.colunas.map(c => c.header),
  ];

  const dataRows = opts.dados.map(row =>
    opts.colunas.map(c => {
      const v = row[c.key];
      if (v === null || v === undefined) return "";
      if (c.format === "moeda" || c.format === "percent") return isNaN(Number(v)) ? v : Number(v);
      if (c.format === "date") {
        try { return new Date(String(v) + "T00:00:00").toLocaleDateString("pt-BR"); }
        catch { return String(v); }
      }
      return v;
    })
  );

  const totRow = opts.totais
    ? opts.colunas.map(c => {
        if (c.key === Object.keys(opts.totais!.valores)[0]) return opts.totais!.label;
        const v = opts.totais!.valores[c.key];
        return v !== undefined ? (isNaN(Number(v)) ? v : Number(v)) : "";
      })
    : null;

  const allRows: unknown[][] = [...headerRows, ...dataRows, ...(totRow ? [totRow] : [])];
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  ws["!cols"] = opts.colunas.map(c => ({ wch: c.width ?? 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.titulo.substring(0, 31));
  XLSX.writeFile(wb, `V3Partners_${opts.titulo.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`);
}
