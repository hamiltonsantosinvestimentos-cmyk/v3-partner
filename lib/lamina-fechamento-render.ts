/**
 * Renderiza a Lamina de Fechamento segregada por lado (Sell-Side / Buy-Side)
 * da Calculadora Rapida.
 *
 * Fase 2 (06/08/2026): decisao de Joao (protocolo BRIEF, ver session-decisions.md
 * 2026-08-06): cada lado imprime seu PROPRIO PDF, nunca um combinado, pra nao
 * gerar conflito entre as partes (o Mandatario/Titular Compra nunca ve a
 * economia do lado Venda, e vice-versa). O botao/export combinado da Fase 1
 * e a versao PNG saem nesta revisao.
 *
 * Decisao de padrao mantida da Fase 1: NAO usa html2canvas para capturar o
 * DOM. Desenha com jsPDF puro (setFillColor/rect/text), mesmo padrao dos
 * outros dois geradores de PDF do repo (nova-proposta-modal.tsx,
 * portfolio-viewer.tsx), evita o risco real do html2canvas quebrar em
 * `oklch()`/funcoes de cor modernas do Tailwind v4 usado neste projeto.
 */

import type { CommissionCalculatorResult, SideBreakdown } from "./commission-calculator";

export type LaminaSide = "buy" | "sell";

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

const SIDE_LABEL: Record<LaminaSide, string> = { buy: "BUY-SIDE (COMPRA)", sell: "SELL-SIDE (VENDA)" };

const FPA_NOTE =
  "O montante do Grupo de Intermediários será rateado internamente conforme percentuais e chaves PIX " +
  "cadastrados no respectivo Acordo Irrevogável de Proteção de Honorários (FPA) vinculado a este Deal.";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function buildRows(resultado: CommissionCalculatorResult, side: LaminaSide) {
  const breakdown: SideBreakdown = side === "buy" ? resultado.buy_side : resultado.sell_side;
  const rows: { label: string; pct: string; bruto: string; liquido: string }[] = [
    {
      label: "Valor de Face",
      pct: "",
      bruto: formatBRL(resultado.operacao.valor_face),
      liquido: "",
    },
    {
      label: "Deságio",
      pct: `${resultado.operacao.desagio_pct}%`,
      bruto: formatBRL(resultado.operacao.valor_comprador),
      liquido: "",
    },
    {
      label: "Taxa de Estruturação V3",
      pct: `${breakdown.v3_share.pct_of_total}%`,
      bruto: formatBRL(breakdown.v3_share.bruto),
      liquido: formatBRL(breakdown.v3_share.liquido),
    },
    {
      label: "Mandatário / Titular",
      pct: `${breakdown.mandatario.pct_of_total}%`,
      bruto: formatBRL(breakdown.mandatario.bruto),
      liquido: formatBRL(breakdown.mandatario.liquido),
    },
    {
      label: "Grupo de Intermediários",
      pct: `${breakdown.intermediarios.pct_of_total}%`,
      bruto: formatBRL(breakdown.intermediarios.bruto),
      liquido: formatBRL(breakdown.intermediarios.liquido),
    },
  ];
  if (resultado.recorrencia.is_recorrente) {
    const acumulado = side === "buy" ? resultado.recorrencia.buy_side_acumulado_liquido : resultado.recorrencia.sell_side_acumulado_liquido;
    rows.push({
      label: `Acumulado do Lado (${resultado.recorrencia.meses_recorrencia}m, líquido)`,
      pct: "",
      bruto: "",
      liquido: formatBRL(acumulado),
    });
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

export async function renderLaminaSidePDF(resultado: CommissionCalculatorResult, side: LaminaSide, meta: LaminaMeta) {
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
  doc.text(`LÂMINA DE FECHAMENTO · ${SIDE_LABEL[side]}`, titleX, 18);
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

  // Cabecalho de colunas
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GOLD_LIGHT);
  doc.text("PAPEL / PARTICIPANTE", M + 4, y);
  doc.text("% ALOCADO", W - M - 78, y, { align: "right" });
  doc.text("VALOR BRUTO (R$)", W - M - 42, y, { align: "right" });
  doc.text("VALOR LÍQUIDO (R$)", W - M - 4, y, { align: "right" });
  y += 6;

  const rows = buildRows(resultado, side);
  const rowH = 12;
  for (const row of rows) {
    doc.setFillColor(...CARD);
    doc.roundedRect(M, y - 6, W - M * 2, rowH - 2, 1.5, 1.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...CREAM);
    doc.text(row.label, M + 4, y);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    if (row.pct) doc.text(row.pct, W - M - 78, y, { align: "right" });
    doc.setTextColor(...CREAM);
    if (row.bruto) doc.text(row.bruto, W - M - 42, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...GOLD);
    if (row.liquido) doc.text(row.liquido, W - M - 4, y, { align: "right" });
    y += rowH;
    if (y > 265) { doc.addPage(); doc.setFillColor(...NAVY_BODY); doc.rect(0, 0, W, 297, "F"); y = 20; }
  }

  y += 6;
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
  doc.text(
    "Simulação interna, Mesa de Capitais V3 Partners. Não constitui proposta vinculante. " +
      `Documento restrito ao ${side === "buy" ? "lado Compra" : "lado Venda"} desta operação.`,
    M,
    290
  );

  const sideSlug = side === "buy" ? "BuySide" : "SellSide";
  doc.save(`Lamina-Fechamento-${sideSlug}-${(meta.dealLabel || "simulacao").replace(/[^\w-]+/g, "_")}.pdf`);
}
