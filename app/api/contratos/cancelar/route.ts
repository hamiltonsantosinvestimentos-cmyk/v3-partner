import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const body = await req.json();
  const { proposal_id, contrato_id } = body;
  if (!proposal_id && !contrato_id) {
    return NextResponse.json({ error: "proposal_id ou contrato_id obrigatório" }, { status: 400 });
  }

  let query = supabase
    .from("contratos_mandato")
    .select("id, status")
    .not("status", "in", '("ASSINADO","CANCELADO","EXPIRADO")');

  if (contrato_id) {
    query = query.eq("id", contrato_id);
  } else {
    query = query.eq("proposal_id", proposal_id).order("created_at", { ascending: false }).limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Nenhum contrato ativo encontrado" }, { status: 404 });
  }

  const { error: updateErr } = await supabase
    .from("contratos_mandato")
    .update({ status: "CANCELADO" })
    .eq("id", data.id);

  if (updateErr) {
    return NextResponse.json({ error: "Erro ao cancelar contrato" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
