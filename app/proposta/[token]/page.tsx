import { notFound } from "next/navigation";
import { PropostaPainelClient } from "@/components/proposta/proposta-painel-client";

// Página pública — fora do grupo (platform), sem autenticação requerida

export const revalidate = 30; // ISR leve — revalida a cada 30s

async function getPropostaData(token: string) {
  try {
    // Chama a API interna com URL absoluta (necessário em Server Components)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
    const res = await fetch(`${baseUrl}/api/proposta/${token}`, {
      next: { revalidate: 30 },
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function PropostaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lead = await getPropostaData(token);

  if (!lead) notFound();

  return <PropostaPainelClient lead={lead} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const lead = await getPropostaData(token);

  if (!lead) {
    return { title: "Proposta não encontrada — V3 Partners" };
  }

  return {
    title: `Proposta de ${lead.client_name} — V3 Partners`,
    description: `Acompanhe o andamento da sua proposta ${lead.product_interest ? `de ${lead.product_interest}` : ""} com a V3 Partners.`,
  };
}
