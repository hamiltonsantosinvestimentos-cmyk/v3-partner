import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const proposal_id = searchParams.get("proposal_id");
  if (!proposal_id) return NextResponse.json({ contrato: null });

  const { data } = await supabase
    .from("contratos_mandato")
    .select("id, token, status, signed_at, v3_signed_at, v3_signer_name, testemunha_signed_at, testemunha_nome, client_name, credit_line, proposal_code, created_at")
    .eq("proposal_id", proposal_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ contrato: data ?? null });
}
