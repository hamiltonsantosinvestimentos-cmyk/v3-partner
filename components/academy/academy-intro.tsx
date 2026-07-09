"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SESSION_KEY = "v3_academy_intro_shown";

/**
 * Abertura estilo Netflix: logo da V3 aparece com um "bump" (escala + fade in),
 * segura um instante, e some com fade out revelando a página por trás.
 * Toca só uma vez por sessão do navegador (sessionStorage).
 */
export function AcademyIntro({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 650);
    const t2 = setTimeout(() => setPhase("out"), 1500);
    const t3 = setTimeout(() => {
      sessionStorage.setItem(SESSION_KEY, "1");
      onDone();
    }, 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#09081A]"
      style={{ opacity: phase === "out" ? 0 : 1, transition: "opacity 600ms ease" }}
    >
      <div
        className="relative"
        style={{
          transform: phase === "in" ? "scale(0.75)" : phase === "out" ? "scale(1.15)" : "scale(1)",
          opacity: phase === "in" ? 0 : 1,
          transition: phase === "in" ? "transform 650ms cubic-bezier(0.22,1,0.36,1), opacity 650ms ease" : "transform 600ms ease, opacity 600ms ease",
        }}
      >
        <div
          className="absolute inset-0 rounded-full blur-3xl"
          style={{
            background: "radial-gradient(circle, rgba(201,168,76,0.35) 0%, transparent 70%)",
            opacity: phase === "hold" ? 1 : 0,
            transition: "opacity 500ms ease",
          }}
        />
        <div className="relative w-28 h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden shadow-2xl">
          <Image src="/logo.jpg" alt="V3 Partners" fill className="object-cover" priority />
        </div>
      </div>
    </div>
  );
}

export function shouldShowAcademyIntro(): boolean {
  if (typeof window === "undefined") return false;
  return !sessionStorage.getItem(SESSION_KEY);
}
