import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { coraFetch } from "@/lib/cora";
import { randomUUID } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const PLANO_VALOR: Record<string, number> = {
  PARTNER: 19700,
  PARTNER_PRO: 39700,
};

async function gerarProximaCobranca(db: ReturnType<typeof svc>, partnerId: string, plano: string) {
  try {
    const { data: profile } = await db
      .from("profiles")
      .select("full_name, cpf, cnpj, email, referral_discount_percent, referral_discount_months_remaining")
      .eq("id", partnerId)
      .single();

    if (!profile) return;

    const documento = (profile as { cpf?: string; cnpj?: string }).cpf ?? (profile as { cpf?: string; cnpj?: string }).cnpj ?? "";
    const baseValor = PLANO_VALOR[plano] ?? 19700;

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
        services: [{ name: `V3 Partners — Mensalidade ${plano === "PARTNER_PRO" ? "Partner PRO" : "Partner"}${temDesconto ? ` (${descontoPercent}% desc. indicação)` : ""}`, amount: valor }],
        notifications: { formats: ["EMAIL"], by_email: { should_notify: true } },
      }),
      idempotencyKey: randomUUID(),
    });

    if (!res.ok) return;
    const coraData = await res.json() as {
      id?: string;
      pix?: { emv?: string; qr_code?: string };
      bank_slip?: { pdf?: { url?: string }; our_number?: string };
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
      boleto_barcode:  coraData.bank_slip?.our_number,
      boleto_pdf:      coraData.bank_slip?.pdf?.url,
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
      .select("id, partner_id, client_name, client_email, link_id, partner_service_links(title, service_type, price_cents)")
      .eq("cora_invoice_id", invoiceId)
      .eq("status", "PENDING")
      .single();

    if (serviceOrder) {
      const intakeToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 8);
      const link = serviceOrder.partner_service_links as { title?: string; service_type?: string; price_cents?: number } | null;

      // Atualiza order como PAID e grava intake_token
      await db.from("partner_service_orders").update({
        status: "PAID",
        paid_at: paidAt,
        intake_token: intakeToken,
        intake_sent_at: new Date().toISOString(),
      }).eq("id", serviceOrder.id);

      // Incrementa receita no link atomicamente
      await db.rpc("increment_link_revenue", {
        p_link_id: serviceOrder.link_id,
        p_amount: link?.price_cents ?? 0,
      }).then(null, () => {});

      // Gera intake token no credit_intake (reutiliza tabela captacao_links via inserção direta)
      await db.from("captacao_links").insert({
        token: intakeToken,
        partner_id: serviceOrder.partner_id,
        partner_name: "V3 Partners",
        active: true,
        uses_count: 0,
      }).then(null, () => {});

      // Envia email ao cliente com link de intake via Resend
      try {
        const intakePath = link?.service_type === "credit_analysis"
          ? `/intake/cm/${intakeToken}`
          : link?.service_type === "ma_intake"
          ? `/intake/bp/${intakeToken}`
          : `/c/${intakeToken}`;

        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "V3 Partners <inteligencia@v3partners.com.br>",
            to: [serviceOrder.client_email],
            subject: `Pagamento confirmado — ${link?.title ?? "Serviço V3"}`,
            html: `
              <div style="background:#09081A;color:#F5F1E8;font-family:sans-serif;padding:40px;border-radius:8px;max-width:560px;margin:0 auto">
                <div style="color:#C9A84C;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:20px">V3 PARTNERS</div>
                <h2 style="font-size:20px;margin-bottom:12px">Pagamento confirmado</h2>
                <p style="color:#9BAFC5;font-size:13px;line-height:1.7;margin-bottom:24px">
                  Olá, <strong style="color:#F5F1E8">${serviceOrder.client_name}</strong>.<br>
                  Recebemos o pagamento de <strong style="color:#C9A84C">${link?.title ?? "seu serviço V3"}</strong>.
                  Clique no botão abaixo para preencher seus dados e dar início ao processo.
                </p>
                <a href="https://app.v3partners.com.br${intakePath}"
                   style="display:inline-block;background:#C9A84C;color:#09081A;font-weight:700;font-size:13px;padding:12px 28px;border-radius:6px;text-decoration:none">
                  Preencher meus dados
                </a>
                <p style="color:#9BAFC5;font-size:11px;margin-top:24px;line-height:1.6">
                  Nossa mesa entrará em contato em até 24h úteis após o preenchimento.<br>
                  Dúvidas: <a href="mailto:operacoes@v3partners.com.br" style="color:#C9A84C">operacoes@v3partners.com.br</a>
                </p>
              </div>
            `,
          }),
        });
      } catch (e) {
        console.error("Resend email error (service order):", e);
      }

      // Notifica o partner sobre venda confirmada
      await db.from("notifications").insert({
        user_id:    serviceOrder.partner_id,
        type:       "commission",
        title:      "Venda confirmada!",
        message:    `${serviceOrder.client_name} pagou "${link?.title ?? "serviço"}". Intake enviado por email.`,
        action_url: "/configuracoes",
        read:       false,
      }).then(null, () => {});
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Cora webhook error:", e);
    return NextResponse.json({ received: true }); // sempre 200 para não retry
  }
}
