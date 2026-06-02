"use client";
import { useSearchParams } from "next/navigation";

export default function OptoutPageClient() {
  const params = useSearchParams();
  const descadastrado = params.get("descadastrado") === "1";
  const email = params.get("email") ?? "";
  const erro = params.get("erro");

  return (
    <div style={{ minHeight: "100vh", background: "#09081A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "DM Sans, Arial, sans-serif" }}>
      <div style={{ maxWidth: 480, width: "100%", margin: "0 20px", background: "#111F35", border: "1px solid #243A66", borderRadius: 16, padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          {descadastrado ? "✅" : erro ? "❌" : "📧"}
        </div>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#C9A84C", textTransform: "uppercase", margin: "0 0 12px" }}>
          V3 PARTNERS
        </p>

        {descadastrado ? (
          <>
            <h1 style={{ color: "#F0ECE4", fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>
              Descadastro realizado
            </h1>
            <p style={{ color: "#7A8FA8", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>
              O e-mail <strong style={{ color: "#F0ECE4" }}>{email}</strong> foi removido da nossa lista de comunicações.
              Você não receberá mais campanhas da V3 Partners.
            </p>
            <p style={{ color: "#7A8FA8", fontSize: 12 }}>
              Se foi um engano, entre em contato: <a href="mailto:operacional@v3partners.com.br" style={{ color: "#C9A84C" }}>operacional@v3partners.com.br</a>
            </p>
          </>
        ) : erro ? (
          <>
            <h1 style={{ color: "#F0ECE4", fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>
              Link inválido
            </h1>
            <p style={{ color: "#7A8FA8", fontSize: 14, lineHeight: 1.6 }}>
              Este link de descadastro não é válido ou já foi utilizado.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ color: "#F0ECE4", fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}>
              Processando...
            </h1>
            <p style={{ color: "#7A8FA8", fontSize: 14 }}>Aguarde um momento.</p>
          </>
        )}
      </div>
    </div>
  );
}
