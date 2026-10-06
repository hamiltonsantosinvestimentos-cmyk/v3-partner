-- Termo de Adesão ao NCNDA Mestre (BRIEF 06/10/2026).
-- 1) Série de numeração V3C-ADE (sigla proposta por Claude, a confirmar com João antes de aplicar).
-- 2) operation_contracts.parent_contract_id: vínculo do Termo (filho) ao contrato de origem (pai).
--    Coluna nullable, sem default, FK para a própria tabela. O pai nunca é alterado por essa relação.
-- 3) Trava: o vínculo é gravado na criação e não pode ser regravado depois.

insert into public.v3_code_series
  (id, label, prefix, segment_class, scope_grain, seq_width, target_table, target_column, active, notes)
values
  ('V3C-ADE', 'Termo de Adesão a Acordo Mestre', 'V3C-ADE', 'none', 'ano', 4,
   'operation_contracts', 'contract_code', true,
   'Termo de Adesão a contrato com natureza de Acordo Mestre (ex: NCNDA Mestre). Série própria, distinta de V3C-NDA, porque o painel M&A identifica o NCNDA do deal pelo prefixo V3C-NDA.')
on conflict (id) do nothing;

alter table public.operation_contracts
  add column if not exists parent_contract_id uuid references public.operation_contracts(id);

alter table public.operation_contracts
  drop constraint if exists operation_contracts_parent_not_self;
alter table public.operation_contracts
  add constraint operation_contracts_parent_not_self
  check (parent_contract_id is null or parent_contract_id <> id);

create index if not exists idx_operation_contracts_parent_contract
  on public.operation_contracts (parent_contract_id)
  where parent_contract_id is not null;

create or replace function public.operation_contracts_parent_immutable()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.parent_contract_id is not null
     and new.parent_contract_id is distinct from old.parent_contract_id then
    raise exception 'parent_contract_id não pode ser alterado depois de gravado';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_operation_contracts_parent_immutable on public.operation_contracts;
create trigger trg_operation_contracts_parent_immutable
  before update of parent_contract_id on public.operation_contracts
  for each row execute function public.operation_contracts_parent_immutable();
