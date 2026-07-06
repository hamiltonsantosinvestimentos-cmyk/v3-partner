import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { checkPayment } from "@/lib/infinitepay";
import { sendWhatsApp, resolvePartnerPhone, buildRenovacaoManualMessage, planoLabel } from "@/lib/whatsapp/subscription-messages";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Webhook InfinitePay: confirmação de pagamento por cartão da mensalidade.
// A API não documenta assinatura/HMAC no corpo, então nunca confiamos direto
// no payload recebido — sempre reconsultamos via payment_check antes de
// marcar qualquer cobrança como paga (mesmo padrão do webhook da Cora).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      invoice_slug?: string;
      order_nsu?: string;
      transaction_nsu?: string;
      amount?: number;
      paid_amount?: number;
      capture_method?: string;
    };

    const subscriptionId = body.order_nsu;
    if (!subscriptionId) return NextResponse.json({ received: true });

    const { ok, data: check } = await checkPayment({
      orderNsu: subscriptionId,
      transactionNsu: body.transaction_nsu,
      slug: body.invoice_slug,
    });

    if (!ok || !check.paid) {
      console.error(`InfinitePay webhook: pagamento não confirmado (order_nsu ${subscriptionId})`, check);
      return NextResponse.json({ received: true, verified: false });
    }

    const db = svc();

    const { data: sub } = await db
      .from("partner_subscriptions")
      .select("id, partner_id, plano, status")
      .eq("id", subscriptionId)
      .single();

    if (!sub || sub.status === "PAID") {
      return NextResponse.json({ received: true }); // já processado ou não encontrado
    }

    const paidAt = new Date().toISOString();

    await db.from("partner_subscriptions").update({
      status: "PAID",
      paid_at: paidAt,
    }).eq("id", sub.id);

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 30);
    await db.from("profiles").update({
      trial_expires_at: newExpiry.toISOString(),
      is_active: true,
    }).eq("id", sub.partner_id);

    await db.from("notifications").insert({
      user_id: sub.partner_id,
      type: "commission",
      title: "Mensalidade Paga!",
      message: `Pagamento por cartão confirmado. Acesso garantido até ${newExpiry.toLocaleDateString("pt-BR")}.`,
      action_url: "/minha-assinatura",
      read: false,
    }).then(null, () => {});

    const phone = await resolvePartnerPhone(db, sub.partner_id);
    if (phone) {
      const { data: partner } = await db.from("profiles").select("full_name").eq("id", sub.partner_id).single();
      const msg = buildRenovacaoManualMessage({
        nome: partner?.full_name ?? "Partner",
        plano: planoLabel(sub.plano),
        novaExpiracao: newExpiry.toISOString(),
      });
      await sendWhatsApp(phone, msg);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("InfinitePay webhook error:", e);
    return NextResponse.json({ received: true }); // sempre 200 para não gerar retry storm
  }
}
