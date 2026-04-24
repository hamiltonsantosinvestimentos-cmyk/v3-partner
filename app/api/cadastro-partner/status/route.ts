import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET público — verifica status do cadastro pelo e-mail
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });
  }

  const svc = serviceClient();
  const { data, error } = await svc
    .from("partner_registrations")
    .select("id, status, plano, created_at, updated_at, observacao, nome_completo, razao_social")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    status: data.status,
    plano: data.plano,
    nome: data.nome_completo ?? data.razao_social ?? null,
    observacao: data.status === "REPROVADO" ? data.observacao : null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  });
}
