"use client";

import { useSearchParams } from "next/navigation";
import { CheckCircle, X } from "lucide-react";
import { useState } from "react";

export function SuccessBanner() {
  const params = useSearchParams();
  const tipo = params.get("novo");
  const code = params.get("code");
  const [dismissed, setDismissed] = useState(false);

  if (!tipo || !code || dismissed) return null;

  const label =
    tipo === "ativo"
      ? "Ativo submetido com sucesso!"
      : tipo === "investidor"
      ? "Perfil de investidor enviado!"
      : "Cadastro recebido!";

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl border mb-6"
      style={{
        background: "linear-gradient(135deg, #C9A84C12, #C9A84C08)",
        border: "1px solid #C9A84C40",
      }}
    >
      <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#C9A84C" }} />
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: "#F0ECE4" }}>
          {label}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "#7A8FA8" }}>
          Código de acompanhamento:{" "}
          <span className="font-mono font-bold" style={{ color: "#C9A84C" }}>
            {code}
          </span>
          . A equipe V3 entrará em contato em até 2 dias úteis.
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded-lg hover:bg-white/5 transition-colors"
      >
        <X className="w-4 h-4" style={{ color: "#7A8FA8" }} />
      </button>
    </div>
  );
}
