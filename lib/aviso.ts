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

// Confirmacao assincrona (substitui o confirm() nativo). Uso: if (!(await confirmar("..."))) return;
// Abre um modal V3 que so fecha pelos botoes Cancelar ou Confirmar (nunca clicando fora).
// Sem o <Toaster /> montado nao ha quem responda: resolve false por seguranca (nao executa a acao).
export const CONFIRMAR_EVENT = "v3:confirmar";

export type ConfirmarDetail = { message: string; resolve: (ok: boolean) => void };

export function confirmar(message: unknown): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!(window as unknown as { __v3ConfirmHost?: boolean }).__v3ConfirmHost) return Promise.resolve(false);
  const text = typeof message === "string" ? message : String(message ?? "");
  return new Promise<boolean>((resolve) => {
    window.dispatchEvent(new CustomEvent<ConfirmarDetail>(CONFIRMAR_EVENT, { detail: { message: text, resolve } }));
  });
}
