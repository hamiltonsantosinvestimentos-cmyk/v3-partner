// Reconciliação de partner_service_orders pagos na Cora — extraído de
// app/api/cora/webhook/route.ts em 31/08/2026 para ser reusado também por
// app/api/cron/cora-sync/route.ts (polling de segurança), evitando duplicar
// a lógica em dois lugares (foi exatamente esse tipo de duplicação — 18
// pontos de emissão de código cada um do seu jeito — que já causou o P0 de
// numeração em 07/08/2026, ver v3-numbering-governance.md).
//
// Gatilho: pedido pago do Osnildo Moser (Marmoraria Moser, R$197, indicado
// por Gustavo Xavier da Rocha) ficou 3 dias em PENDING com fatura Cora já
// criada, sem o webhook nunca confirmar. Reconciliado manualmente com base
// no comprovante Pix real antes desta refatoração. Causa raiz exata não
// confirmada (sem acesso aos logs do Vercel do projeto, que fica em outro
// time), então a correção aqui é estrutural: qualquer chamador (webhook OU
// o cron de polling) reconcilia da mesma forma, sempre.
import { randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildModularTitle, LEGACY_DIRECT_TITLES } from "@/lib/credit-analysis-pricing";
import { notifyPagamentoAnaliseConfirmado, notifyMesaCreditoPedidoPago } from "@/lib/email";

const CREDIT_SERVICE_TYPES = ["credit_analysis", "credit_analysis_consultoria"];

/** Avisa ADMIN/GESTAO/MESA_OPERACIONAL (in-app + e-mail individual, nunca
 *  endereço de setor inventado) que um pedido de Análise de Crédito foi pago. */
export async function notificarMesaCreditoNovoPedido(
  db: SupabaseClient,
  opts: { clientName: string; title: string; amountCents: number; origem: string; origemDetalhe: string | null }
) {
  const { data: mesa } = await db
    .from("profiles")
    .select("id, email")
    .in("role", ["ADMIN", "GESTAO", "MESA_OPERACIONAL"]);
  if (!mesa?.length) return;

  await db.from("notifications").insert(
    mesa.map((m: { id: string }) => ({
      user_id: m.id,
      type: "commission",
      title: "Novo pedido de Análise de Crédito pago",
      message: `${opts.clientName} pagou "${opts.title}" (${opts.origemDetalhe ? `${opts.origem} · ${opts.origemDetalhe}` : opts.origem}). Aguarda vínculo/análise em Pedidos de Partners.`,
      action_url: "/mesa-credito/pedidos",
      read: false,
    }))
  ).then(null, () => {});

  await Promise.allSettled(
    mesa
      .filter((m: { email?: string | null }) => m.email)
      .map((m: { email: string }) =>
        notifyMesaCreditoPedidoPago({
          mesaEmail: m.email,
          clientName: opts.clientName,
          title: opts.title,
          amountCents: opts.amountCents,
          origem: opts.origem,
          origemDetalhe: opts.origemDetalhe,
        })
      )
  );
}

export interface PartnerLinkOrderRow {
  id: string;
  partner_id: string | null;
  client_name: string;
  client_email: string;
  client_doc: string;
  link_id: string | null;
  partner_service_links: { title?: string; service_type?: string; price_cents?: number } | null;
  partner: { full_name?: string } | null;
}

/** Pedido pago originado de um link de partner (partner_service_links). */
export async function reconcilePartnerLinkOrderPaid(
  db: SupabaseClient,
  serviceOrder: PartnerLinkOrderRow,
  paidAt: string
) {
  const intakeToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
  const link = serviceOrder.partner_service_links;

  await db.from("partner_service_orders").update({
    status: "PAID",
    paid_at: paidAt,
    intake_token: intakeToken,
    intake_sent_at: new Date().toISOString(),
  }).eq("id", serviceOrder.id);

  await db.rpc("increment_link_revenue", {
    p_link_id: serviceOrder.link_id,
    p_amount: link?.price_cents ?? 0,
  }).then(null, () => {});

  // Gera o token de intake na tabela correta por tipo de serviço.
  // credit_analysis usa credit_consents (gate LGPD do Credit Engine).
  // Os demais tipos seguem o padrão anterior via captacao_links.
  if (link?.service_type === "credit_analysis") {
    await db.from("credit_consents").insert({
      intake_token: intakeToken,
      subject_cpf_cnpj: serviceOrder.client_doc,
      subject_name: serviceOrder.client_name,
      subject_email: serviceOrder.client_email,
    }).then(null, () => {});
  } else {
    await db.from("captacao_links").insert({
      token: intakeToken,
      partner_id: serviceOrder.partner_id,
      partner_name: "V3 Partners",
      active: true,
      uses_count: 0,
    }).then(null, () => {});
  }

  const intakePath = link?.service_type === "credit_analysis"
    ? `/intake/credit/${intakeToken}`
    : link?.service_type === "ma_intake"
    ? `/intake/bp/${intakeToken}`
    : `/c/${intakeToken}`;

  await notifyPagamentoAnaliseConfirmado({
    clientEmail: serviceOrder.client_email,
    clientName: serviceOrder.client_name,
    title: link?.title ?? "Serviço V3",
    intakePath,
  }).catch((e) => console.error("Email error (service order):", e));

  await db.from("notifications").insert({
    user_id:    serviceOrder.partner_id,
    type:       "commission",
    title:      "Venda confirmada!",
    message:    `${serviceOrder.client_name} pagou "${link?.title ?? "serviço"}". Intake enviado por email.`,
    action_url: "/configuracoes",
    read:       false,
  }).then(null, () => {});

  if (link?.service_type === "credit_analysis") {
    await notificarMesaCreditoNovoPedido(db, {
      clientName: serviceOrder.client_name,
      title: link?.title ?? "Análise de Crédito Empresarial",
      amountCents: link?.price_cents ?? 0,
      origem: "Via partner",
      origemDetalhe: serviceOrder.partner?.full_name ?? null,
    }).catch((e) => console.error("Notificação Mesa de Crédito (via partner):", e));
  }
}

export interface DirectOrderRow {
  id: string;
  ref_partner_id: string | null;
  client_name: string;
  client_email: string;
  client_doc: string;
  service_type: string | null;
  amount_cents: number | null;
  cnpj_count: number | null;
  cpf_count: number | null;
  has_consultancy: boolean | null;
  ref_partner: { full_name?: string } | null;
}

/** Pedido pago da venda direta pública (/analise-v2, source='direct'). */
export async function reconcileDirectOrderPaid(
  db: SupabaseClient,
  directOrder: DirectOrderRow,
  paidAt: string
) {
  const intakeToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
  const title = directOrder.cnpj_count != null
    ? buildModularTitle({
        cnpjCount: directOrder.cnpj_count,
        cpfCount: directOrder.cpf_count ?? 0,
        hasConsultancy: Boolean(directOrder.has_consultancy),
      })
    : LEGACY_DIRECT_TITLES[directOrder.service_type ?? ""] ?? "Análise de Crédito Empresarial";

  await db.from("partner_service_orders").update({
    status: "PAID",
    paid_at: paidAt,
    intake_token: intakeToken,
    intake_sent_at: new Date().toISOString(),
  }).eq("id", directOrder.id);

  await db.from("credit_consents").insert({
    intake_token: intakeToken,
    subject_cpf_cnpj: directOrder.client_doc,
    subject_name: directOrder.client_name,
    subject_email: directOrder.client_email,
  }).then(null, () => {});

  await notifyPagamentoAnaliseConfirmado({
    clientEmail: directOrder.client_email,
    clientName: directOrder.client_name,
    title,
    intakePath: `/intake/credit/${intakeToken}`,
  }).catch((e) => console.error("Email error (direct order):", e));

  if (directOrder.ref_partner_id) {
    const { data: staff } = await db
      .from("profiles")
      .select("id")
      .in("role", ["ADMIN", "FINANCEIRO"]);
    if (staff?.length) {
      await db.from("notifications").insert(
        staff.map((s: { id: string }) => ({
          user_id: s.id,
          type: "commission",
          title: "Venda direta atribuída a partner",
          message: `${directOrder.client_name} comprou "${title}" via link de indicação. Comissão pendente de lançamento manual em /financeiro.`,
          action_url: "/financeiro",
          read: false,
        }))
      ).then(null, () => {});
    }
  }

  if (directOrder.cnpj_count != null || CREDIT_SERVICE_TYPES.includes(directOrder.service_type ?? "")) {
    await notificarMesaCreditoNovoPedido(db, {
      clientName: directOrder.client_name,
      title,
      amountCents: directOrder.amount_cents ?? 0,
      origem: "Venda direta",
      origemDetalhe: directOrder.ref_partner?.full_name ? `Ref: ${directOrder.ref_partner.full_name}` : null,
    }).catch((e) => console.error("Notificação Mesa de Crédito (venda direta):", e));
  }
}
