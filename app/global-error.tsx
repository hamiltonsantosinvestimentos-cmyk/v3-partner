"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ background: "#09081A", margin: 0, fontFamily: "sans-serif" }}>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#F0ECE4",
          padding: 24,
          textAlign: "center",
          gap: 12,
        }}>
          <p style={{ fontSize: 11, color: "#7A8FA8", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>
            Erro crítico detectado
          </p>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#F0ECE4", margin: 0 }}>
            {error?.message || "Erro desconhecido"}
          </h2>
          {error?.digest && (
            <p style={{ fontSize: 11, color: "#C9A84C", margin: 0 }}>Digest: {error.digest}</p>
          )}
          <pre style={{
            fontSize: 10,
            color: "#7A8FA8",
            background: "#111F35",
            padding: "12px 16px",
            borderRadius: 8,
            maxWidth: "90vw",
            overflowX: "auto",
            textAlign: "left",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: 300,
          }}>
            {error?.stack?.slice(0, 1000) || "sem stack"}
          </pre>
          <button onClick={reset} style={{
            padding: "10px 24px",
            background: "#C9A84C",
            color: "#09081A",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}>
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
