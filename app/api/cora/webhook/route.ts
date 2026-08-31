import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { coraFetch } from "@/lib/cora";
import { randomUUID } from "crypto";
import { getPlanoValor } from "@/lib/plano-valor";
import { reconcilePartnerLinkOrderPaid, reconcileDirectOrderPaid } from "@/lib/cora-order-reconcile";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function gerarProximaCobranca(db: ReturnType<typeof svc>, partnerId: string, plano: string) {
  try {
    const { data: profile } = await db
      .from("profiles")
      .select("full_name, cpf, cnpj, email, referral_discount_percent, referral_discount_months_remaining")
      .eq("id", partnerId)
      .single();

    if (!profile) return;

    const documento = (profile as { cpf?: string; cnpj?: string }).cpf ?? (profile as { cpf?: string; cnpj?: string }).cnpj ?? "";
    const baseValor = getPlanoValor(plano);

    // Aplica desconto de indicação se houver meses restantes
    const descontoPercent      = (profile as { referral_discount_percent?: number }).referral_discount_percent ?? 0;
    const mesesComDesconto     = (profile as { referral_discount_months_remaining?: number }).referral_discount_months_remaining ?? 0;
    const temDesconto          = descontoPercent > 0 && mesesComDesconto > 0;
    const valor                = temDesconto ? Math.round(baseValor * (1 - descontoPercent / 100)) : baseValor;

    // Decrementa meses restantes de desconto
    if (temDesconto) {
      const novosMeses = mesesComDesconto - 1;
      await db.from("profiles").update({
        referral_discount_months_remaining: novosMeses,
        ...(novosMeses === 0 ? { referral_discount_percent: 0 } : {}),
      }).eq("id", partnerId);
    }

    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);
    dueDate.setDate(10);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const res = await coraFetch("/v2/invoices", {
      method: "POST",
      body: JSON.stringify({
        code: randomUUID().slice(0, 8).toUpperCase(),
        customer: {
          name: (profile as { full_name: string }).full_name,
          document: {
            identity: documento.replace(/\D/g, ""),
            type: documento.replace(/\D/g, "").length === 11 ? "CPF" : "CNPJ",
          },
          ...((profile as { email?: string }).email ? { contacts: [{ contact: (profile as { email?: string }).email, type: "EMAIL" }] } : {}),
        },
        payment_terms: { due_date: dueDateStr, amount: valor },
        payment_options: {
          interest: { type: "MONTHLY_PERCENTAGE", value: 1 },
          fine: { type: "PERCENTAGE", value: 2 },
        },
        payment_forms: ["BANK_SLIP", "PIX"],
        services: [{ name: `V3 Partners — Mensalidade ${plano === "PARTNER_PRO" ? "Partner PRO" : "Partner"}${temDesconto ? ` (${descontoPercent}% desc. indicação)` : ""}`, amount: valor }],
        notifications: { formats: ["EMAIL"], by_email: { should_notify: true } },
      }),
      idempotencyKey: randomUUID(),
    });

    if (!res.ok) return;
    const coraData = await res.json() as {
      id?: string;
      pix?: { emv?: string; qr_code?: string };
      payment_options?: { bank_slip?: { digitable?: string; url?: string } };
    };

    await db.from("partner_subscriptions").insert({
      partner_id:      partnerId,
      plano,
      amount_cents:    valor,
      due_date:        dueDateStr,
      cora_invoice_id: coraData.id,
      status:          "PENDING",
      pix_emv:         coraData.pix?.emv,
      pix_qr_code:     coraData.pix?.qr_code,
      boleto_barcode:  coraData.payment_options?.bank_slip?.digitable,
      boleto_pdf:      coraData.payment_options?.bank_slip?.url,
    });
  } catch (e) {
    console.error("Erro ao gerar próxima cobrança:", e);
  }
}

// Cora envia webhook com evento de pagamento
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      id: string;
      type: string;
      data?: {
        id?: string;
        status?: string;
        code?: string;
        payment_date?: string;
      };
    };

    // Apenas eventos de pagamento confirmado
    const isPaid = body.type === "invoice.paid" || body.data?.status === "PAID";
    if (!isPaid) {
      return NextResponse.json({ received: true });
    }

    const invoiceId = body.data?.id ?? body.id;
    if (!invoiceId) return NextResponse.json({ received: true });

    // Rota é pública (Cora não envia cookie de sessão) e não há assinatura
    // documentada no payload — nunca confiar no corpo do POST. Reconsulta a
    // fatura na própria API da Cora antes de processar qualquer pagamento.
    try {
      const verifyRes = await coraFetch(`/v2/invoices/${invoiceId}`, { method: "GET" });
      const verifyData = verifyRes.ok ? await verifyRes.json() as { status?: string } : null;
      if (!verifyRes.ok || verifyData?.status !== "PAID") {
        console.error(`Cora webhook: fatura ${invoiceId} não confirmada como PAID na API (status HTTP ${verifyRes.status}, status fatura ${verifyData?.status})`);
        return NextResponse.json({ received: true, verified: false });
      }
    } catch (e) {
      console.error(`Cora webhook: erro ao reconsultar fatura ${invoiceId} na API Cora:`, e);
      return NextResponse.json({ received: true, verified: false });
    }

    const db = svc();
    const paidAt = body.data?.payment_date ?? new Date().toISOString();

    // 1. Atualiza cadastro pendente de adesão
    const { data: reg } = await db
      .from("partner_registrations")
      .select("id, plano, email, nome_completo, razao_social, referred_by_partner_id")
      .eq("cora_invoice_id", invoiceId)
      .single();

    if (reg) {
      await db.from("partner_registrations").update({
        cora_invoice_status: "PAID",
        cora_paid_at: paidAt,
        status: "PAGO",
      }).eq("id", reg.id);

      // Notifica admins
      const { data: admins } = await db
        .from("profiles")
        .select("id")
        .in("role", ["ADMIN", "FINANCEIRO"]);
      if (admins?.length) {
        await db.from("notifications").insert(
          admins.map((a: { id: string }) => ({
            user_id: a.id,
            type: "commission",
            title: "Pagamento de Adesão Confirmado",
            message: `${reg.nome_completo ?? reg.razao_social} (${reg.plano}) pagou a adesão via Cora.`,
            action_url: "/financeiro",
            read: false,
          }))
        ).then(null, () => {});
      }

      // Ativa desconto do referenciador (10% por 6 meses)
      if (reg.referred_by_partner_id) {
        const nomeIndicado = reg.nome_completo ?? reg.razao_social ?? "Seu indicado";
        await db.from("profiles").update({
          referral_discount_percent: 10,
          referral_discount_months_remaining: 6,
        }).eq("id", reg.referred_by_partner_id).then(null, () => {});

        await db.from("notifications").insert({
          user_id:    reg.referred_by_partner_id,
          type:       "commission",
          title:      "Indicação convertida! 🎉",
          message:    `${nomeIndicado} pagou a adesão V3 Partners. Você ganhou 10% de desconto nas próximas 6 mensalidades!`,
          action_url: "/indicacoes",
          read:       false,
        }).then(null, () => {});
      }
    }

    // 2. Atualiza mensalidade e gera próxima cobrança automaticamente
    const { data: sub } = await db
      .from("partner_subscriptions")
      .select("id, partner_id, plano")
      .eq("cora_invoice_id", invoiceId)
      .single();

    if (sub) {
      await db.from("partner_subscriptions").update({
        status: "PAID",
        paid_at: paidAt,
      }).eq("id", sub.id);

      // Estende validade no profile por 1 mês
      const newExpiry = new Date();
      newExpiry.setMonth(newExpiry.getMonth() + 1);
      await db.from("profiles").update({
        subscription_status: "ATIVO",
        subscription_expires_at: newExpiry.toISOString(),
      }).eq("id", sub.partner_id);

      // Notifica o partner
      await db.from("notifications").insert({
        user_id: sub.partner_id,
        type: "commission",
        title: "Mensalidade Paga!",
        message: `Sua mensalidade foi confirmada. Acesso garantido até ${newExpiry.toLocaleDateString("pt-BR")}.`,
        action_url: "/minha-assinatura",
        read: false,
      }).then(null, () => {});

      // Gera cobrança do mês seguinte automaticamente (#8)
      await gerarProximaCobranca(db, sub.partner_id, sub.plano);
    }

    // 3. Pagamento de serviço vendido por partner (partner_service_orders)
    const { data: serviceOrder } = await db
      .from("partner_service_orders")
      .select("id, partner_id, client_name, client_email, client_doc, link_id, partner_service_links(title, service_type, price_cents), partner:profiles!partner_id(full_name)")
      .eq("cora_invoice_id", invoiceId)
      .eq("status", "PENDING")
      .single();

    if (serviceOrder) {
      await reconcilePartnerLinkOrderPaid(
        db,
        serviceOrder as unknown as Parameters<typeof reconcilePartnerLinkOrderPaid>[1],
        paidAt
      );
    }

    // 3b. Venda direta na landing page pública /analise, sem link de partner
    // (source='direct', link_id NULL). ref_partner_id é só atribuição opcional:
    // comissão fica pendente de lançamento manual pela Mesa/Financeiro, mesmo
    // padrão já usado para todo o resto do sistema hoje (commissions não tem
    // trigger automático, decisão registrada na sessão que criou esta feature).
    const { data: directOrder } = await db
      .from("partner_service_orders")
      .select("id, ref_partner_id, client_name, client_email, client_doc, service_type, amount_cents, cnpj_count, cpf_count, has_consultancy, ref_partner:profiles!ref_partner_id(full_name)")
      .eq("cora_invoice_id", invoiceId)
      .eq("status", "PENDING")
      .eq("source", "direct")
      .single();

    if (directOrder) {
      await reconcileDirectOrderPaid(
        db,
        directOrder as unknown as Parameters<typeof reconcileDirectOrderPaid>[1],
        paidAt
      );
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Cora webhook error:", e);
    return NextResponse.json({ received: true }); // sempre 200 para não retry
  }
}
