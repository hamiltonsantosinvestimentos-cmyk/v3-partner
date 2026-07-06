// InfinitePay — Checkout Links API (cartão de crédito, PIX e boleto)
// Docs: https://www.infinitepay.io/checkout-documentacao
// Ao contrário da Cora, essa API não usa mTLS/client credentials: a autenticação
// é feita pelo próprio "handle" (InfiniteTag) público da loja.
const API_BASE = "https://api.checkout.infinitepay.io";

const HANDLE = process.env.INFINITEPAY_HANDLE ?? "v3-partners";

type CheckoutItem = {
  quantity: number;
  price: number; // em centavos
  description: string;
};

type CreateCheckoutLinkParams = {
  orderNsu: string;
  items: CheckoutItem[];
  redirectUrl?: string;
  webhookUrl?: string;
  customer?: { name?: string; email?: string; phone_number?: string };
};

export type CheckoutLinkResponse = {
  url?: string;
  checkout_url?: string;
  payment_url?: string;
  link?: string;
  slug?: string;
  invoice_slug?: string;
};

export async function createCheckoutLink(
  params: CreateCheckoutLinkParams
): Promise<{ ok: boolean; status: number; data: CheckoutLinkResponse }> {
  const res = await fetch(`${API_BASE}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: HANDLE,
      order_nsu: params.orderNsu,
      items: params.items,
      redirect_url: params.redirectUrl,
      webhook_url: params.webhookUrl,
      ...(params.customer ? { customer: params.customer } : {}),
    }),
  });

  let data: CheckoutLinkResponse = {};
  try { data = await res.json(); } catch { /* resposta sem corpo JSON */ }

  return { ok: res.ok, status: res.status, data };
}

export type PaymentCheckResponse = {
  success?: boolean;
  paid?: boolean;
  amount?: number;
  paid_amount?: number;
  installments?: number;
  capture_method?: string;
};

// Reconsulta o pagamento na própria API da InfinitePay — nunca confiar apenas
// no corpo do webhook (mesmo padrão defensivo usado no webhook da Cora).
export async function checkPayment(params: {
  orderNsu: string;
  transactionNsu?: string;
  slug?: string;
}): Promise<{ ok: boolean; status: number; data: PaymentCheckResponse }> {
  const res = await fetch(`${API_BASE}/payment_check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      handle: HANDLE,
      order_nsu: params.orderNsu,
      transaction_nsu: params.transactionNsu,
      slug: params.slug,
    }),
  });

  let data: PaymentCheckResponse = {};
  try { data = await res.json(); } catch { /* resposta sem corpo JSON */ }

  return { ok: res.ok, status: res.status, data };
}
