-- Grade de comissionamento por grupo (BRIEF 06/10/2026).
-- Um link de intake por grupo (venda, compra, assessoria) para 1 representante declarar o percentual
-- de cada participante. Tabela nova, sem alterar tabela existente. RLS ligada e SEM policy: só o
-- service role (rotas do servidor) acessa. A página pública nunca recebe CPF, e-mail, telefone nem dado bancário.
-- Rollback: drop table public.cm_commission_grids;

create table if not exists public.cm_commission_grids (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  group_code text not null check (group_code in ('venda', 'compra', 'assessoria')),
  group_percent numeric(5,2) not null check (group_percent > 0 and group_percent <= 100),
  source_contract_id uuid references public.operation_contracts(id),
  -- [{ qualification_id, name, fixed_percent? }] na ordem canônica das partes (snapshot na criação do link)
  participants jsonb not null default '[]'::jsonb,
  -- [{ qualification_id, percent }] preenchido no envio
  allocations jsonb,
  -- linhas fixas sem qualificação (ex: V3 Partners 60% na assessoria): [{ label, percent }]
  fixed_allocations jsonb not null default '[]'::jsonb,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'substituido')),
  representative_name text,
  representative_email text,
  representative_phone text,
  submitted_by_name text,
  submitted_at timestamptz,
  acknowledged_at timestamptz,
  token_expires_at timestamptz not null,
  reopened_count integer not null default 0,
  reopen_log jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No máximo uma grade ativa (pendente ou enviada) por grupo.
create unique index if not exists uq_cm_commission_grids_group_ativa
  on public.cm_commission_grids (group_code)
  where status in ('pendente', 'enviado');

create index if not exists idx_cm_commission_grids_source
  on public.cm_commission_grids (source_contract_id);

alter table public.cm_commission_grids enable row level security;

drop trigger if exists trg_cm_commission_grids_updated_at on public.cm_commission_grids;
create trigger trg_cm_commission_grids_updated_at
  before update on public.cm_commission_grids
  for each row execute function set_updated_at();
