-- Escolha de recorrência no cadastro do partner: mensal sem fidelidade,
-- anual via Pix/Boleto (+R$50/mês) ou anual recorrente no cartão (InfinitePay,
-- configurado manualmente pelo admin na aprovação).
ALTER TABLE partner_registrations
  ADD COLUMN IF NOT EXISTS plano_recorrencia TEXT DEFAULT 'MENSAL',
  ADD COLUMN IF NOT EXISTS cartao_recorrente_link TEXT;
