// Anexo do chat de equipe (BRIEF 01/11/2026): o banco guarda só o caminho do arquivo no bucket privado
// team-chat-attachments, nunca endereço público. A leitura passa por /api/team-chat/anexo (sessão, sala, log, link de 60 s).

export const BUCKET_ANEXO_CHAT = "team-chat-attachments";

export const EXTENSOES_ANEXO = ["jpg", "png", "gif", "webp", "pdf", "doc", "docx", "xls", "xlsx", "txt"] as const;

export const TIPOS_ANEXO = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

// <room_id>/<uuid>.<ext>, com room_id em slug (socios, mesa_ma, ...)
const CAMINHO_RE = new RegExp(
  `^([a-z0-9_-]{1,40})/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${EXTENSOES_ANEXO.join("|")})$`,
);

/** Devolve o room_id do caminho, ou null se o caminho não tiver o formato gravado pelo upload. */
export function salaDoCaminhoAnexo(path: unknown): string | null {
  if (typeof path !== "string" || path.includes("..")) return null;
  const m = CAMINHO_RE.exec(path);
  return m ? m[1] : null;
}

/** Nome exibido na bolha: sem caracteres de controle, até 200 caracteres. */
export function nomeAnexoValido(nome: unknown): nome is string {
  return typeof nome === "string" && nome.length > 0 && nome.length <= 200 && !/[\u0000-\u001f\u007f]/.test(nome);
}

// Imagem e PDF abrem na própria aba; os demais saem como download (Content-Disposition attachment).
export const EXTENSOES_DOWNLOAD = new Set(["doc", "docx", "xls", "xlsx", "txt"]);
