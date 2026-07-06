-- Suporte a pagamento por cartão via InfinitePay, como alternativa ao PIX/boleto da Cora
-- na mensalidade dos partners. order_nsu enviado à InfinitePay é o próprio id da linha.
ALTER TABLE partner_subscriptions
  ADD COLUMN IF NOT EXISTS infinitepay_slug TEXT,
  ADD COLUMN IF NOT EXISTS infinitepay_checkout_url TEXT;
