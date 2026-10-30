import type { SupabaseClient } from "@supabase/supabase-js";

/** Percentual do closer sobre o que fica líquido para a V3 depois da comissão do partner. */
export const CLOSER_PERCENT = 10;
/** Marca a comissão do closer em commissions.operation_ref. */
export const CLOSER_OPERATION_REF = "closer";

/** Percentual do closer sobre cada mensalidade paga pelo partner vinculado. */
export const CLOSER_ASSINATURA_PERCENT = 30;
/** Comissão sobre mensalidade: operation_ref = prefixo + id do pagamento. */
export const CLOSER_ASSINATURA_REF_PREFIX = "closer-assinatura:";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Entrou R$ 100 mil para a V3, R$ 50 mil para o partner: base do closer = R$ 50 mil. */
export function baseDoCloser(entradaV3: number, comissaoPartner: number) {
  return Math.max(round2(entradaV3 - comissaoPartner), 0);
}

/**
 * Gera a comissão do closer vinculado ao partner, em AGUARDANDO_AUTORIZACAO.
 * commission_value é coluna GERADA: operation_value = líquido da V3, commission_percent = 10.
 * Entra como is_referral_commission = true para não colidir com o índice único da comissão
 * do licenciado (uq_commissions_credito_licenciado). Sem closer vinculado, não faz nada.
 */
export async function gerarComissaoCloser(db: SupabaseClient, a: {
  sourceId: string; partnerId: string; operationType: string;
  operationId?: string | null; operationCode?: string | null; descricao: string;
  entradaV3: number; comissaoPartner: number; dataOperacao?: string | null; actorId?: string | null;
}): Promise<string | undefined> {
  const { data: partner } = await db
    .from("profiles").select("full_name, closer_id").eq("id", a.partnerId).maybeSingle();
  const p = partner as { full_name: string | null; closer_id: string | null } | null;
  if (!p?.closer_id) return undefined;

  const base = baseDoCloser(a.entradaV3, a.comissaoPartner);
  if (!(base > 0)) return undefined;

  const { count } = await db.from("commissions").select("*", { count: "exact", head: true });
  const { data, error } = await db.from("commissions").insert({
    code: `COM-26-${String((count ?? 0) + 1).padStart(4, "0")}-CLO`,
    partner_id: p.closer_id,
    operation_type: a.operationType,
    operation_id: a.operationId ?? null,
    operation_code: a.operationCode ?? null,
    operation_description: `Closer — ${p.full_name ?? "Partner"} — ${a.descricao}`,
    operation_value: base,
    commission_percent: CLOSER_PERCENT,
    tax_percent: 0,
    status: "AGUARDANDO_AUTORIZACAO",
    operation_closed_at: a.dataOperacao ?? new Date().toISOString().split("T")[0],
    created_by: a.actorId ?? null,
    is_referral_commission: true,
    referral_source_commission_id: a.sourceId,
    operation_ref: CLOSER_OPERATION_REF,
    notes: `${CLOSER_PERCENT}% do líquido da V3: entrada ${a.entradaV3} − partner ${a.comissaoPartner} = ${base}`,
  }).select("id").single();
  if (error) throw new Error(`Falha ao gerar comissão do closer: ${error.message}`);
  return data?.id;
}

/**
 * Partner vinculado pagou a mensalidade: gera 30% do valor pago para o closer, em
 * AGUARDANDO_AUTORIZACAO. operation_id guarda o partner que pagou. O índice único em
 * operation_ref evita gerar em dobro se o webhook repetir o evento. Falha nunca derruba o pagamento.
 */
export async function gerarComissaoCloserAssinatura(db: SupabaseClient, a: {
  partnerId: string; valorPago: number; pagamentoId: string; dataPagamento: string;
}): Promise<void> {
  try {
    const { data: partner } = await db
      .from("profiles").select("full_name, closer_id").eq("id", a.partnerId).maybeSingle();
    const p = partner as { full_name: string | null; closer_id: string | null } | null;
    if (!p?.closer_id || !(a.valorPago > 0)) return;

    const { count } = await db.from("commissions").select("*", { count: "exact", head: true });
    const { error } = await db.from("commissions").insert({
      code: `COM-26-${String((count ?? 0) + 1).padStart(4, "0")}-CLA`,
      partner_id: p.closer_id,
      operation_type: "ASSINATURA",
      operation_id: a.partnerId,
      operation_description: `Closer — mensalidade de ${p.full_name ?? "Partner"}`,
      operation_value: round2(a.valorPago),
      commission_percent: CLOSER_ASSINATURA_PERCENT,
      tax_percent: 0,
      status: "AGUARDANDO_AUTORIZACAO",
      operation_closed_at: a.dataPagamento.split("T")[0],
      is_referral_commission: true,
      operation_ref: `${CLOSER_ASSINATURA_REF_PREFIX}${a.pagamentoId}`,
      notes: `${CLOSER_ASSINATURA_PERCENT}% da mensalidade paga`,
    });
    // 23505 = o mesmo pagamento já gerou a comissão
    if (error && (error as { code?: string }).code !== "23505") throw new Error(error.message);
  } catch (e) {
    console.error("[closer-commissions] comissão da mensalidade não gravada:", e);
  }
}

/**
 * Comissão do partner mudou de valor ou foi cancelada: acompanha na do closer, enquanto
 * ela não foi paga. Autorizada continua autorizada; só a base é recalculada.
 */
export async function sincronizarComissaoCloser(db: SupabaseClient, source: {
  id: string; operation_value: number; commission_value: number | null; status: string;
}) {
  const mudanca = source.status === "CANCELADA"
    ? { status: "CANCELADA" }
    : { operation_value: baseDoCloser(Number(source.operation_value), Number(source.commission_value ?? 0)) };
  await db.from("commissions")
    .update(mudanca)
    .eq("referral_source_commission_id", source.id)
    .eq("operation_ref", CLOSER_OPERATION_REF)
    .in("status", ["AGUARDANDO_AUTORIZACAO", "A_PAGAR"]);
}
