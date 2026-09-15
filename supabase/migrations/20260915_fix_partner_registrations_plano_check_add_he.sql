-- Corrige o CHECK constraint de partner_registrations.plano, que ficou
-- desatualizado quando o plano Partner HE foi criado (20260909b_partner_he_role.sql
-- só adicionou 'PARTNER_HE' ao enum user_role, usado em profiles.role — não
-- tocou nesse CHECK, que é de um campo text separado em partner_registrations).
--
-- Efeito em produção: qualquer candidato que preenchia o formulário público
-- /cadastro-partner-he recebia "Erro ao salvar cadastro" no envio final,
-- porque o INSERT com plano = 'PARTNER_HE' violava o constraint (só permitia
-- STARTER, PARTNER, PARTNER_PRO, ENTERPRISE). Mesma causa raiz do bug corrigido
-- em 20260723b_fix_partner_registrations_plano_check.sql, agora reincidente
-- pra um plano novo.

ALTER TABLE IF EXISTS public.partner_registrations
  DROP CONSTRAINT IF EXISTS partner_registrations_plano_check;

ALTER TABLE IF EXISTS public.partner_registrations
  ADD CONSTRAINT partner_registrations_plano_check
  CHECK (plano IN ('STARTER', 'PARTNER', 'PARTNER_PRO', 'PARTNER_HE', 'ENTERPRISE'));
