"use client";

import { Construction } from "lucide-react";

const C = {
  nc: "#162744", nm: "#243A66",
  go: "#C9A84C", gl: "#E8C97A", cr: "#F5F1E8", mu: "#9BAFC5",
};

export function UnsupportedSectorState({ sector }: { sector?: string | null }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border px-8 py-16 text-center"
      style={{ background: C.nc, borderColor: C.nm }}
    >
      <Construction size={26} color={C.gl} />
      <h3 className="text-sm font-bold" style={{ color: C.cr }}>
        Schema de Business Plan ainda não disponível para este setor
      </h3>
      <p className="max-w-md text-xs" style={{ color: C.mu }}>
        {sector
          ? `O setor "${sector}" está no roadmap do Business Plan Engine, mas o schema
             estruturado ainda não foi publicado.`
          : "Este deal não possui setor definido — defina o setor para habilitar o motor de geração."}
        {" "}Nenhum conteúdo genérico é exibido para evitar vazamento de dados entre deals.
      </p>
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.go }}>
        Roadmap: Agronegócio · Energia · Mineração · Crédito
      </span>
    </div>
  );
}
