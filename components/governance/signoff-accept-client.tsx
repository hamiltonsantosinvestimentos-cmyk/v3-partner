"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  token: string;
  requestedOfName: string;
}

export function SignoffAcceptClient({ token, requestedOfName }: Props) {
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setBusy(decision);
    setError(null);
    try {
      const res = await fetch(`/api/public/governance-signoff/${token}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao registrar decisão");
      setDone(decision);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        {done === "approved" ? (
          <CheckCircle2 size={40} color="#C9A84C" style={{ margin: "0 auto 16px" }} />
        ) : (
          <XCircle size={40} color="#9BAFC5" style={{ margin: "0 auto 16px" }} />
        )}
        <p style={{ color: "#F5F1E8", fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          {done === "approved" ? "Aprovado com sucesso" : "Recusa registrada"}
        </p>
        <p style={{ color: "#9BAFC5", fontSize: 12.5 }}>Sua decisão foi registrada com data, hora e IP de acesso.</p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: "#9BAFC5", fontSize: 12.5, marginBottom: 16 }}>
        Olá, {requestedOfName}. Confirme sua decisão abaixo. Ambas as opções ficam registradas de forma auditável.
      </p>
      <textarea
        placeholder="Observação (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{
          width: "100%", minHeight: 70, background: "#162744", border: "1px solid #243A66",
          borderRadius: 6, color: "#F5F1E8", fontSize: 12.5, padding: 10, marginBottom: 16,
          fontFamily: "'DM Sans', sans-serif", resize: "vertical",
        }}
      />
      {error && (
        <p style={{ color: "#E8C97A", fontSize: 12, marginBottom: 12 }}>{error}</p>
      )}
      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={() => decide("approved")}
          disabled={busy !== null}
          style={{
            flex: 1, background: "#C9A84C", color: "#09081A", fontWeight: 700, fontSize: 13,
            padding: "12px 0", borderRadius: 6, border: "none", cursor: "pointer",
          }}
        >
          {busy === "approved" ? <Loader2 size={16} style={{ display: "inline", animation: "spin 1s linear infinite" }} /> : "Aprovar"}
        </button>
        <button
          onClick={() => decide("rejected")}
          disabled={busy !== null}
          style={{
            flex: 1, background: "transparent", color: "#9BAFC5", fontWeight: 700, fontSize: 13,
            padding: "12px 0", borderRadius: 6, border: "1px solid #243A66", cursor: "pointer",
          }}
        >
          {busy === "rejected" ? <Loader2 size={16} style={{ display: "inline", animation: "spin 1s linear infinite" }} /> : "Recusar"}
        </button>
      </div>
    </div>
  );
}
