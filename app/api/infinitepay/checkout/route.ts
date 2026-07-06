import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createCheckoutLink } from "@/lib/infinitepay";
import { planoLabel } from "@/lib/whatsapp/subscription-messages";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Mesmos valores/regra de vencimento do "Gerar Cobrança" self-service da Cora
// (app/api/cora/subscription/route.ts), pra manter os dois caminhos consistentes.
const PLANO_VALOR: Record<string, number> = {
  PARTNER: 19700,
  PARTNER_PRO: 39700,
};

// POST — gera um link de checkout InfinitePay (cartão) para a mensalidade do partner logado,
// criando a cobrança PENDING na hora se ainda não existir nenhuma
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  let sub = (await svc()
    .from("partner_subscriptions")
    .select("id, amount_cents, plano")
    .eq("partner_id", user.id)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()).data;

  if (!sub) {
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + 1);
    dueDate.setDate(10);

    const valor = PLANO_VALOR[profile?.role ?? ""] ?? 19700;

    const { data: created, error } = await svc().from("partner_subscriptions").insert({
      partner_id:   user.id,
      plano:        profile?.role ?? "PARTNER",
      amount_cents: valor,
      due_date:     dueDate.toISOString().split("T")[0],
      status:       "PENDING",
    }).select("id, amount_cents, plano").single();

    if (error || !created) {
      return NextResponse.json({ error: "Não foi possível gerar a cobrança." }, { status: 500 });
    }
    sub = created;
  }

  const plano = (profile?.role as string | undefined) ?? sub.plano;

  const { ok, status, data } = await createCheckoutLink({
    orderNsu: sub.id,
    items: [{
      quantity: 1,
      price: sub.amount_cents,
      description: `V3 Partners — Mensalidade ${planoLabel(plano)}`,
    }],
    redirectUrl: "https://app.v3partners.com.br/minha-assinatura",
    webhookUrl: "https://app.v3partners.com.br/api/infinitepay/webhook",
    customer: {
      name: profile?.full_name ?? undefined,
      email: profile?.email ?? user.email ?? undefined,
    },
  });

  if (!ok) {
    return NextResponse.json({ error: `Erro InfinitePay (${status})` }, { status: 502 });
  }

  const checkoutUrl = data.url ?? data.checkout_url ?? data.payment_url ?? data.link;
  const slug = data.slug ?? data.invoice_slug;

  if (!checkoutUrl) {
    console.error("InfinitePay: resposta sem URL de checkout reconhecível:", data);
    return NextResponse.json({ error: "InfinitePay não retornou um link de checkout." }, { status: 502 });
  }

  await svc().from("partner_subscriptions").update({
    infinitepay_slug: slug ?? null,
    infinitepay_checkout_url: checkoutUrl,
  }).eq("id", sub.id);

  return NextResponse.json({ checkout_url: checkoutUrl });
}
