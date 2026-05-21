-- Migration: create_instituicoes
-- Portal de acesso para instituições financeiras parceiras da V3 Partners

create table if not exists public.instituicoes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  cnpj          text,
  email         text not null,
  auth_user_id  uuid references auth.users(id) on delete set null,
  status        text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index para lookup por auth_user_id (usado no login)
create index if not exists instituicoes_auth_user_id_idx on public.instituicoes(auth_user_id);

-- Index para busca por nome (usado no filtro de propostas)
create index if not exists instituicoes_nome_idx on public.instituicoes(nome);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'instituicoes_updated_at'
  ) then
    create trigger instituicoes_updated_at
      before update on public.instituicoes
      for each row execute function public.set_updated_at();
  end if;
end; $$;

-- RLS
alter table public.instituicoes enable row level security;

-- Apenas admins internos (service_role) podem ler/escrever
-- O portal usa service_role key no backend, então não precisa de policy pública
create policy "service_role full access"
  on public.instituicoes
  using (true)
  with check (true);

-- Comentário de uso:
-- Para cadastrar uma instituição:
-- 1. Criar usuário em auth.users via Supabase Auth (email + senha)
-- 2. Inserir linha em instituicoes com o auth_user_id do usuário criado
--
-- Exemplo:
-- insert into public.instituicoes (nome, cnpj, email, auth_user_id)
-- values ('Banco XYZ', '00.000.000/0001-00', 'credito@bancoxyz.com.br', '<uuid-do-auth-user>');
