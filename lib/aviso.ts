// Aviso discreto do portal (substitui o alert() nativo, que bloqueia o navegador e trava
// automacao e testes). Uso: aviso("mensagem"). O <Toaster /> (components/shared/toaster.tsx),
// montado no layout raiz, escuta o evento e mostra o aviso por alguns segundos.
// (Nao confundir com lib/notify.ts, que envia notificacoes in-app e push no servidor.)

export const AVISO_EVENT = "v3:aviso";

export type AvisoDetail = { message: string };

export function aviso(message: unknown): void {
  if (typeof window === "undefined") return;
  const text = typeof message === "string" ? message : String(message ?? "");
  if (!text.trim()) return;
  window.dispatchEvent(new CustomEvent<AvisoDetail>(AVISO_EVENT, { detail: { message: text } }));
}
