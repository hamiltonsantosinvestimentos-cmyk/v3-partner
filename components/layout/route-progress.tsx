"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// Barra dourada no topo durante a troca de página (Movimento V3). Começa no clique de um link
// interno e completa quando a rota nova monta. Puramente visual: não interfere na navegação.

export function RouteProgress() {
  const pathname = usePathname();
  const [estado, setEstado] = useState<"parado" | "indo" | "fim">("parado");
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      if (href.split("?")[0] === window.location.pathname) return;
      setEstado("indo");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setEstado((s) => (s === "indo" ? "fim" : s));
    timer.current = window.setTimeout(() => setEstado("parado"), 450);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [pathname]);

  return <div aria-hidden className={`v3-route-bar ${estado === "indo" ? "is-going" : estado === "fim" ? "is-done" : ""}`} />;
}
