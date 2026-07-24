-- Corrige o CHECK constraint de partner_registrations.plano, que só permitia
-- 'PARTNER' e 'PARTNER_PRO' (definido assim no bootstrap original em
-- app/api/setup/partner-registrations/route.ts). O formulário público
-- /cadastro-partner e a validacao da API (app/api/cadastro-partner/route.ts)
-- ja ofereciam e aceitavam 4 planos ha tempos: STARTER, PARTNER, PARTNER_PRO,
-- ENTERPRISE -- mas quem escolhia STARTER ou ENTERPRISE recebia
-- "Erro ao salvar cadastro" so no envio final do formulario (5 passos),
-- porque o INSERT violava esse constraint.
--
-- Seguro por construcao: os 38 registros existentes em producao (confirmado
-- em 2026-07-23) usam apenas PARTNER (7) e PARTNER_PRO (31) -- nenhuma linha
-- e afetada pelo alargamento do constraint.

ALTER TABLE IF EXISTS public.partner_registrations
  DROP CONSTRAINT IF EXISTS partner_registrations_plano_check;

ALTER TABLE IF EXISTS public.partner_registrations
  ADD CONSTRAINT partner_registrations_plano_check
  CHECK (plano IN ('STARTER', 'PARTNER', 'PARTNER_PRO', 'ENTERPRISE'));
