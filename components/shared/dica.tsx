"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { NOTAS_DO_PORQUE, type NotaId } from "@/lib/notas-do-porque";

/**
 * Nota do porquê: ícone que abre um texto curto explicando por que o dado é pedido,
 * o que é feito com ele, quem vê e por quanto tempo fica. Abre por mouse (hover), foco
 * de teclado e toque (clique); fecha com Escape ou ao tocar fora.
 * Os textos ficam em lib/notas-do-porque.ts, em um lugar só, para revisão do jurídico.
 */
export function Dica({ id, className = "" }: { id: NotaId; className?: string }) {
  const nota = NOTAS_DO_PORQUE[id];
  const [hover, setHover] = useState(false);
  const [foco, setFoco] = useState(false);
  const [fixo, setFixo] = useState(false);
  const aberto = hover || foco || fixo;
  const raiz = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) {
        setHover(false);
        setFoco(false);
        setFixo(false);
      }
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  if (!nota) return null;

  return (
    <span
      ref={raiz}
      className={`relative inline-flex align-middle ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        type="button"
        aria-label={`Por que pedimos isto: ${nota.titulo}`}
        aria-describedby={aberto ? tipId : undefined}
        aria-expanded={aberto}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setFixo((f) => !f);
        }}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setHover(false);
            setFoco(false);
            setFixo(false);
          }
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[#C9A84C] hover:text-[#E8C97A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A84C]"
      >
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {aberto && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute z-50 left-0 top-full mt-1 w-64 max-w-[calc(100vw-32px)] rounded-lg border border-[#C9A84C]/40 bg-[#12112A] px-3 py-2 text-[12px] font-normal normal-case tracking-normal leading-relaxed text-[#F5F1E8] shadow-lg"
        >
          {nota.texto}
        </span>
      )}
    </span>
  );
}
