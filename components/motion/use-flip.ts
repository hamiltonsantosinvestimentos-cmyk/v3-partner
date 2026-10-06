"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

// Movimento V3: cards de Kanban deslizam até o lugar novo (técnica FLIP) quando mudam de etapa,
// de ordem ou quando um filtro reorganiza a lista. Marque cada card com data-flip-id e cada
// coluna com data-flip-col; o card que muda de coluna ganha um brilho dourado rápido.
// Só visual: não mexe em estado nem em dados. Desliga com "reduzir movimento".

type Pos = { x: number; y: number; col: string | null };

export function useFlip(containerRef: RefObject<HTMLElement | null>, deps: unknown[]) {
  const prev = useRef(new Map<string, Pos>());
  const fixo = useRef(new Set<string>());

  const medir = () => {
    const c = containerRef.current;
    const m = new Map<string, Pos>();
    if (!c) return m;
    c.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
      const r = el.getBoundingClientRect();
      m.set(el.dataset.flipId!, { x: r.left, y: r.top, col: el.closest("[data-flip-col]")?.getAttribute("data-flip-col") ?? null });
    });
    return m;
  };

  useLayoutEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const agora = medir();
    if (!reduzir && prev.current.size) {
      c.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
        const antes = prev.current.get(el.dataset.flipId!);
        const depois = agora.get(el.dataset.flipId!);
        if (!antes || !depois) return;
        const dx = antes.x - depois.x, dy = antes.y - depois.y;
        if ((Math.abs(dx) < 1 && Math.abs(dy) < 1) || Math.abs(dx) > 4000 || Math.abs(dy) > 4000) return;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 560, easing: "cubic-bezier(.22,1.15,.36,1)" });
        if (antes.col !== depois.col) {
          el.animate(
            [{ boxShadow: "0 0 0 2px rgba(232,201,122,.9), 0 18px 40px -18px rgba(201,168,76,.7)" }, { boxShadow: "0 0 0 0 rgba(232,201,122,0)" }],
            { duration: 1200, delay: 380, easing: "ease-out" },
          );
        }
      });
    }
    prev.current = agora;
    fixo.current.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Rolagem muda a posição na tela sem mudar a ordem: atualiza a foto para não animar à toa.
  useEffect(() => {
    let raf = 0;
    const refotografar = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const m = medir();
        fixo.current.forEach((id) => { const p = prev.current.get(id); if (p) m.set(id, p); });
        prev.current = m;
      });
    };
    window.addEventListener("scroll", refotografar, true);
    window.addEventListener("resize", refotografar);
    return () => { window.removeEventListener("scroll", refotografar, true); window.removeEventListener("resize", refotografar); cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Posição de onde o card deve partir na próxima mudança (ex.: onde foi solto no arraste). */
  return (id: string, x: number, y: number) => {
    const p = prev.current.get(id);
    prev.current.set(id, { x, y, col: p?.col ?? null });
    fixo.current.add(id);
  };
}
