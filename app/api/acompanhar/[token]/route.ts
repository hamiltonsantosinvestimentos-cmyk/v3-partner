import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const supabase = serviceClient();

  // Token = proposal ID (UUID não-adivinável)
  const { data: proposal, error } = await supabase
    .from("credit_desk_proposals")
    .select(
      "id, code, client_name, credit_line, requested_value, approved_value, stage, status, created_at, updated_at, partner_id, pending_reason, pending_resolved_at"
    )
    .eq("id", token)
    .single();

  if (error || !proposal) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  // Dados do partner responsável
  let partner_name = "";
  let partner_whatsapp = "";

  if (proposal.partner_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", proposal.partner_id)
      .single();
    if (profile) {
      partner_name = profile.full_name ?? "";
      partner_whatsapp = profile.phone ?? "";
    }
  }

  // Retorna apenas dados seguros para o cliente (sem CPF, notas internas, metadata)
  return NextResponse.json({
    code: proposal.code,
    client_name: proposal.client_name,
    credit_line: proposal.credit_line,
    requested_value: proposal.requested_value,
    approved_value: proposal.approved_value,
    stage: proposal.stage,
    status: proposal.status,
    created_at: proposal.created_at,
    updated_at: proposal.updated_at,
    partner_name,
    partner_whatsapp,
    pending_reason: proposal.pending_reason ?? null,
    pending_resolved_at: proposal.pending_resolved_at ?? null,
  });
}
