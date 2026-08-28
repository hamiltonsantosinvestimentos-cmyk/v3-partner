import { createClient as sc } from "@supabase/supabase-js";
import { PLAN_COMMISSION_PCT, ROLE_LABELS, type UserRole } from "@/lib/constants";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface GerarComissoesResult {
  status: "created" | "skipped";
  reason?: "already_generated" | "no_partner";
  licenciadoId?: string;
  referralId?: string;
  licenciadoValue?: number;
  needsManualValue?: boolean;
}

/**
 * Gera as comissões de uma proposta de crédito quando ela entra no estágio
 * LIBERADO ("Recurso Liberado"). Cria:
 *   - 1 comissão do licenciado (parceiro), % conforme o plano contratado,
 *     aplicado sobre a comissão LÍQUIDA da V3 (mandato + instituição − impostos).
 *   - se o parceiro tem `referred_by_partner_id`, 1 comissão de indicação de
 *     10% sobre a comissão do licenciado.
 * Ambas nascem com status AGUARDANDO_AUTORIZACAO. Idempotente: a segunda
 * chamada para a mesma proposta retorna { status: "skipped" }.
 */
export async function gerarComissoesCreditoLiberado(
  proposalId: string,
  actorId: string | null,
): Promise<GerarComissoesResult> {
  const db = svc();
  const { data: proposal } = await db
    .from("credit_desk_proposals")
    .select(`
      id, code, title, client_name, partner_id,
      requested_value, approved_value, valor_credito_atual,
      comissao_mandato_perc, comissao_instituicao_perc, metadata,
      partner:profiles!partner_id(id, full_name, role, referred_by_partner_id)
    `)
    .eq("id", proposalId)
    .single();

  if (!proposal) return { status: "skipped", reason: "no_partner" };

  const meta = (proposal.metadata as Record<string, unknown> | null) ?? {};
  if (meta.commissions_generated === true) {
    return { status: "skipped", reason: "already_generated" };
  }

  const partnerRaw = proposal.partner as unknown;
  const partner = (Array.isArray(partnerRaw) ? partnerRaw[0] : partnerRaw) as
    | { id: string; full_name: string | null; role: string | null; referred_by_partner_id: string | null }
    | null
    | undefined;

  if (!proposal.partner_id || !partner) {
    await db.from("credit_desk_proposals").update({
      metadata: { ...meta, commissions_generated: true, commissions_skipped_reason: "no_partner", commissions_generated_at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }).eq("id", proposalId);
    return { status: "skipped", reason: "no_partner" };
  }

  // Base de cálculo — mesma lógica do modal de proposta (proposta-detail-modal.tsx)
  const valorCredito = Number(proposal.valor_credito_atual ?? proposal.approved_value ?? proposal.requested_value ?? 0);
  const mandatoPerc = Number(proposal.comissao_mandato_perc ?? 6);
  const instPerc = Number(proposal.comissao_instituicao_perc ?? 0);
  const bruto = valorCredito * (mandatoPerc + instPerc) / 100;

  // Alíquota global de imposto sobre comissões (Configurações → Comissões)
  const { data: taxRow } = await db
    .from("platform_settings").select("value").eq("key", "commission_tax_percent").maybeSingle();
  const aliqRaw = taxRow?.value != null ? Number(taxRow.value) : 0;
  const aliquota = Number.isFinite(aliqRaw) && aliqRaw >= 0 && aliqRaw <= 100 ? aliqRaw : 0;
  const impostos = bruto * aliquota / 100;
  const liquidaV3 = round2(bruto - impostos);

  const role = (partner.role ?? "") as UserRole;
  const planoPerc = PLAN_COMMISSION_PCT[role] ?? null;
  const planoLabel = ROLE_LABELS[role] ?? (partner.role || "plano não identificado");
  // commission_value é coluna GERADA (operation_value * commission_percent / 100).
  // Guardamos operation_value = comissão líquida da V3 e commission_percent = % do
  // plano, de forma que commission_value = comissão líquida do licenciado.
  // ENTERPRISE não tem % fixo: entra com 0 para ADMIN definir na autorização.
  const licenciadoPercent = planoPerc ?? 0;
  const licenciadoValue = round2(liquidaV3 * licenciadoPercent / 100);
  const needsManualValue = planoPerc == null;

  const descricao = `${proposal.title ?? "Crédito"} — ${proposal.client_name ?? ""}`.trim();
  const hoje = new Date().toISOString().split("T")[0];

  // Recontado a cada chamada — após inserir o licenciado o count já reflete +1.
  async function nextCode() {
    const { count } = await db.from("commissions").select("*", { count: "exact", head: true });
    return `COM-26-${String((count ?? 0) + 1).padStart(4, "0")}`;
  }

  // ── Comissão do licenciado ──
  const notaLicenciado =
    `Crédito ${proposal.code} · Valor liberado ${money(valorCredito)} · ` +
    `Comissão bruta V3 ${money(bruto)} (mandato ${mandatoPerc}% + instituição ${instPerc}%) · ` +
    `Impostos ${aliquota}% ${money(impostos)} · Líquida ${money(liquidaV3)} · ` +
    `Licenciado ${planoLabel}${planoPerc != null ? ` ${planoPerc}%` : " (negociável — definir valor)"}`;

  const { data: licenciado, error: errLic } = await db.from("commissions").insert({
    code: await nextCode(),
    partner_id: proposal.partner_id,
    operation_type: "CREDITO",
    operation_id: proposalId,
    operation_code: proposal.code,
    operation_description: descricao || "Operação de crédito",
    operation_value: liquidaV3,
    commission_percent: licenciadoPercent,
    tax_percent: 0,
    status: "AGUARDANDO_AUTORIZACAO",
    operation_closed_at: hoje,
    created_by: actorId,
    is_referral_commission: false,
    notes: notaLicenciado,
  }).select("id, commission_value").single();

  if (errLic) {
    // 23505 = unique_violation → corrida: outra request já gerou. Trata como skip.
    if ((errLic as { code?: string }).code === "23505") return { status: "skipped", reason: "already_generated" };
    throw new Error(`Falha ao gerar comissão do licenciado: ${errLic.message}`);
  }

  const licenciadoFinal = Number(licenciado?.commission_value ?? licenciadoValue);
  let referralId: string | undefined;

  // ── Comissão de indicação (10% da comissão do licenciado) ──
  if (partner.referred_by_partner_id && licenciadoFinal > 0) {
    const { data: ref } = await db.from("commissions").insert({
      code: `${await nextCode()}-IND`,
      partner_id: partner.referred_by_partner_id,
      operation_type: "CREDITO",
      operation_id: proposalId,
      operation_code: proposal.code,
      operation_description: `Indicação — ${descricao || proposal.code}`,
      operation_value: licenciadoFinal,
      commission_percent: 10,
      tax_percent: 0,
      status: "AGUARDANDO_AUTORIZACAO",
      operation_closed_at: hoje,
      created_by: actorId,
      is_referral_commission: true,
      referral_source_commission_id: licenciado?.id ?? null,
      notes: `Indicação de ${partner.full_name ?? "parceiro"} — 10% da comissão do licenciado (${proposal.code})`,
    }).select("id").single();
    referralId = ref?.id;
  }

  await db.from("credit_desk_proposals").update({
    metadata: {
      ...meta,
      commissions_generated: true,
      commissions_generated_at: new Date().toISOString(),
      commission_ids: [licenciado?.id, referralId].filter(Boolean),
    },
    updated_at: new Date().toISOString(),
  }).eq("id", proposalId);

  return {
    status: "created",
    licenciadoId: licenciado?.id,
    referralId,
    licenciadoValue: licenciadoFinal,
    needsManualValue,
  };
}
