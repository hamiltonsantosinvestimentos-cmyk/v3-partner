"use client";

import { useState, useEffect } from "react";

const V3 = {
  navy: "#09081A", navyB: "#13223A", navyC: "#162744", navyM: "#243A66",
  gold: "#C9A84C", goldL: "#E8C97A", cream: "#F5F1E8", muted: "#9BAFC5",
  green: "#4ade80", red: "#f87171",
};

type AcceptanceData = {
  fund_name: string;
  deal_code: string;
  tec_percentage: number;
  fee_value: string;
  deal_value: string;
  recipient_name: string;
  penalty_clause: string;
  negativation_clause: string;
  status: string;
  accepted_at?: string;
};

export default function AceiteTecPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [data, setData] = useState<AcceptanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    params.then(p => {
      setToken(p.token);
      fetch(`/api/propostas/mandato-tec/accept/${p.token}`, { method: "GET" })
        .then(r => r.json())
        .then(d => { if (d.error) setError(d.error); else setData(d); })
        .catch(() => setError("Erro ao carregar mandato."))
        .finally(() => setLoading(false));
    });
  }, [params]);

  async function handleAccept() {
    if (!name.trim() || !agreed) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/propostas/mandato-tec/accept/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted_by: name.trim() }),
      });
      const result = await res.json();
      if (!res.ok) { setError(result.error ?? "Erro ao aceitar."); return; }
      setAccepted(true);
    } catch { setError("Erro de conexão."); }
    finally { setSubmitting(false); }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh", background: V3.navy, display: "flex",
    alignItems: "center", justifyContent: "center", padding: "40px 16px",
    fontFamily: "'DM Sans', sans-serif",
  };

  const cardStyle: React.CSSProperties = {
    maxWidth: 520, width: "100%", background: V3.navyB,
    border: `1px solid ${V3.navyM}`, borderRadius: 12, padding: "36px 32px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 700, letterSpacing: ".15em",
    textTransform: "uppercase" as const, color: V3.goldL, marginBottom: 6, display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: V3.navyC, border: `1px solid ${V3.navyM}`,
    borderRadius: 6, padding: "10px 14px", color: V3.cream,
    fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" as const,
  };

  if (loading) return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <p style={{ color: V3.muted, textAlign: "center" }}>Carregando...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style={{ height: 36, marginBottom: 24 }} />
        <p style={{ color: V3.red, fontSize: 14, lineHeight: 1.6 }}>{error}</p>
      </div>
    </div>
  );

  if (accepted) return (
    <div style={containerStyle}>
      <div style={{ ...cardStyle, textAlign: "center" as const }}>
        <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style={{ height: 36, marginBottom: 24 }} />
        <div style={{ width: 48, height: 48, background: "rgba(74,222,128,.12)", border: "1px solid rgba(74,222,128,.3)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <span style={{ color: V3.green, fontSize: 24 }}>&#10003;</span>
        </div>
        <h2 style={{ color: V3.cream, fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Mandato TEC Aceito</h2>
        <p style={{ color: V3.muted, fontSize: 14, lineHeight: 1.6 }}>
          Seu aceite foi registrado em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.
          A equipe V3 Partners entrará em contato com os próximos passos.
        </p>
      </div>
    </div>
  );

  if (!data) return null;

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style={{ height: 36, marginBottom: 24 }} />

        <p style={{ ...labelStyle, marginBottom: 8 }}>Mandato — Taxa de Estruturação de Crédito</p>
        <h1 style={{ color: V3.cream, fontSize: 22, fontWeight: 700, margin: "0 0 20px", lineHeight: 1.3 }}>
          {data.fund_name}
        </h1>

        <div style={{ background: V3.navyC, border: `1px solid ${V3.navyM}`, borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" as const }}>
            <div>
              <p style={labelStyle}>Deal</p>
              <p style={{ color: V3.cream, fontSize: 14, fontWeight: 600, margin: 0 }}>{data.deal_code}</p>
            </div>
            <div>
              <p style={labelStyle}>Taxa TEC</p>
              <p style={{ color: V3.gold, fontSize: 22, fontWeight: 800, margin: 0 }}>{data.tec_percentage}%</p>
            </div>
            <div>
              <p style={labelStyle}>Fee Estimado</p>
              <p style={{ color: V3.cream, fontSize: 14, fontWeight: 600, margin: 0 }}>{data.fee_value}</p>
            </div>
            <div>
              <p style={labelStyle}>Valor da Operação</p>
              <p style={{ color: V3.muted, fontSize: 14, fontWeight: 600, margin: 0 }}>{data.deal_value}</p>
            </div>
          </div>
        </div>

        <div style={{ background: V3.navyC, border: `1px solid ${V3.navyM}`, borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
          <p style={{ ...labelStyle, marginBottom: 10 }}>Termos e Condições</p>
          <p style={{ color: V3.muted, fontSize: 12, lineHeight: 1.7, margin: "0 0 8px" }}>{data.penalty_clause}</p>
          <p style={{ color: V3.muted, fontSize: 12, lineHeight: 1.7, margin: 0 }}>{data.negativation_clause}</p>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Seu nome completo</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Digite seu nome completo" style={inputStyle} />
        </div>

        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 24 }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: V3.gold, marginTop: 2, flexShrink: 0 }} />
          <span style={{ color: V3.muted, fontSize: 13, lineHeight: 1.6 }}>
            Li e aceito as cláusulas do mandato TEC acima, incluindo multa contratual e negativação.
          </span>
        </label>

        <button onClick={handleAccept} disabled={!name.trim() || !agreed || submitting}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 6, border: "none",
            background: name.trim() && agreed ? V3.gold : V3.navyM,
            color: name.trim() && agreed ? V3.navy : V3.muted,
            fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
            cursor: name.trim() && agreed ? "pointer" : "not-allowed",
          }}>
          {submitting ? "Processando..." : "Confirmar Aceite"}
        </button>
      </div>
    </div>
  );
}
