"use client";

import { useEffect, useRef, useState } from "react";

// Movimento V3: número que sobe até o valor ao montar a tela e anima quando o valor muda.
// A página entra com opacidade (template .v3-page-in), então a contagem a partir de zero não
// aparece como "piscada". Com "reduzir movimento" mostra o valor direto.

const padrao = (n: number) => Math.round(n).toLocaleString("pt-BR");

export function AnimatedNumber({ value, format = padrao, duration = 1200 }: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [atual, setAtual] = useState(value);
  const de = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !Number.isFinite(value)) {
      setAtual(value); de.current = value; return;
    }
    const inicio = de.current, t0 = performance.now();
    let raf = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - p, 4);
      setAtual(inicio + (value - inicio) * e);
      if (p < 1) raf = requestAnimationFrame(passo);
      else de.current = value;
    };
    raf = requestAnimationFrame(passo);
    return () => { cancelAnimationFrame(raf); de.current = value; };
  }, [value, duration]);

  return <span className="tabular-nums">{format(atual)}</span>;
}
