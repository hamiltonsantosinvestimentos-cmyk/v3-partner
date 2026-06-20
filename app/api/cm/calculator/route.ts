import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { valor_face, desagio, tir, prazo_meses, commission_percent } = body;

  if (!valor_face) {
    return NextResponse.json({ error: "Campo obrigatório: valor_face" }, { status: 422 });
  }
  if (!desagio && !tir) {
    return NextResponse.json({ error: "Informe desagio OU tir" }, { status: 422 });
  }

  const { data: financials } = await svc().rpc("calculate_cm_financials", {
    p_valor_face: Number(valor_face),
    p_desagio: desagio ? Number(desagio) : null,
    p_tir: tir ? Number(tir) : null,
    p_prazo_meses: prazo_meses ? Number(prazo_meses) : 12,
  });

  let commission = null;
  if (commission_percent) {
    const { data: split } = await svc().rpc("calculate_cm_commission_split", {
      p_valor_face: Number(valor_face),
      p_commission_percent: Number(commission_percent),
    });
    commission = split;
  }

  return NextResponse.json({ financials, commission });
}
