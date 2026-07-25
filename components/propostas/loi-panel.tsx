"use client";

import { useEffect, useState } from "react";
import { FileSignature, Loader2, RefreshCw, CheckCircle2, Clock3, Send, Circle } from "lucide-react";

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

type StageStatus = {
  templateName: string;
  label: string;
  status: "nao_iniciado" | "rascunho" | "enviado_assinatura" | "assinado";
  contractId: string | null;
};

type OperacaoTimeline = {
  dealId: string;
  dealCode: string;
  stages: StageStatus[];
};

const STAGE_CONFIG: Record<StageStatus["status"], { color: string; bg: string; icon: React.ElementType; label: string }> = {
  nao_iniciado:       { color: V3.navyM, bg: "rgba(36,58,102,.25)",  icon: Circle,        label: "Não iniciado" },
  rascunho:            { color: V3.muted, bg: "rgba(155,175,197,.12)", icon: Clock3,        label: "Gerando" },
  enviado_assinatura:  { color: V3.amber, bg: "rgba(232,155,58,.12)",  icon: Send,          label: "Aguardando assinatura" },
  assinado:            { color: V3.green, bg: "rgba(74,222,128,.12)",  icon: CheckCircle2,  label: "Concluído" },
};

export function LoiPanel() {
  const [operacoes, setOperacoes] = useState<OperacaoTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  function load() {
    setLoading(true);
    setError(null);
    fetch("/api/ma/loi-contracts")
      .then(r => r.json())
      .then(({ operacoes: data, error: err }: { operacoes?: OperacaoTimeline[]; error?: string }) => {
        if (err) { setError(err); return; }
        setOperacoes(Array.isArray(data) ? data : []);
      })
      .catch(() => setError("Não foi possível carregar as operações."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleResend(contractId: string) {
    setResendingId(contractId);
    setFeedback(f => ({ ...f, [contractId]: "" }));
    try {
      const res = await fetch(`/api/ma/loi-contracts/${contractId}/resend`, { method: "POST" });
      const data = await res.json();
      setFeedback(f => ({ ...f, [contractId]: res.ok ? data.message : data.error }));
    } catch {
      setFeedback(f => ({ ...f, [contractId]: "Falha ao reenviar. Tente novamente." }));
    } finally {
      setResendingId(null);
    }
  }

  const totalOperacoes = operacoes.length;
  const concluidas = operacoes.filter(op => op.stages.every(s => s.status === "assinado")).length;
  const emAndamento = totalOperacoes - concluidas;

  const kpis = [
    { label: "Operações", value: totalOperacoes, color: V3.cream },
    { label: "Em Andamento", value: emAndamento,  color: V3.amber },
    { label: "Concluídas",  value: concluidas,    color: V3.green },
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
          <span style={{ fontSize: 13 }}>Carregando operações...</span>
        </div>
      )}

      {!loading && error && (
        <p className="text-center py-8" style={{ fontSize: 13, color: "#f87171" }}>{error}</p>
      )}

      {!loading && !error && operacoes.length === 0 && (
        <div className="text-center py-16" style={{ color: V3.muted }}>
          <FileSignature size={32} style={{ color: V3.navyM, margin: "0 auto 12px" }} />
          <p style={{ fontSize: 13, margin: 0 }}>Nenhuma operação em andamento.</p>
          <p style={{ fontSize: 11, margin: "4px 0 0", color: V3.navyM }}>
            Operações geradas pelo intake público de compradores e vendedores aparecerão aqui.
          </p>
        </div>
      )}

      {!loading && !error && operacoes.length > 0 && (
        <div style={{ display: "grid", gap: 12 }}>
          {operacoes.map(op => (
            <div key={op.dealId} style={{ background: V3.navyB, border: `1px solid ${V3.navyC}`, borderRadius: 8, padding: "16px 18px" }}>
              <p style={{ fontSize: 11, color: V3.navyM, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                {op.dealCode}
              </p>

              <div className="flex items-stretch gap-2">
                {op.stages.map((stage, idx) => {
                  const cfg = STAGE_CONFIG[stage.status];
                  const Icon = cfg.icon;
                  const canResend = stage.status === "enviado_assinatura" && !!stage.contractId;
                  return (
                    <div key={stage.templateName} className="flex items-center flex-1" style={{ minWidth: 0 }}>
                      <div className="flex-1 min-w-0" style={{ background: cfg.bg, border: `1px solid ${cfg.color}40`, borderRadius: 6, padding: "10px 10px" }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon size={11} style={{ color: cfg.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: V3.cream, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {stage.label}
                          </span>
                        </div>
                        <span style={{ fontSize: 9, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                        {canResend && (
                          <button
                            onClick={() => handleResend(stage.contractId!)}
                            disabled={resendingId === stage.contractId}
                            className="flex items-center gap-1 mt-2"
                            style={{
                              background: "transparent", color: V3.gold, border: `1px solid ${V3.gold}`,
                              borderRadius: 4, padding: "4px 6px", fontSize: 9, fontWeight: 700,
                              cursor: resendingId === stage.contractId ? "default" : "pointer",
                              opacity: resendingId === stage.contractId ? 0.6 : 1,
                            }}
                          >
                            {resendingId === stage.contractId ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
                            Reenviar
                          </button>
                        )}
                      </div>
                      {idx < op.stages.length - 1 && (
                        <div style={{ width: 12, height: 1, background: V3.navyM, flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {op.stages.map(s => s.contractId && feedback[s.contractId] && (
                <p key={s.contractId} style={{ fontSize: 11, color: feedback[s.contractId].startsWith("Falha") || feedback[s.contractId].includes("já") ? "#f87171" : V3.green, margin: "8px 0 0" }}>
                  {feedback[s.contractId]}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
