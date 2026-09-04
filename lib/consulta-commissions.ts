import { createClient as sc } from "@supabase/supabase-js";
import { createNotification, notifyByRoles } from "@/lib/notify";
import { notifyNovaComissao } from "@/lib/email";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const money = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

/** Valor fixo (centavos) direcionado ao partner por consulta entregue.
 *  Configurado em Configurações -> Comissões. */
export async function getConsultaPartnerPayoutCents(
  db: ReturnType<typeof svc> = svc(),
): Promise<number> {
  const { data } = await db
    .from("platform_settings")
    .select("value")
    .eq("key", "consulta_partner_payout_cents")
    .maybeSingle();
  const n = data?.value != null ? Number(data.value) : 0;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

export interface GerarComissaoConsultaResult {
  status: "created" | "skipped";
  reason?: "already_generated" | "no_partner" | "no_payout_configured" | "not_delivered";
  commissionId?: string;
  value?: number;
  partnerId?: string;
}

/**
 * Gera a comissão do partner quando o relatório de uma consulta / Análise de
 * Crédito (partner_service_orders) é entregue ao cliente no painel "Pedidos de
 * Partners".
 *
 *  - Valor = config global `consulta_partner_payout_cents` (valor FIXO, cheio,
 *    sem retenção adicional de imposto).
 *  - Beneficiário = partner do pedido; se venda direta, o partner que indicou.
 *  - status inicial AGUARDANDO_AUTORIZACAO (mesmo fluxo do crédito liberado):
 *    ADMIN/FINANCEIRO autorizam e definem a data prevista na aba Comissões.
 *  - Idempotente: `partner_service_orders.partner_commission_id` + índice único
 *    `uq_commissions_credito_licenciado (operation_id)` garantem 1 comissão por
 *    pedido, mesmo se o relatório for reenviado.
 */
export async function gerarComissaoConsultaEntregue(
  orderId: string,
  actorId: string | null,
): Promise<GerarComissaoConsultaResult> {
  const db = svc();

  const { data: order } = await db
    .from("partner_service_orders")
    .select(`
      id, client_name, client_doc, amount_cents, report_delivered_at,
      partner_commission_id, partner_id, ref_partner_id,
      partner:profiles!partner_id(id, full_name),
      ref_partner:profiles!ref_partner_id(id, full_name)
    `)
    .eq("id", orderId)
    .single();

  if (!order) return { status: "skipped", reason: "no_partner" };
  if (!order.report_delivered_at) return { status: "skipped", reason: "not_delivered" };
  if (order.partner_commission_id) return { status: "skipped", reason: "already_generated" };

  const beneficiaryId = order.partner_id ?? order.ref_partner_id ?? null;
  if (!beneficiaryId) return { status: "skipped", reason: "no_partner" };

  const payoutCents = await getConsultaPartnerPayoutCents(db);
  if (payoutCents <= 0) return { status: "skipped", reason: "no_payout_configured" };
  const payout = Math.round(payoutCents) / 100;

  const pRaw = (order.partner_id ? order.partner : order.ref_partner) as unknown;
  const partner = (Array.isArray(pRaw) ? pRaw[0] : pRaw) as { id: string; full_name: string | null } | null | undefined;
  const partnerName = partner?.full_name ?? "Partner";

  const hoje = new Date().toISOString().split("T")[0];
  const descricao = `Consulta / Análise de Crédito — ${order.client_name ?? order.client_doc ?? "cliente"}`;
  const nota =
    `Comissão da consulta gerada na entrega do relatório ao cliente (Pedidos de Partners). ` +
    `Valor fixo configurado em Configurações → Comissões: ${money(payout)}. ` +
    `Pedido pago ${money((order.amount_cents ?? 0) / 100)}.` +
    (order.partner_id ? "" : ` Venda direta — creditado ao partner indicador ${partnerName}.`);

  const { count } = await db.from("commissions").select("*", { count: "exact", head: true });
  const code = `COM-26-${String((count ?? 0) + 1).padStart(4, "0")}-CON`;

  const { data: commission, error } = await db.from("commissions").insert({
    code,
    partner_id: beneficiaryId,
    operation_type: "CREDITO",
    operation_id: orderId,
    operation_code: null,
    operation_description: descricao,
    // commission_value é coluna GERADA (operation_value * commission_percent / 100).
    // operation_value = valor cheio + commission_percent = 100 => commission_value = payout.
    operation_value: payout,
    commission_percent: 100,
    tax_percent: 0,
    status: "AGUARDANDO_AUTORIZACAO",
    operation_closed_at: hoje,
    created_by: actorId,
    is_referral_commission: false,
    notes: nota,
  }).select("id, commission_value").single();

  if (error) {
    // 23505 = corrida com outra entrega simultânea → trata como já gerada.
    if ((error as { code?: string }).code === "23505") {
      return { status: "skipped", reason: "already_generated" };
    }
    throw new Error(`Falha ao gerar comissão da consulta: ${error.message}`);
  }

  await db
    .from("partner_service_orders")
    .update({ partner_commission_id: commission.id })
    .eq("id", orderId);

  const valorFmt = money(Number(commission.commission_value ?? payout));

  // Partner: comissão registrada, aguardando autorização
  createNotification({
    user_id: beneficiaryId,
    type: "commission",
    title: "Comissão de consulta registrada 💰",
    message: `${code} — ${descricao} · ${valorFmt} (aguardando autorização)`,
    action_url: "/comissoes",
  });

  // ADMIN/FINANCEIRO: precisa autorizar o pagamento
  notifyByRoles(["ADMIN", "FINANCEIRO"], {
    title: "Comissão aguardando autorização 💰",
    message: `${code} — consulta de ${order.client_name ?? "cliente"} entregue. Comissão do partner ${partnerName} de ${valorFmt} pronta para autorização.`,
    type: "commission",
    action_url: "/comissoes",
  });

  // E-mail para o partner (fire and forget)
  (async () => {
    try {
      const { data: pu } = await db.auth.admin.getUserById(beneficiaryId);
      const email = pu?.user?.email;
      if (email) {
        await notifyNovaComissao({
          partnerEmail: email,
          partnerName,
          commissionCode: code,
          operationDescription: descricao,
          operationType: "CREDITO",
          commissionValue: Number(commission.commission_value ?? payout),
        });
      }
    } catch { /* e-mail é best effort */ }
  })();

  return {
    status: "created",
    commissionId: commission.id,
    value: Number(commission.commission_value ?? payout),
    partnerId: beneficiaryId,
  };
}
