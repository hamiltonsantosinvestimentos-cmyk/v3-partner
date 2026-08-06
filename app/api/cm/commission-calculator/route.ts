import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { calculateCommission, type MandatarioInput } from "@/lib/commission-calculator";

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

function parseMandatarioInput(raw: unknown, label: string): { value: MandatarioInput | null; error: string | null } {
  if (!raw || typeof raw !== "object") return { value: null, error: `Campo obrigatório: ${label}` };
  const { value, unit } = raw as Record<string, unknown>;
  if (value === undefined || value === null || value === "") return { value: null, error: `Campo obrigatório: ${label}.value` };
  if (unit !== "pct" && unit !== "valor") return { value: null, error: `${label}.unit precisa ser "pct" ou "valor"` };
  return { value: { value: Number(value), unit }, error: null };
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

/** Calcula e persiste uma nova simulacao (log de auditoria da Mesa). */
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
    is_recorrente,
    meses_recorrencia,
    fee_total_pct,
    fee_v3_pct,
    buy_side_pct,
    sell_side_pct,
    buy_mandatario_input: buyMandatarioRaw,
    sell_mandatario_input: sellMandatarioRaw,
    deducao_bancaria_pct,
  } = body as Record<string, unknown>;

  if (!valor_face || Number(valor_face) <= 0) {
    return NextResponse.json({ error: "Campo obrigatório: valor_face" }, { status: 422 });
  }
  if (!fee_total_pct || Number(fee_total_pct) <= 0) {
    return NextResponse.json({ error: "Campo obrigatório: fee_total_pct" }, { status: 422 });
  }
  if (fee_v3_pct === undefined || fee_v3_pct === null || fee_v3_pct === "") {
    return NextResponse.json({ error: "Campo obrigatório: fee_v3_pct (a Mesa define manualmente por operação)" }, { status: 422 });
  }
  if (buy_side_pct === undefined || sell_side_pct === undefined) {
    return NextResponse.json({ error: "Campos obrigatórios: buy_side_pct e sell_side_pct" }, { status: 422 });
  }

  const somaSplit = Number(buy_side_pct) + Number(sell_side_pct) + Number(fee_v3_pct);
  if (Math.abs(somaSplit - 100) > 0.01) {
    return NextResponse.json(
      { error: `buy_side_pct + sell_side_pct + fee_v3_pct deve somar 100% (soma atual: ${somaSplit.toFixed(2)}%)` },
      { status: 422 }
    );
  }

  const buyMandatario = parseMandatarioInput(buyMandatarioRaw, "buy_mandatario_input");
  if (buyMandatario.error) return NextResponse.json({ error: buyMandatario.error }, { status: 422 });
  const sellMandatario = parseMandatarioInput(sellMandatarioRaw, "sell_mandatario_input");
  if (sellMandatario.error) return NextResponse.json({ error: sellMandatario.error }, { status: 422 });

  const resultado = calculateCommission({
    valor_face: Number(valor_face),
    desagio_pct: desagio_pct != null ? Number(desagio_pct) : 0,
    is_recorrente: Boolean(is_recorrente),
    meses_recorrencia: meses_recorrencia != null ? Number(meses_recorrencia) : 1,
    fee_total_pct: Number(fee_total_pct),
    fee_v3_pct: Number(fee_v3_pct),
    buy_side_pct: Number(buy_side_pct),
    sell_side_pct: Number(sell_side_pct),
    buy_mandatario_input: buyMandatario.value!,
    sell_mandatario_input: sellMandatario.value!,
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
      fee_total_pct: Number(fee_total_pct),
      fee_v3_pct: Number(fee_v3_pct),
      buy_side_pct: Number(buy_side_pct),
      sell_side_pct: Number(sell_side_pct),
      buy_mandatario_input_value: buyMandatario.value!.value,
      buy_mandatario_input_unit: buyMandatario.value!.unit,
      sell_mandatario_input_value: sellMandatario.value!.value,
      sell_mandatario_input_unit: sellMandatario.value!.unit,
      deducao_bancaria_pct: deducao_bancaria_pct != null ? Number(deducao_bancaria_pct) : 6,
      resultado,
      created_by: auth.userId,
    })
    .select("id, created_at")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ id: record.id, created_at: record.created_at, resultado });
}
