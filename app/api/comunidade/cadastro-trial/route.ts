import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  try {
    const { dados } = await req.json();

    const y = new Date().getFullYear().toString().slice(-2);
    const n = Math.floor(Math.random() * 90000) + 10000;
    const codigoTrial = `TRIAL-${y}-${n}`;

    const { error } = await serviceClient()
      .from("comunidade_prospects")
      .insert({
        codigo: codigoTrial,
        tipo: "trial",
        perfil: dados ?? {},
      });

    if (error) {
      console.error("[cadastro-trial] Erro Supabase:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, codigoTrial });
  } catch (err) {
    console.error("[cadastro-trial] Erro:", err);
    return NextResponse.json({ ok: false, error: "Erro ao processar requisição" }, { status: 500 });
  }
}
