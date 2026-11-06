"use client";

// Modal V3 que só fecha pelos botões (nunca ao clicar fora), padrão de ação irreversível.
import React from "react";

export function ModalV3({ aberto, titulo, perigo, children, rodape }: {
  aberto: boolean;
  titulo: string;
  perigo?: boolean;
  children: React.ReactNode;
  rodape: React.ReactNode;
}) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className={`w-full max-w-lg max-h-[88vh] flex flex-col rounded-xl bg-[#09081A] border ${perigo ? "border-red-500/60" : "border-[#C9A84C]/30"}`}>
        <div className={`px-5 py-4 border-b ${perigo ? "border-red-500/40 bg-red-500/10" : "border-[#C9A84C]/20"}`}>
          <h2 className={`text-sm font-bold ${perigo ? "text-red-300" : "text-[#F0ECE4]"}`}>{titulo}</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-[13px] text-[#7A8FA8] leading-relaxed">{children}</div>
        <div className="px-5 py-3 border-t border-[#162744] flex justify-end gap-2">{rodape}</div>
      </div>
    </div>
  );
}

export function BotaoV3({ children, onClick, tipo = "secundario", disabled, type = "button" }: {
  children: React.ReactNode;
  onClick?: () => void;
  tipo?: "primario" | "secundario" | "perigo";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const cls = tipo === "primario"
    ? "bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A]"
    : tipo === "perigo"
      ? "bg-red-600 text-white hover:bg-red-500"
      : "bg-[#162744] text-[#F0ECE4] hover:bg-[#243A66]";
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`px-4 py-2 rounded-lg text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C] ${cls}`}>
      {children}
    </button>
  );
}

export function dataBR(iso: string | null | undefined, comHora = false): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric",
    ...(comHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
