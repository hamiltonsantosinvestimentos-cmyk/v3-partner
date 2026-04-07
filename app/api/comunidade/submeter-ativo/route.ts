import { NextRequest, NextResponse } from "next/server";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export async function POST(req: NextRequest) {
  try {
    const { ativo, codigo } = await req.json();

    if (IS_DEMO) {
      await new Promise((r) => setTimeout(r, 500));
      return NextResponse.json({ ok: true, mode: "demo", codigo });
    }

    // TODO: integrar com Supabase — validar com Robson antes de produção
    return NextResponse.json({ ok: true, mode: "production", codigo });
  } catch {
    return NextResponse.json({ ok: false, error: "Erro ao processar requisição" }, { status: 500 });
  }
}
