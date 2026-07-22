import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient as sc } from "@supabase/supabase-js";
import { SignoffAcceptClient } from "@/components/governance/signoff-accept-client";

export const dynamic = "force-dynamic";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface PageProps { params: Promise<{ token: string }> }

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "V3 Partners · Pedido de Aprovação",
    description: "Aceite formal de governança. Acesso restrito ao destinatário.",
    robots: "noindex, nofollow",
  };
}

export default async function AceitePage({ params }: PageProps) {
  const { token } = await params;
  const svc = serviceClient();

  const { data: signoff } = await svc
    .from("governance_signoffs")
    .select("subject, description, requested_of_name, decision, decided_at")
    .eq("token", token)
    .single();

  if (!signoff) notFound();

  return (
    <div style={{ minHeight: "100vh", background: "#09081A", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 480, width: "100%", background: "#13223A", border: "1px solid #243A66", borderRadius: 12, padding: 36 }}>
        <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style={{ height: 36, marginBottom: 20 }} />
        <div style={{ color: "#E8C97A", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          Governança &middot; Pedido de Aprovação
        </div>
        <h1 style={{ color: "#F5F1E8", fontSize: 19, fontWeight: 800, marginBottom: 12 }}>{signoff.subject}</h1>
        <p style={{ color: "#9BAFC5", fontSize: 13, lineHeight: 1.6, marginBottom: 24, whiteSpace: "pre-wrap" }}>{signoff.description}</p>

        {signoff.decision === "pending" ? (
          <SignoffAcceptClient token={token} requestedOfName={signoff.requested_of_name} />
        ) : (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p style={{ color: "#F5F1E8", fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
              {signoff.decision === "approved" ? "Já aprovado" : "Já recusado"}
            </p>
            <p style={{ color: "#9BAFC5", fontSize: 12 }}>
              Decisão registrada em {signoff.decided_at ? new Date(signoff.decided_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
