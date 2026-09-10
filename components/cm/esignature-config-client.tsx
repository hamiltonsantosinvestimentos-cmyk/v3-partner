"use client";

import { useEffect, useState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";

type VerticalConfig = { vertical: string; provider: "clicksign" | "certone"; updated_at: string };

const VERTICAL_LABELS: Record<string, string> = {
  capital_markets: "Bolsa de Ativos",
  credito: "Mesa de Crédito",
  ma: "M&A",
  institucional: "Institucional",
  clientes: "Clientes / Partners",
  talent_pool: "Talent Pool",
  colaboradores: "Colaboradores",
};

export function EsignatureConfigClient() {
  const [rows, setRows] = useState<VerticalConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/contracts/esignature-config")
      .then((res) => res.json())
      .then((json) => {
        if (json.data) setRows(json.data);
        else setError(json.error ?? "Erro ao carregar configuração.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggle(vertical: string, provider: "clicksign" | "certone") {
    setSaving(vertical);
    setError("");
    try {
      const res = await fetch("/api/contracts/esignature-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vertical, provider }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao salvar.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.vertical === vertical ? json.data : r)));
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <div className="p-6 text-sm text-[#9BAFC5]">Carregando...</div>;

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-[#F5F1E8]">Provedor de Assinatura Digital</h2>
        <p className="text-sm text-[#9BAFC5] mt-1">
          Escolha o provedor (ClickSign ou CertOne) usado no <strong className="text-[#F5F1E8]">próximo envio</strong> de cada
          vertical. Contratos já enviados para assinatura nunca trocam de provedor: cada um usa para sempre o que foi
          gravado no momento do envio.
        </p>
      </div>

      {error && (
        <p className="text-xs flex items-center gap-1.5 text-red-400">
          <AlertCircle size={13} /> {error}
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.vertical}
            className="flex items-center justify-between bg-[#162744] border border-[#243A66] rounded-xl px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-[#C9A84C]" />
              <span className="text-sm text-[#F5F1E8]">{VERTICAL_LABELS[row.vertical] ?? row.vertical}</span>
            </div>
            <div className="flex gap-1 bg-[#09081A] rounded-lg p-1">
              {(["clicksign", "certone"] as const).map((p) => (
                <button
                  key={p}
                  disabled={saving === row.vertical}
                  onClick={() => toggle(row.vertical, p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors disabled:opacity-50 ${
                    row.provider === p
                      ? "bg-[#C9A84C] text-[#09081A]"
                      : "text-[#9BAFC5] hover:text-[#F5F1E8]"
                  }`}
                >
                  {p === "clicksign" ? "ClickSign" : "CertOne"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
