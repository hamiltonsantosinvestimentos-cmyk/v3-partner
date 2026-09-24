import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { enviarRelatorioMensal, periodoDoMes } from "@/lib/relatorio-mensal-partners";

export const maxDuration = 300;

// Todo dia 1 (vercel.json): relatório do mês anterior para cada partner + consolidado para
// os sócios. ?mes=YYYY-MM e ?forcar=1 para reprocessar. Lógica em lib/relatorio-mensal-partners.ts.
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const periodo = periodoDoMes(searchParams.get("mes"));
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  try {
    const r = await enviarRelatorioMensal(db, periodo, { forcar: searchParams.get("forcar") === "1" });
    return NextResponse.json({ periodo: periodo.chave, ...r });
  } catch (e) {
    console.error("[relatorio-mensal-partners]", e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
