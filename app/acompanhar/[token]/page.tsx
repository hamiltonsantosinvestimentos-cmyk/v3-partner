import { notFound } from "next/navigation";
import { AcompanharPropostaClient } from "@/components/proposta/acompanhar-proposta-client";

// Página pública — sem autenticação requerida
export const revalidate = 30;

async function getPropostaData(token: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
    const res = await fetch(`${baseUrl}/api/acompanhar/${token}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function AcompanharPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proposal = await getPropostaData(token);

  if (!proposal) notFound();

  return <AcompanharPropostaClient proposal={proposal} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const proposal = await getPropostaData(token);

  if (!proposal) {
    return { title: "Proposta não encontrada — V3 Partners" };
  }

  return {
    title: `Proposta de ${proposal.client_name} — V3 Partners`,
    description: `Acompanhe o status da sua proposta de crédito (${proposal.code}) com a V3 Partners.`,
  };
}
