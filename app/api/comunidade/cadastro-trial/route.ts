import { NextRequest, NextResponse } from "next/server";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export async function POST(req: NextRequest) {
  try {
    const { dados } = await req.json();

    if (IS_DEMO) {
      await new Promise((r) => setTimeout(r, 500));
      const y = new Date().getFullYear().toString().slice(-2);
      const n = Math.floor(Math.random() * 90000) + 10000;
      const codigoTrial = `TRIAL-${y}-${n}`;
      return NextResponse.json({ ok: true, codigoTrial });
    }

    // TODO: integrar com Supabase — validar com Robson antes de produção
    return NextResponse.json({ ok: true, mode: "production" });
  } catch {
    return NextResponse.json({ ok: false, error: "Erro ao processar requisição" }, { status: 500 });
  }
}
