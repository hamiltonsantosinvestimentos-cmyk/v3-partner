-- Tabelas para módulo Consórcio V3 Partners
-- Execute no Supabase Dashboard > SQL Editor

create table if not exists consorcio_cartas (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('IMOVEL','VEICULO','SERVICO','OUTROS')),
  credit_value numeric not null,
  admin text not null,
  group_name text,
  quota text,
  status text not null default 'DISPONIVEL' check (status in ('DISPONIVEL','NEGOCIACAO','VENDIDA','UTILIZADA')),
  asking_price numeric not null,
  discount numeric not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists consorcio_projetos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'IMOVEL',
  credit_value numeric not null,
  status text not null default 'AGUARDANDO' check (status in ('EM_ANDAMENTO','CONCLUIDO','AGUARDANDO','CANCELADO')),
  client text not null,
  admin text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists consorcio_leads (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client text not null,
  type text not null default 'Imóvel',
  value numeric not null,
  stage text not null default 'lead',
  responsible text not null,
  quota text,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table consorcio_cartas enable row level security;
alter table consorcio_projetos enable row level security;
alter table consorcio_leads enable row level security;

-- Políticas simples: autenticados leem tudo, service_role faz tudo
create policy "autenticados leem cartas" on consorcio_cartas for select using (auth.role() = 'authenticated');
create policy "autenticados leem projetos" on consorcio_projetos for select using (auth.role() = 'authenticated');
create policy "autenticados leem leads" on consorcio_leads for select using (auth.role() = 'authenticated');
