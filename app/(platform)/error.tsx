"use client";

import { useEffect } from "react";

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[V3 PLATFORM ERROR]", error?.message, error?.stack);
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "#09081A",
      color: "#F0ECE4",
      padding: 24,
      fontFamily: "sans-serif",
      textAlign: "center",
      gap: 16,
    }}>
      <p style={{ fontSize: 12, color: "#7A8FA8", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        Erro detectado
      </p>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#F0ECE4", margin: 0 }}>
        {error?.message || "Erro desconhecido"}
      </h2>
      {error?.digest && (
        <p style={{ fontSize: 11, color: "#7A8FA8", margin: 0 }}>
          Código: {error.digest}
        </p>
      )}
      <pre style={{
        fontSize: 10,
        color: "#7A8FA8",
        background: "#111F35",
        padding: "12px 16px",
        borderRadius: 8,
        maxWidth: "100%",
        overflowX: "auto",
        textAlign: "left",
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
        maxHeight: 200,
      }}>
        {error?.stack?.slice(0, 800) || "sem stack trace"}
      </pre>
      <button
        onClick={reset}
        style={{
          marginTop: 8,
          padding: "10px 24px",
          background: "#C9A84C",
          color: "#09081A",
          border: "none",
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
