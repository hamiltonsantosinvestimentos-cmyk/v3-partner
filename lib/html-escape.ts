// Escape de texto livre antes de entrar em HTML de e-mail (BRIEF Mesa M&A G1, 01/11/2026).
// O motivo de exclusão, o nome de quem pediu e o rótulo do item entravam crus no corpo do e-mail de governança.

export function escapeHtml(valor: unknown): string {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
