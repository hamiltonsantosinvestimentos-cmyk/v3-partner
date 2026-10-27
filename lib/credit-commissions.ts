import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { PLAN_COMMISSION_PCT, ROLE_LABELS, type UserRole } from "@/lib/constants";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Conta da comissão do licenciado de uma proposta de crédito — a MESMA usada na geração
 * ao liberar o recurso e na previsão do relatório mensal (lib/relatorio-mensal-partners.ts).
 * Base: valor do crédito × (mandato% + instituição%) − impostos (alíquota global) = líquida
 * V3; licenciado = líquida × % do plano. ENTERPRISE (sem % fixo) → planoPerc null.
 */
export function calcularComissaoLicenciado(
  proposal: {
    valor_credito_atual?: number | string | null;
    approved_value?: number | string | null;
    requested_value?: number | string | null;
    comissao_mandato_perc?: number | string | null;
    comissao_instituicao_perc?: number | string | null;
  },
  role: string | null | undefined,
  aliquota: number,
) {
  const valorCredito = Number(proposal.valor_credito_atual ?? proposal.approved_value ?? proposal.requested_value ?? 0);
  const mandatoPerc = Number(proposal.comissao_mandato_perc ?? 6);
  const instPerc = Number(proposal.comissao_instituicao_perc ?? 0);
  const bruto = valorCredito * (mandatoPerc + instPerc) / 100;
  const impostos = bruto * aliquota / 100;
  const liquidaV3 = round2(bruto - impostos);
  const planoPerc = PLAN_COMMISSION_PCT[(role ?? "") as UserRole] ?? null;
  const licenciadoValue = round2(liquidaV3 * (planoPerc ?? 0) / 100);
  return { valorCredito, mandatoPerc, instPerc, bruto, impostos, liquidaV3, planoPerc, licenciadoValue };
}

/** Alíquota global de imposto sobre comissões (Configurações → Comissões), 0–100. */
export async function lerAliquotaComissao(db: SupabaseClient): Promise<number> {
  const { data: taxRow } = await db
    .from("platform_settings").select("value").eq("key", "commission_tax_percent").maybeSingle();
  const aliqRaw = taxRow?.value != null ? Number(taxRow.value) : 0;
  return Number.isFinite(aliqRaw) && aliqRaw >= 0 && aliqRaw <= 100 ? aliqRaw : 0;
}

export interface GerarComissoesResult {
  status: "created" | "skipped";
  reason?: "already_generated" | "no_partner" | "sem_instituicao" | "modelo_antigo";
  licenciadoId?: string;
  referralId?: string;
  licenciadoValue?: number;
  needsManualValue?: boolean;
}

/**
 * Modelo de comissão de crédito (27/10/2026): na liberação do recurso nasce só a parte da
 * INSTITUIÇÃO; a parte do MANDATO nasce em cada tranche quando o cliente paga a Remuneração
 * de Sucesso (gerarComissaoMandatoTranche). Propostas liberadas antes disso já tiveram o
 * mandato incluído na liberação (sem este marcador em metadata.comissao_modelo).
 */
export const MODELO_MANDATO_POR_TRANCHE = "mandato_por_tranche";

type Vendedor = { id: string; full_name: string | null; role: string | null; referred_by_partner_id: string | null; enterprise_id?: string | null; enterprise_repasse_percent?: number | null };

const SELECT_PROPOSTA = `
  id, code, title, client_name, partner_id,
  requested_value, approved_value, valor_credito_atual,
  comissao_mandato_perc, comissao_instituicao_perc, metadata,
  partner:profiles!partner_id(id, full_name, role, referred_by_partner_id, enterprise_id, enterprise_repasse_percent)
`;

/**
 * Quem recebe a comissão. Venda de usuário de Enterprise (24/09/2026): a comissão (55%) é do
 * MASTER (a V3 paga o master) e nasce um repasse do master para o usuário.
 */
async function resolverRecebedor(db: SupabaseClient, partnerRaw: unknown) {
  const vendedor = (Array.isArray(partnerRaw) ? partnerRaw[0] : partnerRaw) as Vendedor | null | undefined;
  let partner = vendedor ?? null;
  let usuarioEnterprise: { id: string; full_name: string | null; percent: number } | null = null;
  if (vendedor?.enterprise_id) {
    const { data: master } = await db
      .from("profiles")
      .select("id, full_name, role, referred_by_partner_id")
      .eq("id", vendedor.enterprise_id)
      .maybeSingle();
    if (master) {
      partner = master as Vendedor;
      usuarioEnterprise = { id: vendedor.id, full_name: vendedor.full_name, percent: Number(vendedor.enterprise_repasse_percent ?? 0) };
    }
  }
  return { partner, usuarioEnterprise };
}

/**
 * Grava a comissão do licenciado (+ repasse Enterprise + indicação de 10%), todas em
 * AGUARDANDO_AUTORIZACAO. commission_value é coluna GERADA (operation_value × commission_percent
 * / 100): operation_value = comissão líquida da V3, commission_percent = % do plano.
 * ENTERPRISE (sem % fixo) entra com 0 para o ADMIN definir na autorização.
 */
async function inserirComissoes(db: SupabaseClient, a: {
  proposalId: string; proposalCode: string; descricao: string; partner: Vendedor;
  usuarioEnterprise: { id: string; full_name: string | null; percent: number } | null;
  liquidaV3: number; planoPerc: number | null; nota: string; actorId: string | null;
  operationRef: string | null; dataOperacao: string; sufixoDescricao?: string;
}): Promise<{ licenciadoId?: string; referralId?: string; licenciadoValue: number; duplicada?: boolean }> {
  async function nextCode() {
    const { count } = await db.from("commissions").select("*", { count: "exact", head: true });
    return `COM-26-${String((count ?? 0) + 1).padStart(4, "0")}`;
  }
  const percent = a.planoPerc ?? 0;
  const descricao = `${a.descricao}${a.sufixoDescricao ? ` · ${a.sufixoDescricao}` : ""}`;
  const linha: Record<string, unknown> = {
    code: await nextCode(),
    partner_id: a.partner.id,
    operation_type: "CREDITO",
    operation_id: a.proposalId,
    operation_code: a.proposalCode,
    operation_description: descricao || "Operação de crédito",
    operation_value: a.liquidaV3,
    commission_percent: percent,
    tax_percent: 0,
    status: "AGUARDANDO_AUTORIZACAO",
    operation_closed_at: a.dataOperacao,
    created_by: a.actorId,
    is_referral_commission: false,
    notes: a.usuarioEnterprise
      ? `${a.nota} · Venda do usuário ${a.usuarioEnterprise.full_name ?? ""} (repasse de ${a.usuarioEnterprise.percent}% pago pelo Enterprise)`
      : a.nota,
  };
  if (a.operationRef) linha.operation_ref = a.operationRef;

  const { data: licenciado, error: errLic } = await db.from("commissions").insert(linha).select("id, commission_value").single();
  if (errLic) {
    // 23505 = unique_violation → corrida: outra request já gerou.
    if ((errLic as { code?: string }).code === "23505") return { licenciadoValue: 0, duplicada: true };
    throw new Error(`Falha ao gerar comissão do licenciado: ${errLic.message}`);
  }
  const licenciadoValue = Number(licenciado?.commission_value ?? round2(a.liquidaV3 * percent / 100));

  if (a.usuarioEnterprise && licenciado?.id) {
    const { error: errRep } = await db.from("enterprise_repasses").insert({
      commission_id: licenciado.id,
      enterprise_id: a.partner.id,
      usuario_id: a.usuarioEnterprise.id,
      repasse_percent: a.usuarioEnterprise.percent,
    });
    if (errRep) console.error("[credit-commissions] repasse Enterprise não gravado:", errRep.message);
  }

  let referralId: string | undefined;
  if (a.partner.referred_by_partner_id && licenciadoValue > 0) {
    const { data: ref } = await db.from("commissions").insert({
      code: `${await nextCode()}-IND`,
      partner_id: a.partner.referred_by_partner_id,
      operation_type: "CREDITO",
      operation_id: a.proposalId,
      operation_code: a.proposalCode,
      operation_description: `Indicação — ${descricao || a.proposalCode}`,
      operation_value: licenciadoValue,
      commission_percent: 10,
      tax_percent: 0,
      status: "AGUARDANDO_AUTORIZACAO",
      operation_closed_at: a.dataOperacao,
      created_by: a.actorId,
      is_referral_commission: true,
      referral_source_commission_id: licenciado?.id ?? null,
      notes: `Indicação de ${a.partner.full_name ?? "parceiro"} — 10% da comissão do licenciado (${a.proposalCode}${a.sufixoDescricao ? ` · ${a.sufixoDescricao}` : ""})`,
    }).select("id").single();
    referralId = ref?.id;
  }
  return { licenciadoId: licenciado?.id, referralId, licenciadoValue };
}

/**
 * Gera a comissão da parte da INSTITUIÇÃO quando a proposta entra em LIBERADO ("Recurso
 * Liberado"): valor do crédito × instituição% − impostos = líquida V3; licenciado = líquida ×
 * % do plano (+ indicação 10% se houver). A parte do mandato fica para cada tranche paga pelo
 * cliente. Sem % de instituição não há comissão aqui. Idempotente (metadata.commissions_generated).
 */
export async function gerarComissoesCreditoLiberado(
  proposalId: string,
  actorId: string | null,
): Promise<GerarComissoesResult> {
  const db = svc();
  const { data: proposal } = await db.from("credit_desk_proposals").select(SELECT_PROPOSTA).eq("id", proposalId).single();
  if (!proposal) return { status: "skipped", reason: "no_partner" };

  const meta = (proposal.metadata as Record<string, unknown> | null) ?? {};
  if (meta.commissions_generated === true) return { status: "skipped", reason: "already_generated" };

  const marcar = (extra: Record<string, unknown>) => db.from("credit_desk_proposals").update({
    metadata: { ...meta, commissions_generated: true, comissao_modelo: MODELO_MANDATO_POR_TRANCHE, commissions_generated_at: new Date().toISOString(), ...extra },
    updated_at: new Date().toISOString(),
  }).eq("id", proposalId);

  const { partner, usuarioEnterprise } = await resolverRecebedor(db, proposal.partner);
  if (!proposal.partner_id || !partner) {
    await marcar({ commissions_skipped_reason: "no_partner" });
    return { status: "skipped", reason: "no_partner" };
  }

  const aliquota = await lerAliquotaComissao(db);
  const { valorCredito, instPerc, bruto, impostos, liquidaV3, planoPerc } =
    calcularComissaoLicenciado({ ...proposal, comissao_mandato_perc: 0 }, partner.role, aliquota);
  if (!(liquidaV3 > 0)) {
    await marcar({ commissions_skipped_reason: "sem_instituicao" });
    return { status: "skipped", reason: "sem_instituicao" };
  }

  const role = (partner.role ?? "") as UserRole;
  const planoLabel = ROLE_LABELS[role] ?? (partner.role || "plano não identificado");
  const nota =
    `Crédito ${proposal.code} · Valor liberado ${money(valorCredito)} · ` +
    `Comissão da instituição ${instPerc}% ${money(bruto)} · ` +
    `Impostos ${aliquota}% ${money(impostos)} · Líquida ${money(liquidaV3)} · ` +
    `Licenciado ${planoLabel}${planoPerc != null ? ` ${planoPerc}%` : " (negociável — definir valor)"} · ` +
    `A parte do mandato é gerada por tranche quando o cliente paga`;

  const r = await inserirComissoes(db, {
    proposalId, proposalCode: proposal.code, descricao: `${proposal.title ?? "Crédito"} — ${proposal.client_name ?? ""}`.trim(),
    partner, usuarioEnterprise, liquidaV3, planoPerc, nota, actorId, operationRef: null,
    dataOperacao: new Date().toISOString().split("T")[0], sufixoDescricao: "instituição",
  });
  if (r.duplicada) return { status: "skipped", reason: "already_generated" };

  await marcar({ commission_ids: [r.licenciadoId, r.referralId].filter(Boolean) });
  return { status: "created", licenciadoId: r.licenciadoId, referralId: r.referralId, licenciadoValue: r.licenciadoValue, needsManualValue: planoPerc == null };
}

/** Conta da comissão do mandato de uma tranche paga: recebido − impostos = líquida; × % do plano. */
export function calcularComissaoMandato(valorRecebido: number, role: string | null | undefined, aliquota: number) {
  const impostos = round2(valorRecebido * aliquota / 100);
  const liquidaV3 = round2(valorRecebido - impostos);
  const planoPerc = PLAN_COMMISSION_PCT[(role ?? "") as UserRole] ?? null;
  return { impostos, liquidaV3, planoPerc, licenciadoValue: round2(liquidaV3 * (planoPerc ?? 0) / 100) };
}

/**
 * Cliente pagou a Remuneração de Sucesso (mandato) de uma tranche: gera a comissão do partner
 * sobre o valor recebido. Propostas liberadas no modelo antigo (mandato já incluído na
 * liberação) não geram de novo: devolve reason "modelo_antigo".
 */
export async function gerarComissaoMandatoTranche(
  proposalId: string,
  tranche: { id: string; numero: number; valorRecebido: number; pagoEm: string },
  actorId: string | null,
): Promise<GerarComissoesResult> {
  const db = svc();
  const { data: proposal } = await db.from("credit_desk_proposals").select(SELECT_PROPOSTA).eq("id", proposalId).single();
  if (!proposal) return { status: "skipped", reason: "no_partner" };
  const meta = (proposal.metadata as Record<string, unknown> | null) ?? {};
  if (meta.commissions_generated === true && meta.comissao_modelo !== MODELO_MANDATO_POR_TRANCHE) {
    return { status: "skipped", reason: "modelo_antigo" };
  }

  const { partner, usuarioEnterprise } = await resolverRecebedor(db, proposal.partner);
  if (!proposal.partner_id || !partner) return { status: "skipped", reason: "no_partner" };

  const aliquota = await lerAliquotaComissao(db);
  const { impostos, liquidaV3, planoPerc } = calcularComissaoMandato(tranche.valorRecebido, partner.role, aliquota);
  const role = (partner.role ?? "") as UserRole;
  const planoLabel = ROLE_LABELS[role] ?? (partner.role || "plano não identificado");
  const pagoBR = tranche.pagoEm.split("-").reverse().join("/");
  const nota =
    `Crédito ${proposal.code} · Mandato T${tranche.numero} pago pelo cliente em ${pagoBR} · ` +
    `Recebido ${money(tranche.valorRecebido)} · Impostos ${aliquota}% ${money(impostos)} · Líquida ${money(liquidaV3)} · ` +
    `Licenciado ${planoLabel}${planoPerc != null ? ` ${planoPerc}%` : " (negociável — definir valor)"}`;

  const r = await inserirComissoes(db, {
    proposalId, proposalCode: proposal.code, descricao: `${proposal.title ?? "Crédito"} — ${proposal.client_name ?? ""}`.trim(),
    partner, usuarioEnterprise, liquidaV3, planoPerc, nota, actorId, operationRef: `mandato:${tranche.id}`,
    dataOperacao: tranche.pagoEm, sufixoDescricao: `mandato T${tranche.numero}`,
  });
  if (r.duplicada) return { status: "skipped", reason: "already_generated" };
  return { status: "created", licenciadoId: r.licenciadoId, referralId: r.referralId, licenciadoValue: r.licenciadoValue, needsManualValue: planoPerc == null };
}

/**
 * Desfaz a comissão do mandato de uma tranche (pagamento marcado por engano). Só enquanto
 * ainda aguarda autorização; autorizada ou paga, o ajuste é na aba Comissões.
 */
export async function desfazerComissaoMandatoTranche(commissionId: string): Promise<{ ok: boolean; erro?: string }> {
  const db = svc();
  const { data: c } = await db.from("commissions").select("id, status").eq("id", commissionId).maybeSingle();
  if (!c) return { ok: true };
  if (c.status !== "AGUARDANDO_AUTORIZACAO") {
    return { ok: false, erro: "A comissão já foi autorizada ou paga. Ajuste pela aba Comissões." };
  }
  await db.from("enterprise_repasses").delete().eq("commission_id", commissionId);
  await db.from("commissions").delete().eq("referral_source_commission_id", commissionId).eq("status", "AGUARDANDO_AUTORIZACAO");
  const { error } = await db.from("commissions").delete().eq("id", commissionId);
  return error ? { ok: false, erro: error.message } : { ok: true };
}
