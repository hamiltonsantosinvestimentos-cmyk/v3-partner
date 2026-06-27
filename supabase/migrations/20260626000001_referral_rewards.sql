-- =====================================================
-- Referral Rewards System
-- 1. Desconto 10% por 6 meses quando indicado converte
-- 2. Comissão de indicação 10% em cada negócio fechado
-- =====================================================

-- Campos no profile do partner referenciador (recebe o desconto)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_discount_percent        INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_discount_months_remaining INT NOT NULL DEFAULT 0;

-- Vínculo no profile do partner indicado (quem foi referenciado)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referred_by_partner_id UUID REFERENCES profiles(id);

-- Flag para evitar cascata: comissões de indicação não geram novas comissões de indicação
ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS is_referral_commission BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS referral_source_commission_id UUID REFERENCES commissions(id);
