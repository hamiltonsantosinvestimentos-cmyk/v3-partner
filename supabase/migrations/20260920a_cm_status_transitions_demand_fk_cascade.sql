-- Fase 5, sub-entrega 5.3 (20/09/2026): alinha a FK de auditoria do lado comprador
-- com a do lado venda.
--
-- cm_status_transitions.listing_id sempre foi ON DELETE CASCADE. A coluna demand_id,
-- adicionada na fatia 1 (20260919h), nasceu NO ACTION. Depois que a fatia 2b ligou o
-- intake de compra na maquina de estados (o intake passou a gravar 2 transicoes por
-- demanda), qualquer DELETE de investor_demands com historico falha por FK. Efeito real
-- observado em producao em 20/09/2026: a limpeza do suite E2E (que roda contra o banco
-- real a cada push) falhou inteira e deixou 6 fixtures "QA PLAYWRIGHT BUY-SIDE", 3 delas
-- com status "ativo" (dentro do universo do motor de match).
--
-- A auditoria de uma demanda nao tem sentido sem a demanda, exatamente como no lado venda.

alter table public.cm_status_transitions
  drop constraint if exists cm_status_transitions_demand_id_fkey;

alter table public.cm_status_transitions
  add constraint cm_status_transitions_demand_id_fkey
  foreign key (demand_id) references public.investor_demands(id) on delete cascade;
