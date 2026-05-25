"use client";
import { useState } from "react";
import { useBrandVoiceGate, type ContextType, type VoiceGateResult } from "@/hooks/useBrandVoiceGate";

interface BrandVoiceGateProps {
  text: string;
  contextType: ContextType;
  onValidated?: (result: VoiceGateResult) => void;
  saveAudit?: boolean;
  compact?: boolean;
}

export function BrandVoiceGate({
  text,
  contextType,
  onValidated,
  saveAudit = true,
  compact = false,
}: BrandVoiceGateProps) {
  const { validate, loading, result, error, reset } = useBrandVoiceGate();
  const [expanded, setExpanded] = useState(false);

  const handleValidate = async () => {
    if (!text?.trim()) return;
    const res = await validate(text, contextType, { saveAudit });
    if (res) {
      onValidated?.(res);
      if (!res.passed) setExpanded(true);
    }
  };

  const contextLabel = contextType === "institucional"
    ? "Governante/Sabio"
    : "Heroi";

  // Idle
  if (!result && !loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
        <button
          onClick={handleValidate}
          disabled={!text?.trim()}
          style={{
            background: text?.trim() ? "#C9A84C" : "#243A66",
            color: text?.trim() ? "#09081A" : "#7A8FA8",
            border: "none",
            borderRadius: 6,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: text?.trim() ? "pointer" : "not-allowed",
            letterSpacing: "0.02em",
            transition: "opacity 0.15s",
          }}
        >
          Validar Voz V3
        </button>
        {!compact && (
          <span style={{ fontSize: 11, color: "#7A8FA8" }}>
            Arquetipo: {contextLabel}
          </span>
        )}
        {error && (
          <span style={{ fontSize: 11, color: "#C9A84C" }}>{error}</span>
        )}
      </div>
    );
  }

  // Loading
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'DM Sans', sans-serif" }}>
        <div
          style={{
            width: 14,
            height: 14,
            border: "2px solid #243A66",
            borderTopColor: "#C9A84C",
            borderRadius: "50%",
            animation: "spin 0.7s linear infinite",
          }}
        />
        <span style={{ fontSize: 12, color: "#C9A84C" }}>Analisando voz...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!result) return null;

  const isApproved = result.passed;
  const badgeBg     = isApproved ? "rgba(34,134,58,0.12)"  : "rgba(201,168,76,0.10)";
  const badgeBorder = isApproved ? "rgba(34,134,58,0.6)"   : "rgba(201,168,76,0.6)";
  const badgeColor  = isApproved ? "#3fb950"               : "#C9A84C";
  const badgeLabel  = isApproved
    ? `Voz aprovada · ${result.score}/100`
    : `Desvios encontrados · ${result.score}/100`;

  const hasDetails = !isApproved && (result.issues.length > 0 || result.suggestions.length > 0);

  return (
    <div
      style={{
        background: "#111F35",
        border: "1px solid #243A66",
        borderRadius: 8,
        padding: compact ? "10px 14px" : "14px 18px",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        {/* Badge de status */}
        <span
          style={{
            background: badgeBg,
            border: `1px solid ${badgeBorder}`,
            color: badgeColor,
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {badgeLabel}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#7A8FA8" }}>
            {result.archetype_match}
          </span>

          {hasDetails && (
            <button
              onClick={() => setExpanded(!expanded)}
              style={{
                background: "transparent",
                border: "none",
                color: "#C9A84C",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {expanded ? "Ocultar" : "Ver detalhes"}
            </button>
          )}

          <button
            onClick={reset}
            style={{
              background: "transparent",
              border: "none",
              color: "#7A8FA8",
              fontSize: 11,
              cursor: "pointer",
              padding: 0,
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Revalidar
          </button>
        </div>
      </div>

      {expanded && hasDetails && (
        <div
          style={{
            marginTop: 12,
            borderTop: "1px solid #243A66",
            paddingTop: 12,
            display: "grid",
            gap: 12,
          }}
        >
          {result.issues.length > 0 && (
            <div>
              <p style={{
                margin: "0 0 6px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#7A8FA8",
              }}>
                Desvios detectados
              </p>
              <div style={{ display: "grid", gap: 4 }}>
                {result.issues.map((issue, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      fontSize: 12,
                      color: "#F0ECE4",
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: "#C9A84C", flexShrink: 0 }}>—</span>
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div>
              <p style={{
                margin: "0 0 6px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#7A8FA8",
              }}>
                Sugestoes de correcao
              </p>
              <div style={{ display: "grid", gap: 4 }}>
                {result.suggestions.map((sug, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      gap: 8,
                      fontSize: 12,
                      color: "#7A8FA8",
                      lineHeight: 1.5,
                    }}
                  >
                    <span style={{ color: "#243A66", flexShrink: 0 }}>›</span>
                    <span>{sug}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
