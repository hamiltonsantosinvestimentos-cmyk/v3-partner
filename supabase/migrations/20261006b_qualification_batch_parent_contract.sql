-- Termo de Adesão ao NCNDA Mestre (BRIEF 06/10/2026).
-- O lote de qualificação dos ADERENTES precisa lembrar a qual contrato de origem (assinado)
-- ele pertence, sem usar operation_contract_id (que na rota de qualificação grava dados de
-- volta no contrato e alteraria o contrato assinado). Coluna nullable, sem default, FK.
-- Rollback: drop index idx_cm_qualification_batches_parent_contract; alter table
-- public.cm_qualification_batches drop column parent_contract_id;

alter table public.cm_qualification_batches
  add column if not exists parent_contract_id uuid references public.operation_contracts(id);

create index if not exists idx_cm_qualification_batches_parent_contract
  on public.cm_qualification_batches (parent_contract_id)
  where parent_contract_id is not null;
