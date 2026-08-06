/**
 * Renderiza a Lamina de Fechamento (PDF + PNG) da Calculadora Rapida.
 *
 * Decisao de padrao: NAO usa html2canvas para capturar o DOM. O repo ja tem
 * duas outras laminas (nova-proposta-modal.tsx, portfolio-viewer.tsx) e as
 * duas desenham com jsPDF puro (setFillColor/rect/text), e este arquivo
 * segue o mesmo padrao aqui por dois motivos: (1) consistencia com o que ja
 * existe, e (2) html2canvas historicamente quebra em `oklch()`/funcoes de
 * cor modernas do Tailwind v4 (usado neste projeto), que o parser de CSS
 * dele nao entende. E risco real, nao hipotetico, evitado desenhando com
 * cor RGB literal.
 * A versao PNG reusa a mesma logica de layout num <canvas> 2D puro.
 */

import type { CommissionCalculatorResult } from "./commission-calculator";

interface LaminaMeta {
  dealLabel: string;
  simId: string | null;
  dataSimulacao: Date;
}

const NAVY: [number, number, number] = [9, 8, 26];
const NAVY_BODY: [number, number, number] = [10, 22, 40];
const GOLD: [number, number, number] = [201, 168, 76];
const GOLD_LIGHT: [number, number, number] = [232, 201, 122];
const CREAM: [number, number, number] = [245, 241, 232];
const MUTED: [number, number, number] = [155, 175, 197];
const CARD: [number, number, number] = [22, 39, 68];

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildRows(resultado: CommissionCalculatorResult) {
  const rows: { label: string; value: string; sub?: string }[] = [
    { label: "Valor de Face", value: formatBRL(resultado.operacao.valor_face) },
    { label: "Deságio", value: `${resultado.operacao.desagio_pct}%` },
    { label: "Preço do Comprador", value: formatBRL(resultado.operacao.valor_comprador) },
    { label: "Fee Total", value: `${resultado.split.fee_total_pct}% · ${formatBRL(resultado.split.fee_total_value)}` },
    { label: "Grupo Compra (líquido)", value: formatBRL(resultado.split.grupo_compra.liquido), sub: `${resultado.split.grupo_compra.pct}% do fee` },
    { label: "Grupo Venda (líquido)", value: formatBRL(resultado.split.grupo_venda.liquido), sub: `${resultado.split.grupo_venda.pct}% do fee` },
    { label: "V3 Partners (líquido)", value: formatBRL(resultado.split.v3_partners.liquido), sub: `${resultado.split.v3_partners.pct}% do fee` },
    { label: "Dedução Bancária", value: `${resultado.split.deducao_bancaria_pct}%` },
  ];
  if (resultado.recorrencia.is_recorrente) {
    rows.push(
      { label: `Volume Total Acumulado (${resultado.recorrencia.meses_recorrencia}m)`, value: formatBRL(resultado.recorrencia.volume_total_acumulado) },
      { label: "Fee Total Acumulado", value: formatBRL(resultado.recorrencia.fee_total_acumulado) },
      { label: "Grupo Compra Acum. (líq.)", value: formatBRL(resultado.recorrencia.grupo_compra_acumulado_liquido) },
      { label: "Grupo Venda Acum. (líq.)", value: formatBRL(resultado.recorrencia.grupo_venda_acumulado_liquido) },
    );
  }
  return rows;
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch("/logo.jpg");
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function renderLaminaPDF(resultado: CommissionCalculatorResult, meta: LaminaMeta) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const M = 16;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 42, "F");

  const logo = await loadLogoBase64();
  if (logo) {
    try { doc.addImage(logo, "JPEG", M, 7, 24, 24); } catch { /* logo opcional */ }
  }

  const titleX = logo ? M + 30 : M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...CREAM);
  doc.text("LÂMINA DE FECHAMENTO", titleX, 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text("CALCULADORA RÁPIDA DE COMISSIONAMENTO · MESA DE CAPITAIS", titleX, 25);
  doc.setTextColor(...MUTED);
  doc.setFontSize(7);
  doc.text("V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br", titleX, 32);

  doc.setFillColor(...GOLD);
  doc.rect(0, 42, W, 0.6, "F");

  doc.setFillColor(...NAVY_BODY);
  doc.rect(0, 42.6, W, 254.4, "F");

  let y = 54;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GOLD_LIGHT);
  doc.text(meta.dealLabel || "Simulação sem identificação", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `Data da simulação: ${meta.dataSimulacao.toLocaleString("pt-BR")}${meta.simId ? `  ·  ID: ${meta.simId}` : ""}`,
    M,
    y + 6
  );
  y += 16;

  const rows = buildRows(resultado);
  const rowH = 12;
  for (const row of rows) {
    doc.setFillColor(...CARD);
    doc.roundedRect(M, y - 6, W - M * 2, rowH - 2, 1.5, 1.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(row.label, M + 4, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...CREAM);
    doc.text(row.value, W - M - 4, y, { align: "right" });
    if (row.sub) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...GOLD_LIGHT);
      doc.text(row.sub, W - M - 4, y + 4, { align: "right" });
    }
    y += rowH;
    if (y > 285) { doc.addPage(); doc.setFillColor(...NAVY_BODY); doc.rect(0, 0, W, 297, "F"); y = 20; }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text(
    "Simulação interna, Mesa de Capitais V3 Partners. Não constitui proposta vinculante.",
    M,
    290
  );

  doc.save(`Lamina-Fechamento-${(meta.dealLabel || "simulacao").replace(/[^\w-]+/g, "_")}.pdf`);
}

export async function renderLaminaPNG(resultado: CommissionCalculatorResult, meta: LaminaMeta) {
  const rows = buildRows(resultado);
  const W = 900;
  const rowH = 64;
  const headerH = 140;
  const footerH = 40;
  const H = headerH + rows.length * rowH + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;

  // fundo
  ctx.fillStyle = rgb(NAVY_BODY);
  ctx.fillRect(0, 0, W, H);

  // header navy
  ctx.fillStyle = rgb(NAVY);
  ctx.fillRect(0, 0, W, headerH - 6);
  ctx.fillStyle = rgb(GOLD);
  ctx.fillRect(0, headerH - 6, W, 3);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = rgb(CREAM);
  ctx.font = "bold 26px Arial, sans-serif";
  ctx.fillText("LÂMINA DE FECHAMENTO", 32, 46);
  ctx.fillStyle = rgb(GOLD);
  ctx.font = "bold 13px Arial, sans-serif";
  ctx.fillText("CALCULADORA RÁPIDA DE COMISSIONAMENTO · MESA DE CAPITAIS", 32, 68);
  ctx.fillStyle = rgb(MUTED);
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText("V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br", 32, 86);

  ctx.fillStyle = rgb(GOLD_LIGHT);
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.fillText(meta.dealLabel || "Simulação sem identificação", 32, headerH + 4);
  ctx.fillStyle = rgb(MUTED);
  ctx.font = "12px Arial, sans-serif";
  ctx.fillText(
    `Data da simulação: ${meta.dataSimulacao.toLocaleString("pt-BR")}${meta.simId ? `  ·  ID: ${meta.simId}` : ""}`,
    32,
    headerH + 24
  );

  let y = headerH + 44;
  for (const row of rows) {
    ctx.fillStyle = rgb(CARD);
    roundRect(ctx, 24, y, W - 48, rowH - 10, 8);
    ctx.fill();

    ctx.fillStyle = rgb(MUTED);
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText(row.label, 44, y + 32);

    ctx.fillStyle = rgb(CREAM);
    ctx.font = "bold 16px Arial, sans-serif";
    const valW = ctx.measureText(row.value).width;
    ctx.fillText(row.value, W - 44 - valW, y + 32);

    if (row.sub) {
      ctx.fillStyle = rgb(GOLD_LIGHT);
      ctx.font = "11px Arial, sans-serif";
      const subW = ctx.measureText(row.sub).width;
      ctx.fillText(row.sub, W - 44 - subW, y + 48);
    }
    y += rowH;
  }

  ctx.fillStyle = rgb(MUTED);
  ctx.font = "11px Arial, sans-serif";
  ctx.fillText("Simulação interna, Mesa de Capitais V3 Partners. Não constitui proposta vinculante.", 32, H - 16);

  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `Lamina-Fechamento-${(meta.dealLabel || "simulacao").replace(/[^\w-]+/g, "_")}.png`;
  a.click();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
