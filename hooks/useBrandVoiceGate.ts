"use client";
import { useState, useCallback } from "react";

export type ContextType = "institucional" | "comunidade";

export interface VoiceGateResult {
  passed: boolean;
  score: number;
  archetype_match: string;
  issues: string[];
  suggestions: string[];
  audit_id?: string;
}

export function useBrandVoiceGate() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VoiceGateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(async (
    text: string,
    contextType: ContextType,
    options?: { saveAudit?: boolean }
  ): Promise<VoiceGateResult | null> => {
    if (!text?.trim()) return null;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/brand/voice-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          context_type: contextType,
          save_audit: options?.saveAudit ?? true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao validar voz da marca");
        return null;
      }

      setResult(data);
      return data as VoiceGateResult;
    } catch {
      setError("Erro de conexao ao validar voz");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { validate, loading, result, error, reset };
}
