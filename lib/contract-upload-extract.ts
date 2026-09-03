// Extração de texto compartilhada entre /api/contracts/templates/upload
// (upload manual de minuta pronta) e /api/contracts/templates/analyze-upload
// (Fast-Track, 30/08/2026: upload de contrato recebido para o Agente
// Revisor de Riscos analisar). Extraída de templates/upload/route.ts para
// não duplicar a mesma lógica em dois lugares.
//
// P0 real, achado ao testar com o Dr. Athaydes em produção (02/09/2026):
// as duas rotas 500avam (página de erro genérica, nem chegava a JSON) para
// QUALQUER arquivo, inclusive .txt puro que nunca toca mammoth/pdf-parse.
// Causa: os dois eram import estático no topo do módulo -- uma exceção no
// carregamento de qualquer um dos dois (cold start da function na Vercel)
// derruba o módulo inteiro antes de qualquer linha de código rodar, mesmo
// pro caminho .txt que não precisa de nenhum dos dois. Import dinâmico
// agora, só quando o arquivo realmente exige a lib.
export async function extractContractText(buffer: Buffer, mimeType: string, fileName: string): Promise<string> {
  if (mimeType === "text/plain" || fileName.endsWith(".txt")) {
    return buffer.toString("utf-8");
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.endsWith(".docx")
  ) {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
    // P0 real, achado ao vivo com João e Dr. Athaydes testando o Fast-Track
    // em produção (03/09/2026): "DOMMatrix is not defined". pdf-parse v2
    // usa pdfjs-dist + @napi-rs/canvas por baixo, que dependem do worker
    // deles ser carregado ANTES de PDFParse ser instanciado em ambiente
    // Node/serverless (confirmado na doc oficial do pacote antes de codar,
    // via pdf-parse/docs/troubleshooting.md). Sem isso, pdfjs-dist tenta
    // usar DOMMatrix do browser, que não existe no runtime da Vercel.
    // Companheiro deste fix: next.config.ts precisa listar "pdf-parse" e
    // "@napi-rs/canvas" em serverExternalPackages, senão o binário nativo
    // do canvas nem chega a ser incluído no bundle serverless.
    await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    return textResult.text;
  }

  throw new Error(`Formato não suportado: ${mimeType}`);
}
