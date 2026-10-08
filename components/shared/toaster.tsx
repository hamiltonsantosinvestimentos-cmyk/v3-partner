"use client";

// Host dos avisos (aviso()) e das confirmacoes (confirmar()) do portal, ver lib/aviso.ts.
// Avisos: nao bloqueiam a tela, somem sozinhos em 7 segundos e podem ser fechados no X.
// Confirmacoes: modal V3 que so fecha pelos botoes (Escape cancela), nunca clicando fora.
// Paleta V4.2 (navy, ouro, creme).

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AVISO_EVENT, CONFIRMAR_EVENT, type AvisoDetail, type ConfirmarDetail } from "@/lib/aviso";

type Toast = { id: number; message: string; isError: boolean };
type HostWindow = Window & { __v3ConfirmHost?: boolean };

const ERROR_HINT = /erro|falh|não foi possível|nao foi possivel|inválid|invalid|negad|sem permiss|não autorizado/i;
const DURATION_MS = 7000;
const MAX_VISIBLE = 4;

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [fila, setFila] = useState<ConfirmarDetail[]>([]);

  useEffect(() => {
    let seq = 0;
    const onAviso = (e: Event) => {
      const { message } = (e as CustomEvent<AvisoDetail>).detail;
      const id = ++seq + Date.now();
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { id, message, isError: ERROR_HINT.test(message) }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), DURATION_MS);
    };
    window.addEventListener(AVISO_EVENT, onAviso);
    return () => window.removeEventListener(AVISO_EVENT, onAviso);
  }, []);

  // Enquanto montado, confirmar() abre o modal. Sem host, confirmar() resolve false (nao executa a acao).
  useEffect(() => {
    (window as HostWindow).__v3ConfirmHost = true;
    const onConfirmar = (e: Event) => setFila((prev) => [...prev, (e as CustomEvent<ConfirmarDetail>).detail]);
    window.addEventListener(CONFIRMAR_EVENT, onConfirmar);
    return () => {
      window.removeEventListener(CONFIRMAR_EVENT, onConfirmar);
      (window as HostWindow).__v3ConfirmHost = false;
    };
  }, []);

  const atual = fila[0] ?? null;

  const responder = (ok: boolean) => {
    if (!atual) return;
    atual.resolve(ok);
    setFila((prev) => prev.slice(1));
  };

  useEffect(() => {
    if (!atual) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        atual.resolve(false);
        setFila((prev) => prev.slice(1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [atual]);

  return (
    <>
      {atual && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/75 p-4">
          <div role="dialog" aria-modal="true" aria-label="Confirmação" className="w-full max-w-md space-y-3 rounded-xl border border-[#C9A84C]/40 bg-[#09081A] p-4">
            <p className="whitespace-pre-line text-[13px] leading-snug text-[#F5F1E8]">{atual.message}</p>
            <div className="flex justify-end gap-2">
              <button type="button" autoFocus onClick={() => responder(false)} className="rounded border border-[#9BAFC5]/30 px-3 py-1.5 text-[12px] font-semibold text-[#F5F1E8]">
                Cancelar
              </button>
              <button type="button" onClick={() => responder(true)} className="rounded bg-[#C9A84C] px-3 py-1.5 text-[12px] font-semibold text-[#09081A]">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[200] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
          {toasts.map((t) => (
            <div
              key={t.id}
              role={t.isError ? "alert" : "status"}
              className={`flex items-start gap-2 rounded-lg border bg-[#09081A] px-3 py-2.5 shadow-lg ${t.isError ? "border-[#E24B4A]/60" : "border-[#C9A84C]/50"}`}
            >
              <p className="flex-1 text-[12px] leading-snug text-[#F5F1E8]">{t.message}</p>
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                aria-label="Fechar aviso"
                className="text-[#9BAFC5] hover:text-[#F5F1E8]"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
