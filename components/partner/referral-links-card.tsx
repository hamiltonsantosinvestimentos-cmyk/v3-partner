"use client";

import { useState } from "react";
import { Copy, Check, Compass } from "lucide-react";

const GO = "#C9A84C", GL = "#E8C97A", CR = "#F5F1E8", MU = "#9BAFC5";
const N2 = "#13223A", N3 = "#162744", N4 = "#243A66";

interface ReferralLinksCardProps {
  partnerId: string;
}

// Teste A/B encerrado em 03/08/2026: a página escolhida foi a B (metáfora da
// bússola). A rota /analise continua no ar e redireciona para cá preservando
// ?ref e UTM, para não quebrar link que partner já compartilhou.
const PAGES = [
  { path: "/analise-v2", label: "Análise de Crédito Empresarial", desc: "Página de venda direta", icon: Compass },
];

export function ReferralLinksCard({ partnerId }: ReferralLinksCardProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://app.v3partners.com.br";

  function copy(path: string, url: string) {
    navigator.clipboard.writeText(url);
    setCopied(path);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 12, padding: 24, marginBottom: 24 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: GL, marginBottom: 6 }}>
        Seu link de indicação
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: CR, marginBottom: 4 }}>
        Análise de Crédito Empresarial (venda direta)
      </div>
      <p style={{ color: MU, fontSize: 12.5, margin: "0 0 18px", lineHeight: 1.6 }}>
        Compartilhe o link abaixo. Se o cliente comprar através dele, a venda fica atribuída a você
        automaticamente, sem precisar criar um link personalizado.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PAGES.map((p) => {
          const url = `${baseUrl}${p.path}?ref=${partnerId}`;
          const isCopied = copied === p.path;
          return (
            <div key={p.path} style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <p.icon size={14} color={GO} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: CR }}>{p.label}</span>
                <span style={{ fontSize: 11, color: MU }}>· {p.desc}</span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  readOnly
                  value={url}
                  onFocus={(e) => e.target.select()}
                  style={{
                    flex: 1, background: "#09081A", border: `1px solid ${N4}`, borderRadius: 6,
                    padding: "8px 10px", color: MU, fontSize: 11.5, fontFamily: "monospace", outline: "none",
                  }}
                />
                <button
                  onClick={() => copy(p.path, url)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, background: isCopied ? "rgba(74,222,128,0.1)" : N4,
                    border: `1px solid ${isCopied ? "rgba(74,222,128,0.3)" : N4}`, color: isCopied ? "#4ade80" : CR,
                    fontWeight: 600, fontSize: 11.5, padding: "8px 12px", borderRadius: 6, cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  {isCopied ? <Check size={13} /> : <Copy size={13} />} {isCopied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
