"use client";

import React, { useState } from "react";

export const classeCampo = "w-full rounded-lg bg-[#111F35] border border-[#243A66] px-3 py-2 text-[13px] text-[#F0ECE4] placeholder:text-[#7A8FA8] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]";
export const classeRotulo = "block text-[9px] font-bold uppercase tracking-wider text-[#C9A84C] mb-1";
export const classeBotao = "rounded-lg bg-[#C9A84C] px-4 py-2 text-[13px] font-semibold text-[#09081A] hover:bg-[#E8C97A] disabled:opacity-50";
export const classeBotaoSecundario = "rounded-lg border border-[#243A66] px-3 py-1.5 text-[12px] text-[#F0ECE4] hover:bg-[#243A66] disabled:opacity-50";
export const classeBotaoPerigo = "rounded-lg border border-red-500/60 px-3 py-1.5 text-[12px] text-red-300 hover:bg-red-900/40 disabled:opacity-50";

export async function chamarApi<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init ? { ...init, headers: { "Content-Type": "application/json" } } : undefined);
  const data = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Não foi possível concluir. Tente novamente.");
  return data as T;
}

/** Modal de ação irreversível: só fecha pelos botões, nunca por clique fora ou Esc. */
export function ModalPerigo({ titulo, children, botao, confirmarTexto, onConfirmar, onCancelar }: {
  titulo: string;
  children: React.ReactNode;
  botao: string;
  /** Quando informado, o botão só libera depois de digitar este texto. */
  confirmarTexto?: string;
  onConfirmar: () => Promise<void>;
  onCancelar: () => void;
}) {
  const [digitado, setDigitado] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const liberado = !confirmarTexto || digitado === confirmarTexto;

  const confirmar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await onConfirmar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente.");
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#09081A]/80 p-4" role="alertdialog" aria-modal="true" aria-label={titulo}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-red-500/60 bg-[#162744] p-5">
        <h2 className="text-[18px] font-semibold text-red-300 mb-3">{titulo}</h2>
        <div className="space-y-2 text-[13px] text-[#F0ECE4]">{children}</div>
        {confirmarTexto && (
          <div className="mt-4">
            <label className={classeRotulo}>Digite {confirmarTexto} para confirmar</label>
            <input className={classeCampo} value={digitado} onChange={(e) => setDigitado(e.target.value)} autoComplete="off" />
          </div>
        )}
        {erro && <p className="mt-3 text-[12px] text-red-300" role="alert">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={classeBotaoSecundario} onClick={onCancelar} disabled={enviando}>Cancelar</button>
          <button type="button" onClick={confirmar} disabled={!liberado || enviando}
            className="rounded-lg bg-red-700 px-4 py-1.5 text-[12px] font-semibold text-[#F0ECE4] hover:bg-red-600 disabled:opacity-50">
            {enviando ? "Aguarde..." : botao}
          </button>
        </div>
      </div>
    </div>
  );
}
