"use client";

import { useEffect, useRef, type RefObject } from "react";

// Movimento V3: arraste premium no Kanban (prévia "V3 Plataforma em Movimento").
// O card vira uma cópia flutuante e inclinada que segue o mouse, a coluna de destino acende
// e, ao soltar, o card voa até o lugar novo (com o useFlip). Clique sem arrastar continua
// abrindo a proposta. Só mouse/caneta: no toque o comportamento é o de sempre.
// Cards: [data-flip-id]; colunas: [data-flip-col]. Botões, links e campos dentro do card
// não iniciam arraste.

type Opts = {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
  onDrop: (id: string, coluna: string) => void;
  /** Avisa o useFlip de onde o card deve "voar" (a posição da cópia ao soltar). */
  definirOrigem?: (id: string, x: number, y: number) => void;
};

export function useKanbanDrag({ containerRef, enabled, onDrop, definirOrigem }: Opts) {
  const cb = useRef({ onDrop, definirOrigem });
  cb.current = { onDrop, definirOrigem };

  useEffect(() => {
    const c = containerRef.current;
    if (!c || !enabled) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let arr: null | {
      id: string; card: HTMLElement; origemCol: string | null; ox: number; oy: number; sx: number; sy: number;
      movido: boolean; copia: HTMLElement | null; sobre: HTMLElement | null; pid: number;
    } = null;
    let engolirClique = false;

    const colunaEm = (x: number, y: number) => {
      const el = document.elementFromPoint(x, y)?.closest("[data-flip-col]") as HTMLElement | null;
      return el && c.contains(el) ? el : null;
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0 || e.pointerType === "touch") return;
      const t = e.target as HTMLElement;
      if (t.closest("button, a, input, textarea, select, [data-no-drag]")) return;
      const card = t.closest("[data-flip-id]") as HTMLElement | null;
      if (!card || !c.contains(card)) return;
      const r = card.getBoundingClientRect();
      arr = {
        id: card.dataset.flipId!, card, origemCol: card.closest("[data-flip-col]")?.getAttribute("data-flip-col") ?? null,
        ox: e.clientX - r.left, oy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, movido: false, copia: null, sobre: null, pid: e.pointerId,
      };
    };

    const move = (e: PointerEvent) => {
      if (!arr || e.pointerId !== arr.pid) return;
      if (!arr.movido) {
        if (Math.hypot(e.clientX - arr.sx, e.clientY - arr.sy) < 6) return;
        arr.movido = true;
        const r = arr.card.getBoundingClientRect();
        const copia = arr.card.cloneNode(true) as HTMLElement;
        copia.removeAttribute("data-flip-id");
        Object.assign(copia.style, {
          position: "fixed", left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, margin: "0", zIndex: "9998",
          pointerEvents: "none", cursor: "grabbing", borderColor: "#C9A84C",
          boxShadow: "0 30px 60px -20px rgba(0,0,0,.9), 0 0 0 1px rgba(201,168,76,.55)",
        });
        document.body.appendChild(copia);
        arr.copia = copia;
        arr.card.style.opacity = "0.3";
        document.body.style.cursor = "grabbing";
        document.body.style.userSelect = "none";
        if (!reduzir) copia.animate([{ transform: "rotate(0) scale(1)" }, { transform: "rotate(-3deg) scale(1.04)" }], { duration: 260, easing: "cubic-bezier(.22,1.4,.36,1)", fill: "forwards" });
      }
      arr.copia!.style.left = `${e.clientX - arr.ox}px`;
      arr.copia!.style.top = `${e.clientY - arr.oy}px`;
      const col = colunaEm(e.clientX, e.clientY);
      if (col !== arr.sobre) {
        arr.sobre?.classList.remove("v3-col-over");
        if (col && col.getAttribute("data-flip-col") !== arr.origemCol) col.classList.add("v3-col-over");
        arr.sobre = col;
      }
    };

    const up = (e: PointerEvent) => {
      if (!arr || e.pointerId !== arr.pid) return;
      const a = arr; arr = null;
      if (!a.movido) return; // clique simples: deixa o onClick abrir a proposta
      engolirClique = true;
      setTimeout(() => { engolirClique = false; }, 0);
      a.sobre?.classList.remove("v3-col-over");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const destino = colunaEm(e.clientX, e.clientY)?.getAttribute("data-flip-col") ?? null;
      const copia = a.copia!;
      const cr = copia.getBoundingClientRect();
      if (destino && destino !== a.origemCol) {
        cb.current.definirOrigem?.(a.id, cr.left, cr.top);
        a.card.style.opacity = "";
        copia.remove();
        cb.current.onDrop(a.id, destino);
      } else {
        const r = a.card.getBoundingClientRect();
        const fim = () => { copia.remove(); a.card.style.opacity = ""; };
        if (reduzir) fim();
        else copia.animate(
          [{ left: `${cr.left}px`, top: `${cr.top}px` }, { left: `${r.left}px`, top: `${r.top}px`, transform: "rotate(0) scale(1)" }],
          { duration: 360, easing: "cubic-bezier(.22,1.1,.36,1)", fill: "forwards" },
        ).onfinish = fim;
      }
    };

    const click = (e: MouseEvent) => { if (engolirClique) { e.stopPropagation(); e.preventDefault(); } };

    c.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    c.addEventListener("click", click, true);
    return () => {
      c.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      c.removeEventListener("click", click, true);
    };
  }, [containerRef, enabled]);
}
