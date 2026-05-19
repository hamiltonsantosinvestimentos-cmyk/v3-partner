import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(
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

  // Busca o lead pelo client_token
  const { data: lead, error } = await supabase
    .from("crm_leads")
    .select("client_name, status, product_interest, created_at, updated_at, partner_id, client_token")
    .eq("client_token", token)
    .single();

  if (error || !lead) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  // Busca dados públicos do partner
  let partner_name = "";
  let partner_whatsapp = "";

  if (lead.partner_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("id", lead.partner_id)
      .single();

    if (profile) {
      partner_name = profile.full_name ?? "";
      partner_whatsapp = profile.phone ?? "";
    }
  }

  return NextResponse.json({
    client_name: lead.client_name,
    status: lead.status,
    product_interest: lead.product_interest,
    created_at: lead.created_at,
    updated_at: lead.updated_at,
    partner_name,
    partner_whatsapp,
  });
}
