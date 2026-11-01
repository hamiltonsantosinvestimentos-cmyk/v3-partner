"use client";

// Host dos avisos (aviso()) e das confirmacoes (confirmar()) do portal, ver lib/aviso.ts.
// Avisos: nao bloqueiam a tela, somem sozinhos em 7 segundos e podem ser fechados no X.
// Confirmacoes: modal V3 que so fecha pelos botoes (Escape cancela), nunca clicando fora.
// Paleta V4.2 (navy, ouro, creme).

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AVISO_EVENT, CONFIRMAR_EVENT, PEDIR_MOTIVO_EVENT, type AvisoDetail, type ConfirmarDetail, type PedirMotivoDetail } from "@/lib/aviso";
import { MOTIVO_MAX, MOTIVO_MIN, motivoValido } from "@/lib/motivo";
import { Dica } from "@/components/shared/dica";

type Toast = { id: number; message: string; isError: boolean };
type HostWindow = Window & { __v3ConfirmHost?: boolean };

const ERROR_HINT = /erro|falh|não foi possível|nao foi possivel|inválid|invalid|negad|sem permiss|não autorizado/i;
const DURATION_MS = 7000;
const MAX_VISIBLE = 4;

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [fila, setFila] = useState<ConfirmarDetail[]>([]);
  const [filaMotivo, setFilaMotivo] = useState<PedirMotivoDetail[]>([]);

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
    const onPedirMotivo = (e: Event) => setFilaMotivo((prev) => [...prev, (e as CustomEvent<PedirMotivoDetail>).detail]);
    window.addEventListener(CONFIRMAR_EVENT, onConfirmar);
    window.addEventListener(PEDIR_MOTIVO_EVENT, onPedirMotivo);
    return () => {
      window.removeEventListener(CONFIRMAR_EVENT, onConfirmar);
      window.removeEventListener(PEDIR_MOTIVO_EVENT, onPedirMotivo);
      (window as HostWindow).__v3ConfirmHost = false;
    };
  }, []);

  const atual = fila[0] ?? null;
  const motivoAtual = filaMotivo[0] ?? null;

  const responderMotivo = (motivo: string | null) => {
    if (!motivoAtual) return;
    motivoAtual.resolve(motivo);
    setFilaMotivo((prev) => prev.slice(1));
  };

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

  // pointer-events-auto no overlay de confirmação: dentro de um Dialog Radix modal o body fica com
  // pointer-events:none e o overlay (renderizado fora do Dialog) herdava o bloqueio; os botões apareciam
  // mas não recebiam clique (achado no teste da aba Originação, 18/10/2026; afetava também Clientes).
  return (
    <>
      {motivoAtual && <ModalMotivo detalhe={motivoAtual} onResponder={responderMotivo} />}
      {atual && (
        <div className="pointer-events-auto fixed inset-0 z-[210] flex items-center justify-center bg-black/75 p-4">
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

// Modal de motivo (pedirMotivo, lib/aviso.ts). Cuidados com o Dialog Radix que pode estar aberto por baixo (ex.: o card do
// deal na Mesa M&A): o overlay fica fora dele, então (1) pointer-events-auto no overlay, (2) os eventos de foco e de clique
// não sobem até o document, onde o Radix decide "interação fora" e fecharia o Dialog de baixo, e (3) Esc é capturado em
// fase de captura na window, antes do listener do Radix, e não faz nada (o modal só fecha pelos botões).
function ModalMotivo({ detalhe, onResponder }: { detalhe: PedirMotivoDetail; onResponder: (motivo: string | null) => void }) {
  const minimo = detalhe.minimo ?? MOTIVO_MIN;
  const maximo = detalhe.maximo ?? MOTIVO_MAX;
  const [texto, setTexto] = useState("");
  const campo = useRef<HTMLTextAreaElement>(null);
  const valido = motivoValido(texto, minimo, maximo);
  const perigo = !!detalhe.perigo;
  const tamanho = texto.trim().length;

  useEffect(() => {
    campo.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        if (valido) onResponder(valido);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [valido, onResponder]);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[220] flex items-center justify-center bg-black/75 p-4"
      onFocus={(e) => e.stopPropagation()}
      onBlur={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={detalhe.titulo}
        className={`w-full max-w-md space-y-3 rounded-xl border bg-[#09081A] p-4 ${perigo ? "border-[#E24B4A]/60" : "border-[#C9A84C]/40"}`}
      >
        <div className="flex items-center gap-2">
          <p className={`text-[14px] font-bold ${perigo ? "text-[#E24B4A]" : "text-[#C9A84C]"}`}>{detalhe.titulo}</p>
          {detalhe.nota && <Dica id={detalhe.nota} />}
        </div>
        <p className="whitespace-pre-line text-[13px] leading-snug text-[#F5F1E8]">{detalhe.mensagem}</p>
        <div>
          <textarea
            ref={campo}
            value={texto}
            onChange={(e) => setTexto(e.target.value.slice(0, maximo))}
            rows={4}
            maxLength={maximo}
            aria-label="Motivo"
            placeholder="Escreva o motivo"
            className="w-full resize-none rounded-lg border border-[#9BAFC5]/30 bg-[#13223A] px-3 py-2 text-[13px] text-[#F5F1E8] outline-none focus:border-[#C9A84C]/60"
          />
          <p className="mt-1 text-[12px] text-[#9BAFC5]">
            {tamanho < minimo ? `${tamanho} de ${minimo} caracteres no mínimo` : `${tamanho} de ${maximo} caracteres`}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onResponder(null)}
            className="rounded border border-[#9BAFC5]/30 px-3 py-1.5 text-[12px] font-semibold text-[#F5F1E8]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valido}
            onClick={() => valido && onResponder(valido)}
            className={`rounded px-3 py-1.5 text-[12px] font-semibold text-[#09081A] disabled:cursor-not-allowed disabled:opacity-40 ${perigo ? "bg-[#E24B4A]" : "bg-[#C9A84C]"}`}
          >
            {detalhe.botao ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  );
}
