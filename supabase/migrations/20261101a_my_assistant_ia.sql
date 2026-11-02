-- MY ASSISTANT IA (Fase 1). BRIEF: docs/briefs/2026-11-01_my-assistant-ia.md
-- Exige Postgres 15 ou superior, por causa de on delete set null (mensagem_id). Conferir antes de aplicar.
-- Nada de view, função SECURITY DEFINER ou bucket. Só o servidor escreve em assistente_config.

create table if not exists public.assistente_config (
  user_id uuid primary key references auth.users(id) on delete cascade,
  openwa_session_id text unique,
  phone_e164 text unique,
  whatsapp_id text unique,
  phone_verificado_em timestamptz,
  ativo boolean not null default true,
  ultima_limpeza_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.assistente_verificacao (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_e164 text not null,
  codigo_hash text not null,
  expira_em timestamptz not null,
  tentativas smallint not null default 0,
  envios_na_hora smallint not null default 1,
  janela_envios_inicio timestamptz not null default now()
);

create table if not exists public.assistente_mensagens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wa_message_id text not null,
  tipo text not null check (tipo in ('texto', 'audio', 'outro')),
  texto text,
  status text not null default 'recebida'
    check (status in ('recebida', 'processada', 'aguardando_resposta', 'falhou', 'ignorada')),
  pendencia jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, wa_message_id),
  unique (id, user_id)
);

create table if not exists public.assistente_lancamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida')),
  valor_centavos bigint not null check (valor_centavos between 1 and 1000000000),
  categoria text not null,
  descricao text,
  data date not null,
  origem text not null check (origem in ('whatsapp', 'tela')),
  mensagem_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (mensagem_id, user_id)
    references public.assistente_mensagens(id, user_id) on delete set null (mensagem_id)
);
create index if not exists assistente_lancamentos_user_data_idx
  on public.assistente_lancamentos (user_id, data desc, created_at desc);

create table if not exists public.assistente_compromissos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  inicio timestamptz not null,
  fim timestamptz,
  local text,
  notas text,
  origem text not null check (origem in ('whatsapp', 'tela')),
  mensagem_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fim is null or fim >= inicio),
  foreign key (mensagem_id, user_id)
    references public.assistente_mensagens(id, user_id) on delete set null (mensagem_id)
);
create index if not exists assistente_compromissos_user_inicio_idx
  on public.assistente_compromissos (user_id, inicio);

alter table public.assistente_config enable row level security;
alter table public.assistente_verificacao enable row level security;
alter table public.assistente_mensagens enable row level security;
alter table public.assistente_lancamentos enable row level security;
alter table public.assistente_compromissos enable row level security;

revoke all on public.assistente_config, public.assistente_verificacao,
  public.assistente_mensagens, public.assistente_lancamentos,
  public.assistente_compromissos from public, anon, authenticated;

grant select on public.assistente_config to authenticated;
grant select, insert, update, delete on public.assistente_lancamentos to authenticated;
grant select, insert, update, delete on public.assistente_compromissos to authenticated;

drop policy if exists assistente_config_dono on public.assistente_config;
create policy assistente_config_dono on public.assistente_config
  for select to authenticated using (user_id = auth.uid());

drop policy if exists assistente_lancamentos_dono on public.assistente_lancamentos;
create policy assistente_lancamentos_dono on public.assistente_lancamentos
  for all to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.assistente_config c where c.user_id = auth.uid() and c.ativo)
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.assistente_config c where c.user_id = auth.uid() and c.ativo)
  );

drop policy if exists assistente_compromissos_dono on public.assistente_compromissos;
create policy assistente_compromissos_dono on public.assistente_compromissos
  for all to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.assistente_config c where c.user_id = auth.uid() and c.ativo)
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.assistente_config c where c.user_id = auth.uid() and c.ativo)
  );
