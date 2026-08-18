-- =============================================================================
-- INVESTOR_DEMANDS: PARTNER DE ORIGEM SEM CONTA NO PORTAL (REFERRAL)
-- =============================================================================
--
-- CONTEXTO
--   Joao pediu (18/08/2026) que o botao "Link Comprador" da Mesa de Capitais
--   permita atribuir o partner dono do lead no momento de gerar o link. A
--   coluna origin_partner_id ja existia (FK para profiles), mas so cobre
--   partner com conta real no portal. cm_asset_listings ja resolve o mesmo
--   problema do lado vendedor com DOIS campos: originator_profile_id (conta
--   real) + originator_referral_id (FK para cm_referral_partners, partner
--   leve sem login, ja usado em producao desde antes desta migration). Esta
--   migration so espelha o mesmo padrao pro lado comprador, reusando a MESMA
--   tabela cm_referral_partners e a MESMA rota /api/cm/referral-partners
--   (REUSE > ADAPT > CREATE, ~/.claude/rules/v3-numbering-governance.md) --
--   nenhuma tabela nova.
--
-- SEGURANCA EM PRODUCAO
--   100% aditivo: 1 coluna nova nullable em investor_demands. Nenhuma linha
--   existente afetada (fica NULL, mesmo comportamento de hoje).
-- =============================================================================

alter table public.investor_demands
  add column if not exists origin_referral_id uuid references public.cm_referral_partners(id);

comment on column public.investor_demands.origin_referral_id is
  'Partner de origem sem conta no portal (cm_referral_partners), espelha cm_asset_listings.originator_referral_id do lado vendedor. Mutuamente exclusivo com origin_partner_id na pratica (resolvido no servidor: um ou outro, nunca os dois), mas nao ha constraint de banco pra isso -- mesmo criterio ja usado do lado vendedor.';
