-- Fase 5, sub-entrega 5.3, fatia 1/N (19/09/2026). Achado real testando a
-- migration anterior (20260919h) ao vivo antes de seguir: cm_status_transitions.
-- listing_id era NOT NULL desde a criacao original da tabela (so o lado
-- venda existia entao). Generalizar pro lado compra (demand_id) exige
-- relaxar essa constraint -- uma linha agora tem listing_id OU demand_id,
-- nunca os dois, nunca nenhum dos dois.

alter table public.cm_status_transitions
  alter column listing_id drop not null;

alter table public.cm_status_transitions
  add constraint cm_status_transitions_listing_xor_demand
  check (
    (listing_id is not null and demand_id is null)
    or (listing_id is null and demand_id is not null)
  );
