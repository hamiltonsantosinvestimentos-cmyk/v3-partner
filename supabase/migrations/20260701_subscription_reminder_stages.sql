-- Rastreia envio de cada estágio da cadência de cobrança (D-5, D-3, D-1)
-- para não reenviar a mesma mensagem em execuções seguintes do cron.
ALTER TABLE partner_subscriptions
  ADD COLUMN IF NOT EXISTS zap_d5_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS zap_d3_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS zap_d1_sent_at TIMESTAMPTZ;
