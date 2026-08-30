import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

// Extração de texto compartilhada entre /api/contracts/templates/upload
// (upload manual de minuta pronta) e /api/contracts/templates/analyze-upload
// (Fast-Track, 30/08/2026: upload de contrato recebido para o Agente
// Revisor de Riscos analisar). Extraída de templates/upload/route.ts para
// não duplicar a mesma lógica em dois lugares.
export async function extractContractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    return textResult.text;
  }

  throw new Error(`Formato não suportado: ${mimeType}`);
}
