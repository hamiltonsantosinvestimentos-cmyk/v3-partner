"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

const C = {
  nc: "#162744", nm: "#243A66",
  go: "#C9A84C", gl: "#E8C97A", cr: "#F5F1E8", mu: "#9BAFC5",
};

export function EmptyState({
  dealId,
  canGenerate,
  onGenerated,
}: {
  dealId: string;
  canGenerate: boolean;
  onGenerated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ma/business-plan/${dealId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force_regenerate: false }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message || json.error || "Falha ao gerar o business plan.");
        return;
      }
      onGenerated();
    } catch {
      setError("Falha ao conectar com o motor de geração.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border px-8 py-16 text-center"
      style={{ background: C.nc, borderColor: C.nm }}
    >
      <Sparkles size={28} color={C.go} />
      <div>
        <h3 className="text-sm font-bold" style={{ color: C.cr }}>
          Nenhum business plan gerado ainda
        </h3>
        <p className="mt-1 text-xs" style={{ color: C.mu }}>
          O plano é narrado a partir dos dados financeiros estruturados deste ativo —
          números nunca são calculados ou estimados pela IA.
        </p>
      </div>
      {canGenerate ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-xs font-bold uppercase tracking-widest disabled:opacity-50"
          style={{ background: C.go, color: "#09081A" }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {loading ? "Gerando..." : "Gerar Business Plan"}
        </button>
      ) : (
        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: C.gl }}>
          Apenas ADMIN/GESTAO podem gerar o plano
        </p>
      )}
      {error && (
        <p className="text-xs font-medium" style={{ color: "#EF4444" }}>
          {error}
        </p>
      )}
    </div>
  );
}
