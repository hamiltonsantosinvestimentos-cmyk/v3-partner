import { createClient as sc } from "@supabase/supabase-js";
import { createNotification, notifyByRoles } from "@/lib/notify";
import { notifyNovaComissao } from "@/lib/email";
import { UNIT_PRICE_CENTS } from "@/lib/credit-analysis-pricing";

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

export interface ComissaoConsultaCriada {
  commissionId: string;
  code: string;
  value: number;
  /** Documento analisado que originou a comissão (CPF/CNPJ ou nome do sócio). */
  referencia: string;
}

export interface GerarComissaoConsultaResult {
  status: "created" | "skipped";
  reason?: "already_generated" | "no_partner" | "no_payout_configured" | "not_delivered";
  /** Primeira comissão criada nesta chamada (compatibilidade). */
  commissionId?: string;
  /** Soma das comissões criadas nesta chamada. */
  value?: number;
  partnerId?: string;
  /** Todas as comissões criadas nesta chamada (documento principal + adicionais). */
  criadas?: ComissaoConsultaCriada[];
  /** Falhas ao gerar a comissão de algum documento adicional (não invalidam as demais). */
  erros?: string[];
}

const fmtDoc = (doc: string | null | undefined) => {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc ?? "";
};

const ROTULOS_PADRAO = ["Sócio/garantidor", "CNPJ adicional"];

/**
 * Documentos ADICIONAIS do pedido (sócio/garantidor CPF, 2º+ CNPJ do grupo) que já têm análise
 * rodada. Cada um é uma consulta própria e, portanto, gera a sua comissão. Documento adicional
 * sem análise (consentimento pendente ou análise não rodada) ainda não foi consultado e fica de
 * fora, até uma próxima entrega.
 */
async function documentosAdicionaisAnalisados(db: ReturnType<typeof svc>, orderId: string) {
  const { data: consents } = await db
    .from("credit_consents")
    .select("id, subject_cpf_cnpj, document_label, credit_desk_proposal_id")
    .eq("partner_service_order_id", orderId)
    .order("created_at", { ascending: true });

  const propIds = (consents ?? []).map((c) => c.credit_desk_proposal_id).filter(Boolean) as string[];
  if (!propIds.length) return [];
  const { data: props } = await db.from("credit_desk_proposals").select("id, credit_profile_id").in("id", propIds);
  const analisadas = new Set((props ?? []).filter((p) => p.credit_profile_id).map((p) => p.id));

  return (consents ?? [])
    .filter((c) => c.credit_desk_proposal_id && analisadas.has(c.credit_desk_proposal_id))
    .map((c) => {
      const rotuloPadrao = !c.document_label || ROTULOS_PADRAO.includes(c.document_label);
      return {
        consentId: c.id as string,
        documento: fmtDoc(c.subject_cpf_cnpj),
        // O rótulo é o que a Mesa digitou: pode ser o nome do sócio ou o rótulo padrão.
        nome: rotuloPadrao ? fmtDoc(c.subject_cpf_cnpj) : (c.document_label as string),
      };
    });
}

/**
 * Gera a comissão do partner quando o relatório de uma consulta / Análise de
 * Crédito (partner_service_orders) é entregue ao cliente no painel "Pedidos de
 * Partners".
 *
 *  - UMA COMISSÃO POR DOCUMENTO CONSULTADO: o documento principal do pedido mais cada documento
 *    adicional já analisado (sócio/garantidor CPF, CNPJ do grupo). Um pedido de empresa + sócio
 *    são duas consultas, portanto duas comissões.
 *  - Valor de cada uma = config global `consulta_partner_payout_cents` (valor FIXO, cheio,
 *    sem retenção adicional de imposto), editável na aba Pedidos de Partners. O custo de uma análise
 *    (UNIT_PRICE_CENTS, R$197) vai em `reference_cost`, só para exibição na aba Comissões.
 *  - Beneficiário = partner do pedido; se venda direta, o partner que indicou.
 *  - status inicial AGUARDANDO_AUTORIZACAO (mesmo fluxo do crédito liberado):
 *    ADMIN/FINANCEIRO autorizam e definem a data prevista na aba Comissões.
 *  - Idempotente por documento: o principal por `partner_service_orders.partner_commission_id`
 *    e os adicionais por `operation_id` = id do documento, ambos protegidos pelo índice único
 *    `uq_commissions_credito_licenciado (operation_id)`. Reenviar o relatório nunca duplica, e
 *    um sócio analisado depois da 1ª entrega ganha a comissão na entrega seguinte.
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

  const beneficiaryId = order.partner_id ?? order.ref_partner_id ?? null;
  if (!beneficiaryId) return { status: "skipped", reason: "no_partner" };

  const payoutCents = await getConsultaPartnerPayoutCents(db);
  if (payoutCents <= 0) return { status: "skipped", reason: "no_payout_configured" };
  const payout = Math.round(payoutCents) / 100;
  // Custo de UMA análise (R$197 por CNPJ/CPF), gravado em commissions.reference_cost só para
  // exibição (decisão de Hamilton, 23/09/2026: a aba Comissões mostra "Custo da análise R$197 ·
  // Comissão fixa R$60"). Não entra no cálculo: commission_percent tem 2 casas decimais e
  // nenhum percentual sobre R$197 dá exatamente R$60, então o valor pago segue fixo × 100%.
  const custoAnalise = UNIT_PRICE_CENTS / 100;

  const pRaw = (order.partner_id ? order.partner : order.ref_partner) as unknown;
  const partner = (Array.isArray(pRaw) ? pRaw[0] : pRaw) as { id: string; full_name: string | null } | null | undefined;
  const partnerName = partner?.full_name ?? "Partner";
  const pedidoPago = money((order.amount_cents ?? 0) / 100);
  const vendaDireta = order.partner_id ? "" : ` Venda direta — creditado ao partner indicador ${partnerName}.`;

  const hoje = new Date().toISOString().split("T")[0];

  /** Cria UMA comissão de consulta (insert + notificações). Devolve null se a corrida com outra
   *  entrega simultânea já a criou (violação do índice único). */
  async function criarComissao(opts: {
    operationId: string;
    descricao: string;
    nota: string;
    referencia: string;
  }): Promise<ComissaoConsultaCriada | null> {
    const { count } = await db.from("commissions").select("*", { count: "exact", head: true });
    const code = `COM-26-${String((count ?? 0) + 1).padStart(4, "0")}-CON`;

    const linha = {
      code,
      partner_id: beneficiaryId,
      operation_type: "CREDITO",
      operation_id: opts.operationId,
      operation_code: null,
      operation_description: opts.descricao,
      // commission_value é coluna GERADA (operation_value * commission_percent / 100).
      // operation_value = valor cheio + commission_percent = 100 => commission_value = payout.
      operation_value: payout,
      commission_percent: 100,
      tax_percent: 0,
      status: "AGUARDANDO_AUTORIZACAO",
      operation_closed_at: hoje,
      created_by: actorId,
      is_referral_commission: false,
      notes: opts.nota,
      reference_cost: custoAnalise,
    };
    let { data: commission, error } = await db.from("commissions").insert(linha).select("id, commission_value").single();

    // Migration 20260923_commissions_reference_cost ainda não rodada (PGRST204 = coluna
    // desconhecida): grava sem o custo de referência em vez de perder a comissão.
    if (error && (error as { code?: string }).code === "PGRST204") {
      const { reference_cost: _semCusto, ...semCusto } = linha;
      ({ data: commission, error } = await db.from("commissions").insert(semCusto).select("id, commission_value").single());
    }

    if (error || !commission) {
      // 23505 = corrida com outra entrega simultânea → trata como já gerada.
      if ((error as { code?: string } | null)?.code === "23505") return null;
      throw new Error(`Falha ao gerar comissão da consulta (${opts.referencia}): ${error?.message ?? "sem retorno"}`);
    }

    const valor = Number(commission.commission_value ?? payout);
    const valorFmt = money(valor);

    // Partner: comissão registrada, aguardando autorização
    createNotification({
      user_id: beneficiaryId!,
      type: "commission",
      title: "Comissão de consulta registrada 💰",
      message: `${code} — ${opts.descricao} · ${valorFmt} (aguardando autorização)`,
      action_url: "/comissoes",
    });

    // ADMIN/FINANCEIRO: precisa autorizar o pagamento
    notifyByRoles(["ADMIN", "FINANCEIRO"], {
      title: "Comissão aguardando autorização 💰",
      message: `${code} — consulta de ${opts.referencia} entregue. Comissão do partner ${partnerName} de ${valorFmt} pronta para autorização.`,
      type: "commission",
      action_url: "/comissoes",
    });

    // E-mail para o partner (fire and forget)
    (async () => {
      try {
        const { data: pu } = await db.auth.admin.getUserById(beneficiaryId!);
        const email = pu?.user?.email;
        if (email) {
          await notifyNovaComissao({
            partnerEmail: email,
            partnerName,
            commissionCode: code,
            operationDescription: opts.descricao,
            operationType: "CREDITO",
            commissionValue: valor,
          });
        }
      } catch { /* e-mail é best effort */ }
    })();

    return { commissionId: commission.id, code, value: valor, referencia: opts.referencia };
  }

  const criadas: ComissaoConsultaCriada[] = [];
  const erros: string[] = [];

  // ── 1) Documento principal do pedido (a empresa, ou o titular) ──
  if (!order.partner_commission_id) {
    const referencia = order.client_name ?? order.client_doc ?? "cliente";
    const nota =
      `Comissão da consulta gerada na entrega do relatório ao cliente (Pedidos de Partners). ` +
      `Custo por análise ${money(custoAnalise)} · comissão fixa ${money(payout)} (configurada em Pedidos de Partners). ` +
      `Pedido pago ${pedidoPago}.` + vendaDireta;
    const c = await criarComissao({
      operationId: orderId,
      descricao: `Consulta / Análise de Crédito — ${referencia}`,
      nota,
      referencia,
    });
    if (c) {
      criadas.push(c);
      await db.from("partner_service_orders").update({ partner_commission_id: c.commissionId }).eq("id", orderId);
    }
  }

  // ── 2) Documentos adicionais já analisados (sócios/garantidores, CNPJs do grupo) ──
  const adicionais = await documentosAdicionaisAnalisados(db, orderId);
  if (adicionais.length) {
    const { data: jaGeradas } = await db
      .from("commissions")
      .select("operation_id")
      .eq("operation_type", "CREDITO")
      .eq("is_referral_commission", false)
      .in("operation_id", adicionais.map((a) => a.consentId));
    const geradas = new Set((jaGeradas ?? []).map((c) => c.operation_id as string));

    for (const a of adicionais) {
      if (geradas.has(a.consentId)) continue;
      try {
        const c = await criarComissao({
          operationId: a.consentId,
          descricao: `Consulta / Análise de Crédito — ${a.nome} (documento adicional de ${order.client_name ?? "pedido"})`,
          nota:
            `Comissão da consulta do documento adicional ${a.documento} (sócio/garantidor ou CNPJ do grupo), ` +
            `gerada na entrega do relatório ao cliente (Pedidos de Partners). Cada documento consultado gera ` +
            `uma comissão. Custo por análise ${money(custoAnalise)} · comissão fixa ${money(payout)} ` +
            `(configurada em Pedidos de Partners). ` +
            `Pedido pago ${pedidoPago}.` + vendaDireta,
          referencia: a.nome,
        });
        if (c) criadas.push(c);
      } catch (e) {
        erros.push((e as Error).message);
      }
    }
  }

  if (!criadas.length) {
    return { status: "skipped", reason: "already_generated", ...(erros.length ? { erros } : {}) };
  }
  return {
    status: "created",
    commissionId: criadas[0].commissionId,
    value: criadas.reduce((s, c) => s + c.value, 0),
    partnerId: beneficiaryId,
    criadas,
    ...(erros.length ? { erros } : {}),
  };
}
