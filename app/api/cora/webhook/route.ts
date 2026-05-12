import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Cora envia webhook com evento de pagamento
// Docs: POST /api/cora/webhook
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

    // 1. Atualiza cadastro pendente se existir cobrança para este invoice
    const { data: reg } = await db
      .from("partner_registrations")
      .select("id, plano, email, nome_completo, razao_social")
      .eq("cora_invoice_id", invoiceId)
      .single();

    if (reg) {
      await db.from("partner_registrations").update({
        cora_invoice_status: "PAID",
        cora_paid_at: paidAt,
        status: "PAGO",
      }).eq("id", reg.id);

      // Notifica admin via notifications table
      await db.from("notifications").insert({
        type: "CADASTRO_PAGO",
        title: "Pagamento de Cadastro Confirmado",
        message: `Partner ${reg.nome_completo ?? reg.razao_social} (${reg.plano}) pagou a adesão via Cora.`,
        metadata: { registration_id: reg.id, invoice_id: invoiceId },
        read: false,
      }).catch(() => {});
    }

    // 2. Atualiza mensalidade de renovação se existir
    const { data: sub } = await db
      .from("partner_subscriptions")
      .select("id, partner_id")
      .eq("cora_invoice_id", invoiceId)
      .single();

    if (sub) {
      await db.from("partner_subscriptions").update({
        status: "PAID",
        paid_at: paidAt,
      }).eq("id", sub.id);

      // Atualiza subscription_status e validade no profile
      const newExpiry = new Date();
      newExpiry.setMonth(newExpiry.getMonth() + 1);
      await db.from("profiles").update({
        subscription_status: "ATIVO",
        subscription_expires_at: newExpiry.toISOString(),
      }).eq("id", sub.partner_id);
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Cora webhook error:", e);
    return NextResponse.json({ received: true }); // sempre 200 para não retry
  }
}
