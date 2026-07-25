"use client";

import { useEffect, useState } from "react";
import { FileSignature, Loader2, RefreshCw, CheckCircle2, Clock3, Send } from "lucide-react";

const V3 = {
  navy:  "#09081A",
  navyB: "#13223A",
  navyC: "#162744",
  navyM: "#243A66",
  gold:  "#C9A84C",
  goldL: "#E8C97A",
  cream: "#F5F1E8",
  muted: "#9BAFC5",
  green: "#4ade80",
  amber: "#E89B3A",
};

type LoiContract = {
  id: string;
  dealId: string;
  dealCode: string;
  buyerName: string;
  buyerEmail: string;
  statusSignature: "rascunho" | "enviado_assinatura" | "assinado" | string;
  externalEnvelopeId: string | null;
  createdAt: string;
  signedAt: string | null;
};

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  rascunho:           { label: "Gerando documento",       color: V3.muted, bg: "rgba(155,175,197,.12)", icon: Clock3 },
  enviado_assinatura: { label: "Aguardando assinatura",   color: V3.amber, bg: "rgba(232,155,58,.12)",  icon: Send },
  assinado:           { label: "Assinado, Deal Room liberado", color: V3.green, bg: "rgba(74,222,128,.12)", icon: CheckCircle2 },
};

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function LoiPanel() {
  const [contracts, setContracts] = useState<LoiContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/ma/loi-contracts")
      .then(r => r.json())
      .then(({ contracts: data, error: err }: { contracts?: LoiContract[]; error?: string }) => {
        if (err) { setError(err); return; }
        setContracts(Array.isArray(data) ? data : []);
      })
      .catch(() => setError("Não foi possível carregar as Cartas de Intenção."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleResend(id: string) {
    setResendingId(id);
    setFeedback(f => ({ ...f, [id]: "" }));
    try {
      const res = await fetch(`/api/ma/loi-contracts/${id}/resend`, { method: "POST" });
      const data = await res.json();
      setFeedback(f => ({ ...f, [id]: res.ok ? data.message : data.error }));
    } catch {
      setFeedback(f => ({ ...f, [id]: "Falha ao reenviar. Tente novamente." }));
    } finally {
      setResendingId(null);
    }
  }

  const kpis = [
    { label: "Total",     value: contracts.length,                                                    color: V3.cream },
    { label: "Aguardando", value: contracts.filter(c => c.statusSignature === "enviado_assinatura").length, color: V3.amber },
    { label: "Assinadas", value: contracts.filter(c => c.statusSignature === "assinado").length,       color: V3.green },
  ];

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {kpis.map(k => (
          <div key={k.label} style={{ background: V3.navyC, border: `1px solid ${V3.navyM}`, borderRadius: 8, padding: "12px 16px" }}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: V3.goldL, margin: "0 0 4px" }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: k.color, margin: 0 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2" style={{ color: V3.muted }}>
          <Loader2 size={18} className="animate-spin" style={{ color: V3.gold }} />
          <span style={{ fontSize: 13 }}>Carregando Cartas de Intenção...</span>
        </div>
      )}

      {!loading && error && (
        <p className="text-center py-8" style={{ fontSize: 13, color: "#f87171" }}>{error}</p>
      )}

      {!loading && !error && contracts.length === 0 && (
        <div className="text-center py-16" style={{ color: V3.muted }}>
          <FileSignature size={32} style={{ color: V3.navyM, margin: "0 auto 12px" }} />
          <p style={{ fontSize: 13, margin: 0 }}>Nenhuma Carta de Intenção em andamento.</p>
          <p style={{ fontSize: 11, margin: "4px 0 0", color: V3.navyM }}>
            Cartas geradas pelo intake público do comprador aparecerão aqui.
          </p>
        </div>
      )}

      {!loading && !error && contracts.length > 0 && (
        <div style={{ display: "grid", gap: 10 }}>
          {contracts.map(c => {
            const stage = STAGE_CONFIG[c.statusSignature] ?? STAGE_CONFIG.rascunho;
            const Icon = stage.icon;
            const canResend = c.statusSignature === "enviado_assinatura" && !!c.externalEnvelopeId;
            return (
              <div key={c.id} style={{ background: V3.navyB, border: `1px solid ${V3.navyC}`, borderRadius: 8, padding: "14px 18px" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="flex items-center gap-1"
                        style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: stage.color, background: stage.bg, padding: "3px 8px", borderRadius: 20 }}
                      >
                        <Icon size={10} /> {stage.label}
                      </span>
                      <span style={{ fontSize: 9, color: V3.navyM, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        {c.dealCode}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: V3.cream, margin: "0 0 4px" }}>{c.buyerName}</p>
                    <p style={{ fontSize: 11, color: V3.muted, margin: 0 }}>{c.buyerEmail}</p>
                    <p style={{ fontSize: 10, color: V3.navyM, margin: "6px 0 0" }}>
                      Enviada em {fmtDate(c.createdAt)}
                      {c.signedAt && ` · Assinada em ${fmtDate(c.signedAt)}`}
                    </p>
                    {feedback[c.id] && (
                      <p style={{ fontSize: 11, color: feedback[c.id].startsWith("Falha") || feedback[c.id].includes("já") ? "#f87171" : V3.green, margin: "6px 0 0" }}>
                        {feedback[c.id]}
                      </p>
                    )}
                  </div>
                  {canResend && (
                    <button
                      onClick={() => handleResend(c.id)}
                      disabled={resendingId === c.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: "transparent", color: V3.gold,
                        border: `1px solid ${V3.gold}`, borderRadius: 6, padding: "7px 12px",
                        fontSize: 11, fontWeight: 700, cursor: resendingId === c.id ? "default" : "pointer",
                        opacity: resendingId === c.id ? 0.6 : 1, flexShrink: 0,
                      }}
                    >
                      {resendingId === c.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      Reenviar notificação
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
