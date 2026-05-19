"use client";

import Image from "next/image";

// ─── Types ───────────────────────────────────────────────────────────────────

export type PropostaCreditoPublic = {
  code: string;
  client_name: string;
  credit_line: string;
  requested_value: number;
  approved_value: number | null;
  stage: string;
  status: string;
  created_at: string;
  updated_at: string;
  partner_name: string;
  partner_whatsapp: string;
  pending_reason: string | null;
  pending_resolved_at: string | null;
};

// ─── Pipeline stages (ordem pública) ─────────────────────────────────────────

const PIPELINE_STAGES: Array<{
  key: string;
  label: string;
  description: string;
}> = [
  {
    key: "RECEBIDO",
    label: "Proposta Recebida",
    description: "Sua proposta foi registrada e está na fila de análise pela nossa equipe.",
  },
  {
    key: "TRIAGEM",
    label: "Em Triagem",
    description: "Nossa equipe está revisando os documentos e qualificando sua operação.",
  },
  {
    key: "ANALISE",
    label: "Análise de Crédito",
    description: "Sua proposta está sendo analisada pela mesa de crédito da V3 Partners.",
  },
  {
    key: "PENDENCIA",
    label: "Pendência de Documentos",
    description: "Precisamos de documentos adicionais para avançar com sua proposta.",
  },
  {
    key: "APROVACAO",
    label: "Em Aprovação",
    description: "Sua proposta está na etapa final de aprovação.",
  },
  {
    key: "FINALIZADO",
    label: "Concluído",
    description: "Parabéns! Sua operação foi finalizada com sucesso.",
  },
];

const STAGE_ORDER: Record<string, number> = Object.fromEntries(
  PIPELINE_STAGES.map((s, i) => [s.key, i])
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatWhatsApp(phone: string) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AcompanharPropostaClient({
  proposal,
}: {
  proposal: PropostaCreditoPublic;
}) {
  const currentIdx = STAGE_ORDER[proposal.stage] ?? 0;
  const isFinished = proposal.stage === "FINALIZADO";
  const isCancelled = proposal.status === "REJECTED" || proposal.status === "CANCELLED";
  const isPending = proposal.stage === "PENDENCIA" && !proposal.pending_resolved_at;
  const whatsappUrl = formatWhatsApp(proposal.partner_whatsapp);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#09081A",
        fontFamily: "'DM Sans', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
      `}</style>

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header
        style={{
          background: "linear-gradient(135deg, #111F35 0%, #162744 100%)",
          borderBottom: "1px solid #243A66",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Image
            src="/logo.jpg"
            alt="V3 Partners"
            width={44}
            height={44}
            style={{ borderRadius: 8, objectFit: "cover" }}
          />
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "#C9A84C",
                textTransform: "uppercase",
              }}
            >
              V3 Partners
            </div>
            <div style={{ fontSize: 14, color: "#7A8FA8", fontWeight: 500 }}>
              Acompanhe sua proposta
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#7A8FA8", marginBottom: 4, fontWeight: 500 }}>
            Olá,
          </div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#F0ECE4",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {proposal.client_name}
          </h1>
          <div style={{ fontSize: 11, color: "#243A66", marginTop: 6, fontWeight: 500 }}>
            {proposal.code}
          </div>
        </div>

        {/* Status badge */}
        {isCancelled ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: 20,
              padding: "6px 14px",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#F87171" }}>
              Proposta Encerrada
            </span>
          </div>
        ) : isFinished ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.35)",
              borderRadius: 20,
              padding: "6px 14px",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#10B981" }}>
              ✓ Concluído
            </span>
          </div>
        ) : isPending ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(251,146,60,0.12)",
              border: "1px solid rgba(251,146,60,0.35)",
              borderRadius: 20,
              padding: "6px 14px",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#FB923C" }}>
              ⚠ Documentos Pendentes
            </span>
          </div>
        ) : (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(201,168,76,0.12)",
              border: "1px solid rgba(201,168,76,0.35)",
              borderRadius: 20,
              padding: "6px 14px",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 700, color: "#E8C97A" }}>
              Em andamento
            </span>
          </div>
        )}
      </header>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          maxWidth: 560,
          width: "100%",
          margin: "0 auto",
          padding: "32px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* ── Alerta de Pendência ── */}
        {isPending && proposal.pending_reason && (
          <section
            style={{
              background: "rgba(251,146,60,0.06)",
              border: "1px solid rgba(251,146,60,0.3)",
              borderRadius: 16,
              padding: "20px",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#FB923C",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 10,
              }}
            >
              ⚠ Ação Necessária
            </div>
            <p style={{ fontSize: 13, color: "#F0ECE4", lineHeight: 1.6, margin: 0 }}>
              {proposal.pending_reason}
            </p>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 14,
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.35)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  color: "#10B981",
                  fontSize: 13,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Enviar documentos via WhatsApp
              </a>
            )}
          </section>
        )}

        {/* ── Encerrada ── */}
        {isCancelled && (
          <section
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 16,
              padding: "28px 24px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>✗</div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F87171", margin: "0 0 8px 0" }}>
              Proposta Encerrada
            </h2>
            <p style={{ fontSize: 13, color: "#7A8FA8", margin: 0, lineHeight: 1.6 }}>
              Esta proposta foi encerrada. Entre em contato com seu parceiro V3 para mais informações.
            </p>
          </section>
        )}

        {/* ── Timeline ── */}
        {!isCancelled && (
          <section
            style={{
              background: "#111F35",
              border: "1px solid #243A66",
              borderRadius: 16,
              padding: "24px 20px",
            }}
          >
            <h2
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#C9A84C",
                textTransform: "uppercase",
                margin: "0 0 24px 0",
              }}
            >
              Etapas da Proposta
            </h2>

            <div style={{ position: "relative" }}>
              {/* Linha vertical */}
              <div
                style={{
                  position: "absolute",
                  left: 15,
                  top: 8,
                  bottom: 8,
                  width: 2,
                  background: "#243A66",
                  borderRadius: 2,
                }}
              />

              {PIPELINE_STAGES.map((step, idx) => {
                const isPast = idx < currentIdx;
                const isCurrent = idx === currentIdx;

                let dotBg = "#162744";
                let dotBorder = "#243A66";
                let dotColor = "#7A8FA8";
                let labelColor = "#7A8FA8";

                if (step.key === "FINALIZADO" && isCurrent) {
                  dotBg = "#10B981";
                  dotBorder = "#10B981";
                  dotColor = "#fff";
                  labelColor = "#10B981";
                } else if (step.key === "PENDENCIA" && isCurrent) {
                  dotBg = "#FB923C";
                  dotBorder = "#FB923C";
                  dotColor = "#fff";
                  labelColor = "#FB923C";
                } else if (isCurrent) {
                  dotBg = "#C9A84C";
                  dotBorder = "#C9A84C";
                  dotColor = "#09081A";
                  labelColor = "#E8C97A";
                } else if (isPast) {
                  dotBg = "#10B981";
                  dotBorder = "#10B981";
                  dotColor = "#fff";
                  labelColor = "#F0ECE4";
                }

                const icon = isPast ? "✓" : isCurrent ? "●" : "○";

                return (
                  <div
                    key={step.key}
                    style={{
                      display: "flex",
                      gap: 16,
                      paddingBottom: idx < PIPELINE_STAGES.length - 1 ? 24 : 0,
                      position: "relative",
                    }}
                  >
                    {/* Dot */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: dotBg,
                        border: `2px solid ${dotBorder}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: isPast ? 13 : 10,
                        color: dotColor,
                        fontWeight: 700,
                        flexShrink: 0,
                        zIndex: 1,
                        position: "relative",
                        boxShadow: isCurrent ? "0 0 0 4px rgba(201,168,76,0.15)" : "none",
                      }}
                    >
                      {icon}
                    </div>

                    {/* Text */}
                    <div style={{ paddingTop: 4 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: isCurrent ? 700 : 500,
                          color: labelColor,
                          marginBottom: isCurrent ? 4 : 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {step.label}
                        {isCurrent && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: 10,
                              background: "rgba(201,168,76,0.15)",
                              border: "1px solid rgba(201,168,76,0.35)",
                              color: "#C9A84C",
                              textTransform: "uppercase" as const,
                              letterSpacing: "0.08em",
                            }}
                          >
                            Atual
                          </span>
                        )}
                      </div>
                      {isCurrent && (
                        <div style={{ fontSize: 12, color: "#7A8FA8", lineHeight: 1.5 }}>
                          {step.description}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Detalhes da Operação ── */}
        <section
          style={{
            background: "#111F35",
            border: "1px solid #243A66",
            borderRadius: 16,
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <h2
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#C9A84C",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            Detalhes da Operação
          </h2>

          {[
            {
              label: "Linha de Crédito",
              value: proposal.credit_line,
              highlight: true,
            },
            {
              label: "Valor Solicitado",
              value: formatCurrency(proposal.requested_value),
              highlight: false,
            },
            ...(proposal.approved_value
              ? [
                  {
                    label: "Valor Aprovado",
                    value: formatCurrency(proposal.approved_value),
                    highlight: true,
                  },
                ]
              : []),
            {
              label: "Parceiro Responsável",
              value: proposal.partner_name || "—",
              highlight: false,
            },
            {
              label: "Data de Submissão",
              value: formatDate(proposal.created_at),
              highlight: false,
            },
            {
              label: "Última Atualização",
              value: formatDate(proposal.updated_at),
              highlight: false,
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                paddingBottom: 12,
                borderBottom: "1px solid rgba(36,58,102,0.5)",
              }}
            >
              <span
                style={{ fontSize: 12, color: "#7A8FA8", fontWeight: 500, flexShrink: 0 }}
              >
                {item.label}
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: item.highlight ? "#E8C97A" : "#F0ECE4",
                  textAlign: "right",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}

          {/* WhatsApp CTA */}
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.35)",
                borderRadius: 10,
                padding: "12px 16px",
                color: "#10B981",
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
                marginTop: 4,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Falar com {proposal.partner_name ? proposal.partner_name.split(" ")[0] : "Parceiro"} no WhatsApp
            </a>
          )}
        </section>
      </main>

      {/* ─── Footer ─────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid #162744",
          padding: "20px",
          textAlign: "center",
          background: "#09081A",
        }}
      >
        <p style={{ fontSize: 11, color: "#7A8FA8", margin: 0, fontWeight: 500 }}>
          Powered by{" "}
          <span style={{ color: "#C9A84C", fontWeight: 700 }}>V3 Partners</span>
        </p>
        <p style={{ fontSize: 10, color: "#243A66", margin: "6px 0 0 0" }}>
          Boutique institucional multiproduto de securitização e estruturação financeira.
        </p>
      </footer>
    </div>
  );
}
