import { createClient } from "@supabase/supabase-js";
import { MeusContratosClient } from "./meus-contratos-client";
import { notFound } from "next/navigation";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

export default async function MeusContratosPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Busca pelo token de assinatura do cliente
  const { data, error } = await supabase
    .from("contratos_mandato")
    .select("id, status, client_name, client_email, credit_line, deal_value, commission_perc, proposal_code, created_at, expires_at, signed_at, v3_signed_at, v3_signer_name, testemunha_nome, testemunha_signed_at, testemunha2_nome, testemunha2_signed_at, contrato_url, contrato_pdf_url, client_doc_url")
    .eq("token", token)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  return <MeusContratosClient contrato={data} />;
}
