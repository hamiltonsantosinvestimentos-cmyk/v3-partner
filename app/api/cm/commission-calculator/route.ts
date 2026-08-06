import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { calculateCommission, type SideCascadeInput } from "@/lib/commission-calculator";

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authorize(supabaseUser: { id: string } | null) {
  if (!supabaseUser) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const { data: profile } = await svc().from("profiles").select("role").eq("id", supabaseUser.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role ?? "")) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { userId: supabaseUser.id };
}

function parseSide(raw: unknown, label: string): { value: SideCascadeInput | null; error: string | null } {
  if (!raw || typeof raw !== "object") return { value: null, error: `Campo obrigatório: ${label}` };
  const { side_pct, fee_v3_pct, mandatario_pct } = raw as Record<string, unknown>;
  if (side_pct === undefined || side_pct === null || side_pct === "") return { value: null, error: `Campo obrigatório: ${label}.side_pct` };
  return {
    value: {
      side_pct: Number(side_pct),
      fee_v3_pct: fee_v3_pct != null && fee_v3_pct !== "" ? Number(fee_v3_pct) : 0,
      mandatario_pct: mandatario_pct != null && mandatario_pct !== "" ? Number(mandatario_pct) : 0,
    },
    error: null,
  };
}

/** Historico das ultimas simulacoes da Mesa, mais recente primeiro. */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const auth = await authorize(user);
  if (auth.error) return auth.error;

  const { data, error } = await svc()
    .from("cm_commission_simulations")
    .select("id, listing_id, deal_label, valor_face, fee_total_pct, is_recorrente, meses_recorrencia, resultado, created_by, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ simulations: data ?? [] });
}

/**
 * Calcula e persiste uma simulacao (log de auditoria da Mesa). Fase 3:
 * NENHUMA validacao de soma/percentual bloqueia esta rota, a unica coisa
 * exigida e valor_face e comissao_total_pct positivos, o resto (inclusive
 * Intermediarios negativo) e aceito e gravado como esta, a decisao de
 * bloquear so a EXPORTACAO do PDF daquele lado fica no cliente
 * (hasNegativeResidual em lib/commission-calculator.ts).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const auth = await authorize(user);
  if (auth.error) return auth.error;

  const body = await req.json();
  const {
    listing_id,
    deal_label,
    valor_face,
    desagio_pct,
    titulares_pct,
    is_recorrente,
    meses_recorrencia,
    comissao_total_pct,
    buy_side: buySideRaw,
    sell_side: sellSideRaw,
    deducao_bancaria_pct,
  } = body as Record<string, unknown>;

  if (!valor_face || Number(valor_face) <= 0) {
    return NextResponse.json({ error: "Campo obrigatório: valor_face" }, { status: 422 });
  }
  if (!comissao_total_pct || Number(comissao_total_pct) <= 0) {
    return NextResponse.json({ error: "Campo obrigatório: comissao_total_pct" }, { status: 422 });
  }

  const buySide = parseSide(buySideRaw, "buy_side");
  if (buySide.error) return NextResponse.json({ error: buySide.error }, { status: 422 });
  const sellSide = parseSide(sellSideRaw, "sell_side");
  if (sellSide.error) return NextResponse.json({ error: sellSide.error }, { status: 422 });

  const resultado = calculateCommission({
    valor_face: Number(valor_face),
    desagio_pct: desagio_pct != null ? Number(desagio_pct) : 0,
    titulares_pct: titulares_pct != null ? Number(titulares_pct) : 0,
    is_recorrente: Boolean(is_recorrente),
    meses_recorrencia: meses_recorrencia != null ? Number(meses_recorrencia) : 1,
    comissao_total_pct: Number(comissao_total_pct),
    buy_side: buySide.value!,
    sell_side: sellSide.value!,
    deducao_bancaria_pct: deducao_bancaria_pct != null ? Number(deducao_bancaria_pct) : 6,
  });

  const { data: record, error: insertError } = await svc()
    .from("cm_commission_simulations")
    .insert({
      listing_id: listing_id || null,
      deal_label: deal_label || null,
      valor_face: Number(valor_face),
      desagio_pct: desagio_pct != null ? Number(desagio_pct) : null,
      is_recorrente: Boolean(is_recorrente),
      meses_recorrencia: meses_recorrencia != null ? Number(meses_recorrencia) : 1,
      fee_total_pct: Number(comissao_total_pct),
      buy_side_pct: buySide.value!.side_pct,
      sell_side_pct: sellSide.value!.side_pct,
      fee_v3_buy_pct: buySide.value!.fee_v3_pct,
      fee_v3_sell_pct: sellSide.value!.fee_v3_pct,
      buy_mandatario_input_value: buySide.value!.mandatario_pct,
      buy_mandatario_input_unit: "pct",
      sell_mandatario_input_value: sellSide.value!.mandatario_pct,
      sell_mandatario_input_unit: "pct",
      deducao_bancaria_pct: deducao_bancaria_pct != null ? Number(deducao_bancaria_pct) : 6,
      resultado,
      created_by: auth.userId,
    })
    .select("id, created_at")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ id: record.id, created_at: record.created_at, resultado });
}
