import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { AcompanharPropostaClient } from "@/components/proposta/acompanhar-proposta-client";

// Página pública — sem autenticação requerida
export const revalidate = 30;

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getPropostaData(token: string) {
  const supabase = serviceClient();

  const { data: proposal, error } = await supabase
    .from("credit_desk_proposals")
    .select(
      "id, code, client_name, credit_line, requested_value, approved_value, stage, status, created_at, updated_at, partner_id, pending_reason, pending_resolved_at"
    )
    .eq("id", token)
    .single();

  if (error || !proposal) return null;

  let partner_name = "";
  let partner_whatsapp = "";

  if (proposal.partner_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", proposal.partner_id)
      .single();
    if (profile) {
      partner_name = (profile.full_name as string) ?? "";
      partner_whatsapp = (profile.phone as string) ?? "";
    }
  }

  return {
    code: proposal.code as string,
    client_name: proposal.client_name as string,
    credit_line: proposal.credit_line as string,
    requested_value: proposal.requested_value as number,
    approved_value: (proposal.approved_value as number | null) ?? null,
    stage: (proposal.stage as string) ?? "RECEBIDO",
    status: (proposal.status as string) ?? "PENDING",
    created_at: proposal.created_at as string,
    updated_at: proposal.updated_at as string,
    partner_name,
    partner_whatsapp,
    pending_reason: (proposal.pending_reason as string | null) ?? null,
    pending_resolved_at: (proposal.pending_resolved_at as string | null) ?? null,
  };
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
