import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  try {
    const { ativo, codigo } = await req.json();

    const { error } = await serviceClient()
      .from("comunidade_prospects")
      .insert({
        codigo: codigo ?? `ATIVO-${Date.now()}`,
        tipo: "ativo",
        perfil: ativo ?? {},
      });

    if (error) {
      console.error("[submeter-ativo] Erro Supabase:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, codigo });
  } catch (err) {
    console.error("[submeter-ativo] Erro:", err);
    return NextResponse.json({ ok: false, error: "Erro ao processar requisição" }, { status: 500 });
  }
}
