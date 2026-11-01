// Aviso discreto do portal (substitui o alert() nativo, que bloqueia o navegador e trava
// automacao e testes). Uso: aviso("mensagem"). O <Toaster /> (components/shared/toaster.tsx),
// montado no layout raiz, escuta o evento e mostra o aviso por alguns segundos.
// (Nao confundir com lib/notify.ts, que envia notificacoes in-app e push no servidor.)

import type { NotaId } from "@/lib/notas-do-porque";

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

// Pedido de motivo (BRIEF Mesa M&A G1, 01/11/2026): substitui o window.prompt() que pede texto obrigatório.
// Uso: const motivo = await pedirMotivo({ titulo, mensagem, botao, perigo: true, nota: "..." }); if (!motivo) return;
// Abre um modal V3 (hospedado pelo <Toaster />) com campo de texto, contador e botão desabilitado até o texto valer
// (mínimo 5 e máximo 500 caracteres, lib/motivo.ts). Só fecha por "Cancelar" ou pelo botão de ação; clique fora e a tecla
// Esc não fecham. Sem o <Toaster /> montado devolve null (a ação não é executada).
export const PEDIR_MOTIVO_EVENT = "v3:pedir-motivo";

export type PedirMotivoOpcoes = {
  titulo: string;
  mensagem: string;
  /** Rótulo do botão de ação (padrão "Confirmar"). */
  botao?: string;
  minimo?: number;
  maximo?: number;
  /** Modal vermelho, para ação destrutiva. */
  perigo?: boolean;
  /** Nota do porquê (lib/notas-do-porque.ts) exibida junto ao título. */
  nota?: NotaId;
};

export type PedirMotivoDetail = PedirMotivoOpcoes & { resolve: (motivo: string | null) => void };

export function pedirMotivo(opcoes: PedirMotivoOpcoes): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!(window as unknown as { __v3ConfirmHost?: boolean }).__v3ConfirmHost) return Promise.resolve(null);
  return new Promise<string | null>((resolve) => {
    window.dispatchEvent(new CustomEvent<PedirMotivoDetail>(PEDIR_MOTIVO_EVENT, { detail: { ...opcoes, resolve } }));
  });
}
