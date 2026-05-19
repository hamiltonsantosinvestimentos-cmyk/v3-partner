"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

const DISMISS_KEY = "crm-cold-leads-dismissed-at";
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface ColdLeadAlertProps {
  onShowColdLeads?: () => void;
}

export function ColdLeadAlert({ onShowColdLeads }: ColdLeadAlertProps) {
  const [count, setCount] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verifica se foi dispensado nas últimas 24h
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < DISMISS_TTL_MS) {
        setDismissed(true);
        setLoading(false);
        return;
      }
    }

    // Busca contagem de leads frios
    fetch("/api/crm/cold-leads-count")
      .then((r) => r.json())
      .then((json) => {
        setCount(json.count ?? 0);
      })
      .catch(() => setCount(0))
      .finally(() => setLoading(false));
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  function handleShowColdLeads() {
    // Persiste o filtro no localStorage para o CRM ler
    localStorage.setItem("crm-filter-cold", "true");
    if (onShowColdLeads) {
      onShowColdLeads();
    } else {
      // Emite evento customizado para o CRMClient escutar
      window.dispatchEvent(new CustomEvent("crm:filter-cold-leads"));
    }
    handleDismiss();
  }

  if (loading || dismissed || count === null || count === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "rgba(201,168,76,0.12)",
        border: "1px solid rgba(201,168,76,0.4)",
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <AlertTriangle
        className="w-5 h-5"
        style={{ color: "#E8C97A", flexShrink: 0 }}
      />
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: "#E8C97A", minWidth: 200 }}>
        Você tem{" "}
        <strong>{count}</strong>{" "}
        lead{count !== 1 ? "s" : ""} sem contato há mais de 15 dias
      </span>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <button
          onClick={handleShowColdLeads}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid rgba(201,168,76,0.5)",
            background: "rgba(201,168,76,0.2)",
            color: "#E8C97A",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Ver leads frios
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Fechar alerta"
          style={{
            background: "none",
            border: "none",
            color: "#7A8FA8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            padding: 4,
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
