/**
 * Renderiza a Lamina de Fechamento da Calculadora Rapida (Fase 3).
 *
 * 3 variantes: "buy" e "sell" (cada lado ve so os proprios numeros, nunca a
 * economia do outro lado, decisao de Joao pra nao gerar conflito entre as
 * partes) e "consolidado" (uso interno da Mesa V3, mostra os dois lados
 * juntos, marcado com cadeado na UI e no proprio PDF).
 *
 * Decisao de padrao mantida desde a Fase 1: NAO usa html2canvas para
 * capturar o DOM. Desenha com jsPDF puro (setFillColor/rect/text), mesmo
 * padrao dos outros dois geradores de PDF do repo (nova-proposta-modal.tsx,
 * portfolio-viewer.tsx), evita o risco real do html2canvas quebrar em
 * `oklch()`/funcoes de cor modernas do Tailwind v4 usado neste projeto.
 */

import type { CommissionCalculatorResult, SideBreakdown } from "./commission-calculator";

export type LaminaVariante = "buy" | "sell" | "consolidado";

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
const RED: [number, number, number] = [220, 90, 90];

const VARIANTE_LABEL: Record<LaminaVariante, string> = {
  buy: "BUY-SIDE (COMPRA)",
  sell: "SELL-SIDE (VENDA)",
  consolidado: "VISÃO CONSOLIDADA · USO INTERNO MESA V3",
};

const FPA_NOTE =
  "O valor atribuído ao Grupo de Intermediários será distribuído internamente conforme percentuais e dados " +
  "bancários estabelecidos no respectivo Acordo Irrevogável de Proteção de Honorários (FPA) vinculado ao Deal.";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildSideRows(breakdown: SideBreakdown) {
  return [
    { label: "Taxa de Estruturação V3", pct: `${breakdown.v3.pct_of_side}% do lado`, bruto: breakdown.v3.bruto, liquido: breakdown.v3.liquido },
    { label: "Mandatário / Titular", pct: `${breakdown.mandatario.pct_of_side}% do lado`, bruto: breakdown.mandatario.bruto, liquido: breakdown.mandatario.liquido },
    { label: "Grupo de Intermediários", pct: `${breakdown.intermediarios.pct_of_side}% do lado`, bruto: breakdown.intermediarios.bruto, liquido: breakdown.intermediarios.liquido },
  ];
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

export async function renderLaminaPDF(resultado: CommissionCalculatorResult, variante: LaminaVariante, meta: LaminaMeta) {
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
  doc.text(`LÂMINA DE FECHAMENTO · ${VARIANTE_LABEL[variante]}`, titleX, 18);
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
  y += 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Valor de Face: ${formatBRL(resultado.operacao.valor_face)}  ·  Deságio: ${resultado.operacao.desagio_pct}%  ·  Preço do Comprador: ${formatBRL(resultado.operacao.valor_comprador)}`, M, y);
  y += 10;

  function drawSideTable(label: string, breakdown: SideBreakdown) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...GOLD);
    doc.text(label, M, y);
    y += 6;

    const rows = buildSideRows(breakdown);
    const rowH = 11;
    for (const row of rows) {
      const negativo = row.bruto < 0;
      doc.setFillColor(...CARD);
      doc.roundedRect(M, y - 5.5, W - M * 2, rowH - 2, 1.5, 1.5, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...(negativo ? RED : CREAM));
      doc.text(row.label, M + 4, y);
      doc.setFontSize(7);
      doc.setTextColor(...MUTED);
      doc.text(row.pct, W - M - 70, y, { align: "right" });
      doc.setFontSize(8.5);
      doc.setTextColor(...(negativo ? RED : CREAM));
      doc.text(formatBRL(row.bruto), W - M - 40, y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...(negativo ? RED : GOLD));
      doc.text(formatBRL(row.liquido), W - M - 4, y, { align: "right" });
      y += rowH;
      if (y > 265) { doc.addPage(); doc.setFillColor(...NAVY_BODY); doc.rect(0, 0, W, 297, "F"); y = 20; }
    }
    y += 4;
  }

  if (variante === "buy") drawSideTable("LADO COMPRA (BUY-SIDE)", resultado.buy_side);
  else if (variante === "sell") drawSideTable("LADO VENDA (SELL-SIDE)", resultado.sell_side);
  else {
    drawSideTable("LADO COMPRA (BUY-SIDE)", resultado.buy_side);
    drawSideTable("LADO VENDA (SELL-SIDE)", resultado.sell_side);
  }

  y += 2;
  doc.setFillColor(...GOLD);
  doc.rect(M, y - 4, W - M * 2, 0.4, "F");
  y += 6;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_LIGHT);
  const fpaLines = doc.splitTextToSize(FPA_NOTE, W - M * 2);
  doc.text(fpaLines, M, y);
  y += fpaLines.length * 4 + 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  const rodape =
    variante === "consolidado"
      ? "Documento de uso interno da Mesa V3. Nunca compartilhar com contraparte de nenhum dos lados."
      : `Simulação interna, Mesa de Capitais V3 Partners. Não constitui proposta vinculante. Documento restrito ao ${variante === "buy" ? "lado Compra" : "lado Venda"} desta operação.`;
  doc.text(rodape, M, 290);

  const sufixo = variante === "buy" ? "BuySide" : variante === "sell" ? "SellSide" : "Consolidado-MesaV3";
  doc.save(`Lamina-Fechamento-${sufixo}-${(meta.dealLabel || "simulacao").replace(/[^\w-]+/g, "_")}.pdf`);
}
