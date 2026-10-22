-- Oferta única (22/10/2026): planos V3 Gold (R$ 397/mês, 25%) e V3 Diamante (R$ 897/mês, 40%),
-- com 30 dias grátis e sem fidelidade. Ver lib/oferta-trial.ts.
--
-- São DOIS lugares independentes (o lançamento do Partner HE quebrou por esquecer o segundo):
--   1. enum user_role (profiles.role)
--   2. CHECK de partner_registrations.plano (INSERT do formulário público de cadastro)
--
-- Rodar no SQL Editor do Supabase. ADD VALUE não pode ser usado na mesma transação em que é
-- criado; aqui o CHECK é texto, então não usa o enum e pode vir no mesmo arquivo.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'GOLD';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DIAMANTE';

ALTER TABLE IF EXISTS public.partner_registrations
  DROP CONSTRAINT IF EXISTS partner_registrations_plano_check;

ALTER TABLE IF EXISTS public.partner_registrations
  ADD CONSTRAINT partner_registrations_plano_check
  CHECK (plano IN ('STARTER', 'PARTNER', 'PARTNER_PRO', 'PARTNER_HE', 'GOLD', 'DIAMANTE', 'ENTERPRISE'));
