"use client";

import { AlertTriangle } from "lucide-react";

const C = {
  nc: "#162744", nm: "#243A66",
  go: "#C9A84C", gl: "#E8C97A", cr: "#F5F1E8", mu: "#9BAFC5",
};

export function IncompleteDataState({
  fields,
  dealId,
}: {
  fields: string[];
  dealId: string;
}) {
  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border px-8 py-10"
      style={{ background: C.nc, borderColor: C.nm }}
    >
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} color={C.gl} />
        <h3 className="text-sm font-bold" style={{ color: C.cr }}>
          Dados financeiros incompletos
        </h3>
      </div>
      <p className="text-xs" style={{ color: C.mu }}>
        O Business Plan Engine exige dados financeiros estruturados completos antes de
        narrar a tese de investimento. Complete os campos abaixo na aba de projeções
        financeiras deste deal:
      </p>
      <ul className="flex flex-wrap gap-2">
        {fields.map((field) => (
          <li
            key={field}
            className="rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
            style={{ borderColor: C.go, color: C.gl }}
          >
            {field}
          </li>
        ))}
      </ul>
      <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.mu }}>
        Deal {dealId.slice(0, 8).toUpperCase()} · geração bloqueada até completar os dados
      </p>
    </div>
  );
}
