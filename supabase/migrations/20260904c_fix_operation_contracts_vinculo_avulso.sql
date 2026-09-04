-- ============================================================
-- MIGRATION: chk_operation_contracts_vinculo aceita qualification_batch_id
-- Date: 2026-09-04
-- Scope: P0 real achado ao testar a geracao de contrato da NCNDA Mestre
--        (vertical capital_markets). A constraint exigia deal_id OU
--        listing_id pra qualquer contrato de vertical capital_markets/ma,
--        mas a origem "avulso"/qualificacao (usada pela NCNDA Mestre e por
--        qualquer minuta de grupo livre de indicadores, ver comentario em
--        app/api/contracts/generate/route.ts) foi desenhada de proposito
--        pra NUNCA depender de listing/deal pre-existente -- o vinculo
--        real dela e o proprio qualification_batch_id. Bloqueio nunca
--        exercitado antes porque nenhum contrato real de vertical
--        capital_markets tinha sido gerado por essa origem ate agora.
-- Rollback:
--   alter table public.operation_contracts drop constraint chk_operation_contracts_vinculo;
--   alter table public.operation_contracts add constraint chk_operation_contracts_vinculo
--     check (vertical not in ('capital_markets','ma') or deal_id is not null or listing_id is not null);
-- ============================================================

alter table public.operation_contracts drop constraint chk_operation_contracts_vinculo;

alter table public.operation_contracts add constraint chk_operation_contracts_vinculo
  check (
    vertical not in ('capital_markets', 'ma')
    or deal_id is not null
    or listing_id is not null
    or qualification_batch_id is not null
  );
