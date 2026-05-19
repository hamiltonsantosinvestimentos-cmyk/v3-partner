"use client";

import React, { useState, useEffect } from "react";
import { X, Star, MessageSquare, CheckCircle2 } from "lucide-react";

interface NpsModalProps {
  commissionId: string;
  productName?: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

function getScoreColor(score: number): string {
  if (score <= 6) return "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30";
  if (score <= 8) return "bg-amber-500/20 border-amber-500/50 text-amber-400 hover:bg-amber-500/30";
  return "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30";
}

function getScoreSelectedColor(score: number): string {
  if (score <= 6) return "bg-red-500 border-red-500 text-white";
  if (score <= 8) return "bg-amber-500 border-amber-500 text-[#09081A]";
  return "bg-emerald-500 border-emerald-500 text-white";
}

export function NpsModal({ commissionId, productName, onClose, onSubmitted }: NpsModalProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Dismiss on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleDismiss();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(`nps-dismissed-${commissionId}`, "1");
    }
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected === null) {
      setError("Selecione uma nota de 0 a 10.");
      return;
    }
    setError("");
    setSending(true);

    try {
      const res = await fetch("/api/nps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commission_id: commissionId,
          score: selected,
          comment: comment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setError(d.error || "Erro ao enviar. Tente novamente.");
        return;
      }

      // Mark as responded in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(`nps-responded-${commissionId}`, "1");
      }

      setSubmitted(true);
      onSubmitted?.();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-[#111F35] border border-[#243A66] rounded-2xl shadow-2xl z-10 overflow-hidden">
        {/* Header strip */}
        <div className="h-1 w-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A]" />

        <div className="p-6">
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>

          {submitted ? (
            /* ── Thank you state ── */
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div
                className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-4"
                style={{ animation: "scaleIn 0.4s ease-out" }}
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-[#F0ECE4] mb-2">
                Obrigado pelo feedback!
              </h3>
              <p className="text-sm text-[#7A8FA8]">
                Sua avaliação ajuda a V3 Partners a melhorar continuamente.
              </p>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors"
              >
                Fechar
              </button>
            </div>
          ) : (
            /* ── Survey form ── */
            <form onSubmit={handleSubmit}>
              {/* Icon */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center">
                  <Star className="w-5 h-5 text-[#C9A84C]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#F0ECE4]">
                    Avalie este deal
                  </h3>
                  <p className="text-xs text-[#7A8FA8]">
                    Leva menos de 30 segundos
                  </p>
                </div>
              </div>

              <p className="text-sm text-[#F0ECE4] mb-4">
                Como foi sua experiência com este deal?
                {productName && (
                  <span className="block text-xs text-[#C9A84C] mt-1 font-semibold">
                    {productName}
                  </span>
                )}
              </p>

              {/* Score buttons 0-10 */}
              <div className="grid grid-cols-11 gap-1 mb-3">
                {Array.from({ length: 11 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(i)}
                    className={`
                      h-9 w-full rounded-lg text-sm font-bold border transition-all
                      ${selected === i
                        ? getScoreSelectedColor(i)
                        : getScoreColor(i)
                      }
                    `}
                  >
                    {i}
                  </button>
                ))}
              </div>

              {/* Labels */}
              <div className="flex justify-between text-[10px] text-[#7A8FA8] mb-5">
                <span>Muito ruim</span>
                <span>Excelente</span>
              </div>

              {/* Comment */}
              <div className="mb-4">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#7A8FA8] mb-1.5">
                  <MessageSquare className="w-3 h-3" />
                  Comentário (opcional)
                </label>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Conte mais sobre sua experiência..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-[#0A1628] border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="flex-1 h-10 rounded-lg border border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] text-sm font-semibold transition-colors"
                >
                  Agora não
                </button>
                <button
                  type="submit"
                  disabled={sending || selected === null}
                  className="flex-1 h-10 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {sending ? "Enviando..." : "Enviar avaliação"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
