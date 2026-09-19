-- Correcao 19/09/2026, achado real de Joao sobre a pre-qualificacao criada
-- horas antes (migration 20260919b): exigir o NOME REAL do cedente/mandatario
-- ja na pre-qualificacao quebra o proprio protocolo de duplo-cego da V3 --
-- muitas vezes a identidade so pode ser revelada depois de reuniao + NCNDA
-- assinado, e o partner que origina pode nem conhecer o nome verdadeiro ainda
-- (ele pode estar 2+ intermediarios distante do cedente/mandatario real).
--
-- cm_asset_listings.apelido ja existe e ja e o padrao usado pra exibicao
-- "as-cegas" em outros pontos do sistema (mesa-capitais-client.tsx). Falta o
-- equivalente do lado comprador -- investor_demands nunca teve essa coluna.

alter table public.investor_demands
  add column if not exists apelido text;

comment on column public.investor_demands.apelido is
  'Apelido/codinome da demanda de compra, usado na pre-qualificacao da originacao (19/09/2026) em vez do nome_contato real -- mesmo principio de duplo-cego ja aplicado a cm_asset_listings.apelido.';
