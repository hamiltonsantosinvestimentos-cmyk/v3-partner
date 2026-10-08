"use client";

// Mostra os avisos disparados por aviso() (lib/aviso.ts). Nao bloqueia a tela, some sozinho
// em 7 segundos e pode ser fechado no X. Paleta V4.2 (navy, ouro, creme).

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AVISO_EVENT, type AvisoDetail } from "@/lib/aviso";

type Toast = { id: number; message: string; isError: boolean };

const ERROR_HINT = /erro|falh|não foi possível|nao foi possivel|inválid|invalid|negad|sem permiss|não autorizado/i;
const DURATION_MS = 7000;
const MAX_VISIBLE = 4;

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

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

  if (toasts.length === 0) return null;

  return (
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
  );
}
