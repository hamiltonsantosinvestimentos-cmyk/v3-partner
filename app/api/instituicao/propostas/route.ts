import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nome = searchParams.get("nome");

  if (!nome) {
    return NextResponse.json({ error: "Nome da instituição obrigatório." }, { status: 400 });
  }

  const supabase = serviceClient();

  const { data, error } = await supabase
    .from("credit_desk_proposals")
    .select(
      "id, code, client_name, credit_line, requested_value, approved_value, stage, status, created_at, updated_at, pending_reason, instituicao_encaminhada"
    )
    .in("stage", ["ANALISE", "PENDENCIA"])
    .ilike("instituicao_encaminhada", `%${nome}%`)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar propostas." }, { status: 500 });
  }

  return NextResponse.json({ propostas: data ?? [] });
}
