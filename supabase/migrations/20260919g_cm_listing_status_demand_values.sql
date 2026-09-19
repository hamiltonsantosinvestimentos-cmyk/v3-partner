-- Fase 5, sub-entrega 5.3, fatia 1/N (19/09/2026). cm_status_transitions.
-- from_status/to_status sao tipados como cm_listing_status -- pra
-- generalizar a mesma tabela de auditoria pro lado comprador (decisao
-- registrada no BRIEF formal), o enum precisa dos 3 valores que so o lado
-- compra usa (o lado venda ja tem os proprios equivalentes: ativo_vitrine,
-- em_escrow_due_diligence, liquidado).
--
-- Isolado numa migration propria de proposito -- ALTER TYPE ADD VALUE
-- precisa comitar antes de ser referenciado (mesma licao da migration
-- 20260919d, mais cedo nesta mesma sessao).

alter type cm_listing_status add value if not exists 'ativo';
alter type cm_listing_status add value if not exists 'em_negociacao';
alter type cm_listing_status add value if not exists 'concluido';
