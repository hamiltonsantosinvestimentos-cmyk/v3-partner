// Whitelist do bucket credit-documents (supabase-storage-setup.sql)
export const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
const ALLOWED_MIME_TYPES = new Set(Object.values(EXT_TO_MIME));

// O MIME type que o navegador reporta (file.type) é pouco confiável — muitos
// dispositivos mandam "application/octet-stream" para PDFs/imagens válidos.
// Por isso resolvemos o content-type pela extensão do arquivo, que é estável.
export function resolveContentType(fileName: string, browserType: string): string | null {
  if (ALLOWED_MIME_TYPES.has(browserType)) return browserType;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? null;
}
