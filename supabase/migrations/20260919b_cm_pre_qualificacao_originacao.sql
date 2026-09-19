-- Pre-qualificacao da originacao (19/09/2026, pedido de Joao Lemos): antes
-- de gerar o link de intake para o parceiro (venda, cm_asset_listings) ou
-- para o mandatario de compra (investor_demands), a Mesa/partner precisa
-- registrar a distancia real ate o cedente/mandatario e a ciencia da cadeia
-- de intermediarios envolvidos. Coluna separada de intake_data de proposito:
-- o POST publico de conclusao do intake SOBRESCREVE intake_data inteiro,
-- entao guardar a pre-qualificacao ali apagaria o registro da Mesa assim
-- que o parceiro enviasse o formulario dele.

alter table public.cm_asset_listings
  add column if not exists pre_qualificacao jsonb;

alter table public.investor_demands
  add column if not exists pre_qualificacao jsonb;

comment on column public.cm_asset_listings.pre_qualificacao is
  'Checklist de qualidade da originacao preenchido pela Mesa/partner ANTES de gerar o link de intake: distancia_cedente, ciencia_cadeia, qualified_by, qualified_at. Nunca sobrescrito pelo POST publico de intake (que so escreve em intake_data).';
comment on column public.investor_demands.pre_qualificacao is
  'Mesmo mecanismo de cm_asset_listings.pre_qualificacao, aplicado ao lado comprador (Link Comprador / mandatario da compra).';
