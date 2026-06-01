"use client";

import { useState } from "react";
import { X, Mic, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

interface AudioExtraction {
  id: string;
  transcription?: string | null;
  vertical_detected?: string | null;
  ticket_estimado?: string | null;
  urgencia?: "ALTA" | "NORMAL" | "BAIXA" | null;
  resumo_executivo?: string | null;
  proximo_passo?: string | null;
  dados_contato?: { nome?: string | null; empresa?: string | null } | null;
  status: string;
  sender_phone?: string | null;
  sender_name?: string | null;
  processed_at?: string | null;
  error_message?: string | null;
}

interface Props {
  intakeId: string;
  extraction: AudioExtraction;
  userRole: string;
  onClose: () => void;
  onReprocessed?: () => void;
}

const URGENCY_COLOR: Record<string, string> = {
  ALTA: "#EF4444",
  NORMAL: "#C9A84C",
  BAIXA: "#9BAFC5",
};

const VERTICAL_LABEL: Record<string, string> = {
  M_A: "M&A",
  MA_CROSS_BORDER: "M&A",
  REAL_ESTATE: "Real Estate",
  MINERACAO: "Mineração",
  CREDITO: "Crédito",
  INDEFINIDO: "Indefinido",
  OUTRO: "Outro",
};

export function AudioTranscriptionModal({
  intakeId,
  extraction,
  userRole,
  onClose,
  onReprocessed,
}: Props) {
  const [showTranscription, setShowTranscription] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessError, setReprocessError] = useState<string | null>(null);

  const canReprocess = ["ADMIN", "GESTAO"].includes(userRole);
  const urgency = extraction.urgencia ?? "NORMAL";
  const urgencyColor = URGENCY_COLOR[urgency] ?? "#C9A84C";
  const verticalLabel =
    VERTICAL_LABEL[extraction.vertical_detected ?? ""] ?? extraction.vertical_detected ?? "—";

  async function handleReprocess() {
    setReprocessing(true);
    setReprocessError(null);
    try {
      const res = await fetch("/api/ma/audio-intel/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intake_id: intakeId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao reprocessar");
      }
      onReprocessed?.();
      onClose();
    } catch (err) {
      setReprocessError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setReprocessing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(9,8,26,0.85)" }}
    >
      <div
        className="relative w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
        style={{ background: "#0F1729", border: "1px solid #1E2D4A" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid #1E2D4A" }}
        >
          <div className="flex items-center gap-2">
            <Mic size={16} style={{ color: "#C9A84C" }} />
            <span
              className="text-sm font-semibold"
              style={{ color: "#F5F1E8" }}
            >
              Intake via WhatsApp Audio
            </span>
            <span
              className="ml-2 px-2 py-0.5 rounded text-xs font-bold"
              style={{ background: `${urgencyColor}22`, color: urgencyColor, border: `1px solid ${urgencyColor}44` }}
            >
              {urgency}
            </span>
          </div>
          <button onClick={onClose} style={{ color: "#9BAFC5" }} className="hover:opacity-70">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Vertical + Ticket */}
          <div className="grid grid-cols-2 gap-3">
            <div
              className="rounded-lg p-3"
              style={{ background: "#0A0F1E", border: "1px solid #1E2D4A" }}
            >
              <p className="text-xs mb-1" style={{ color: "#9BAFC5" }}>Vertical</p>
              <p className="text-sm font-semibold" style={{ color: "#F5F1E8" }}>
                {verticalLabel}
              </p>
            </div>
            <div
              className="rounded-lg p-3"
              style={{ background: "#0A0F1E", border: "1px solid #1E2D4A" }}
            >
              <p className="text-xs mb-1" style={{ color: "#9BAFC5" }}>Ticket Estimado</p>
              <p className="text-sm font-semibold" style={{ color: "#F5F1E8" }}>
                {extraction.ticket_estimado ?? "Não mencionado"}
              </p>
            </div>
          </div>

          {/* Remetente */}
          {(extraction.sender_name || extraction.sender_phone) && (
            <div
              className="rounded-lg p-3"
              style={{ background: "#0A0F1E", border: "1px solid #1E2D4A" }}
            >
              <p className="text-xs mb-1" style={{ color: "#9BAFC5" }}>Remetente</p>
              <p className="text-sm" style={{ color: "#F5F1E8" }}>
                {extraction.sender_name ?? extraction.sender_phone}
                {extraction.dados_contato?.empresa && (
                  <span style={{ color: "#9BAFC5" }}> — {extraction.dados_contato.empresa}</span>
                )}
              </p>
            </div>
          )}

          {/* Resumo */}
          {extraction.resumo_executivo && (
            <div>
              <p className="text-xs mb-1" style={{ color: "#9BAFC5" }}>Resumo Executivo</p>
              <p className="text-sm leading-relaxed" style={{ color: "#F5F1E8" }}>
                {extraction.resumo_executivo}
              </p>
            </div>
          )}

          {/* Próximo passo */}
          {extraction.proximo_passo && (
            <div
              className="rounded-lg p-3"
              style={{ background: "#0A0F1E", border: "1px solid #243A66" }}
            >
              <p className="text-xs mb-1" style={{ color: "#9BAFC5" }}>Próximo Passo</p>
              <p className="text-sm" style={{ color: "#9BAFC5" }}>
                {extraction.proximo_passo}
              </p>
            </div>
          )}

          {/* Transcrição colapsível */}
          {extraction.transcription && (
            <div style={{ border: "1px solid #1E2D4A", borderRadius: 8 }}>
              <button
                onClick={() => setShowTranscription(!showTranscription)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                style={{ color: "#9BAFC5" }}
              >
                <span className="text-xs font-medium">Transcrição completa</span>
                {showTranscription ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showTranscription && (
                <div
                  className="px-4 pb-4 text-sm leading-relaxed"
                  style={{
                    color: "#9BAFC5",
                    borderTop: "1px solid #1E2D4A",
                    paddingTop: 12,
                  }}
                >
                  {extraction.transcription}
                </div>
              )}
            </div>
          )}

          {/* Status de erro */}
          {extraction.status === "failed" && extraction.error_message && (
            <div
              className="flex items-start gap-2 rounded-lg p-3"
              style={{ background: "#2D0A0A", border: "1px solid #EF444433" }}
            >
              <AlertTriangle size={14} style={{ color: "#EF4444", marginTop: 2, flexShrink: 0 }} />
              <p className="text-xs" style={{ color: "#EF4444" }}>
                {extraction.error_message}
              </p>
            </div>
          )}

          {reprocessError && (
            <p className="text-xs text-center" style={{ color: "#EF4444" }}>
              {reprocessError}
            </p>
          )}
        </div>

        {/* Footer */}
        {canReprocess && (
          <div
            className="flex justify-end px-5 py-4"
            style={{ borderTop: "1px solid #1E2D4A" }}
          >
            <button
              onClick={handleReprocess}
              disabled={reprocessing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition-opacity"
              style={{ background: "#162744", color: "#C9A84C", border: "1px solid #243A66" }}
            >
              <RefreshCw size={13} className={reprocessing ? "animate-spin" : ""} />
              {reprocessing ? "Reprocessando..." : "Reprocessar Áudio"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
