import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  let query = supabase
    .from("contratos_mandato")
    .select("id, token, status, proposal_code, client_name, client_email, credit_line, deal_value, commission_perc, expires_at, created_at, signed_at, v3_signed_at, v3_signer_name, testemunha_nome, testemunha_signed_at, testemunha2_nome, testemunha2_signed_at, contrato_url")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && status !== "TODOS") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar contratos" }, { status: 500 });
  }

  let contratos = data ?? [];

  if (q) {
    const lower = q.toLowerCase();
    contratos = contratos.filter(
      (c) =>
        c.client_name?.toLowerCase().includes(lower) ||
        c.proposal_code?.toLowerCase().includes(lower) ||
        c.client_email?.toLowerCase().includes(lower)
    );
  }

  return NextResponse.json({ contratos });
}
