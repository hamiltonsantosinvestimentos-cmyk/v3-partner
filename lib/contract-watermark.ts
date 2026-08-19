// Estampilha digital + fusão de PDF para regularização de contratos
// manuais (19/08/2026, item 4 dos ajustes de governança pedidos por João).
//
// Fluxo: capa (Termo de Ratificação e Vinculação Comercial, renderizado a
// partir de contract_templates via htmlToPdfBase64) + PDF original do
// contrato manual são mesclados num único PDF final, e TODAS as páginas
// (capa + original) recebem uma faixa de rodapé com o código V3C-REG, a
// data de revalidação e a justificativa operacional, mesmo princípio de
// "estampilha" (selo/carimbo de registro), não um watermark diagonal que
// obscureceria o texto original.
//
// pdf-lib importado dinamicamente com webpackIgnore, mesmo padrão já usado
// em app/api/ma/cim-pdf/route.ts (evita problema de bundling serverless).

export interface StampParams {
  code: string;
  date: string; // já formatado, ex: "19/08/2026"
  justification: string;
}

export interface MergeAndStampResult {
  pdfBytes: Uint8Array;
}

const MAX_JUSTIFICATION_CHARS = 140;

export async function mergeAndStampManualContract(
  coverPdfBytes: Uint8Array,
  originalPdfBytes: Uint8Array,
  stamp: StampParams
): Promise<MergeAndStampResult> {
  const pdfLibPkg = "pdf-lib";
  const { PDFDocument, StandardFonts, rgb } = await import(/* webpackIgnore: true */ pdfLibPkg);

  const finalDoc = await PDFDocument.create();
  const coverDoc = await PDFDocument.load(coverPdfBytes);
  const originalDoc = await PDFDocument.load(originalPdfBytes);

  const coverIndices = Array.from({ length: coverDoc.getPageCount() }, (_, i) => i);
  const coverPages = await finalDoc.copyPages(coverDoc, coverIndices);
  coverPages.forEach((p: import("pdf-lib").PDFPage) => finalDoc.addPage(p));

  const originalIndices = Array.from({ length: originalDoc.getPageCount() }, (_, i) => i);
  const originalPages = await finalDoc.copyPages(originalDoc, originalIndices);
  originalPages.forEach((p: import("pdf-lib").PDFPage) => finalDoc.addPage(p));

  const font = await finalDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await finalDoc.embedFont(StandardFonts.Helvetica);

  const truncatedJustification =
    stamp.justification.length > MAX_JUSTIFICATION_CHARS
      ? `${stamp.justification.slice(0, MAX_JUSTIFICATION_CHARS - 1)}…`
      : stamp.justification;

  const navy = rgb(0x09 / 255, 0x08 / 255, 0x1a / 255);
  const gold = rgb(0xc9 / 255, 0xa8 / 255, 0x4c / 255);
  const cream = rgb(0xf5 / 255, 0xf1 / 255, 0xe8 / 255);

  const pages = finalDoc.getPages();
  for (const page of pages) {
    const { width } = page.getSize();
    const bandHeight = 26;

    page.drawRectangle({ x: 0, y: 0, width, height: bandHeight, color: navy, opacity: 0.92 });
    page.drawLine({
      start: { x: 0, y: bandHeight },
      end: { x: width, y: bandHeight },
      thickness: 1.2,
      color: gold,
      opacity: 0.6,
    });

    page.drawText(`${stamp.code} · REGULARIZADO EM ${stamp.date}`, {
      x: 12,
      y: 9,
      size: 7.5,
      font,
      color: gold,
    });

    const justificationText = `Justificativa: ${truncatedJustification}`;
    const justWidth = fontRegular.widthOfTextAtSize(justificationText, 6.5);
    page.drawText(justificationText, {
      x: Math.max(12, width - justWidth - 12),
      y: 9,
      size: 6.5,
      font: fontRegular,
      color: cream,
      opacity: 0.85,
    });
  }

  finalDoc.setTitle(`Regularização ${stamp.code} · V3 Partners`);
  finalDoc.setAuthor("V3 Partners Soluções Ltda");
  finalDoc.setSubject("Termo de Ratificação e Vinculação Comercial");
  finalDoc.setKeywords(["V3 Partners", "Regularização", stamp.code]);
  finalDoc.setCreationDate(new Date());

  const pdfBytes = await finalDoc.save();
  return { pdfBytes };
}
