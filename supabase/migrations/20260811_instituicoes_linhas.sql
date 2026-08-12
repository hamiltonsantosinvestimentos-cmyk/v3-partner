-- Migration: instituicoes_linhas
-- Cadastro de linhas/produtos por instituição parceira + dados de contato e acesso ao portal,
-- para a Mesa Operacional encaixar o perfil do cliente na instituição/linha certa.

-- Campos adicionais em instituicoes: contato responsável + acesso ao portal da instituição
alter table public.instituicoes
  add column if not exists contato_nome     text,
  add column if not exists contato_telefone text,
  add column if not exists contato_email    text,
  add column if not exists portal_url       text,
  add column if not exists portal_usuario   text,
  add column if not exists portal_senha     text,
  add column if not exists observacoes      text;

comment on column public.instituicoes.portal_senha is
  'Credencial do portal da instituição parceira (uso interno da Mesa Operacional). Acesso restrito via service_role — nunca exposto ao client sem auth.';

-- Linhas de crédito/produto oferecidas por cada instituição
create table if not exists public.instituicoes_linhas (
  id                      uuid primary key default gen_random_uuid(),
  instituicao_id          uuid not null references public.instituicoes(id) on delete cascade,
  nome                    text not null,
  categoria               text,
  cor                     text,
  emoji                   text,
  tipo_pessoa             text not null default 'AMBOS' check (tipo_pessoa in ('PF', 'PJ', 'AMBOS')),
  requer_imovel           boolean not null default false,
  bloqueia_restricao      boolean not null default true,
  valor_minimo            numeric,
  valor_maximo            numeric,
  ltv_maximo              numeric,
  min_renda_mensal        numeric,
  min_faturamento_mensal  numeric,
  score_base              integer,
  keywords_finalidade     text[],
  descricao               text,
  observacoes_internas    text,
  ativo                   boolean not null default true,
  ordem                   integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists instituicoes_linhas_instituicao_id_idx on public.instituicoes_linhas(instituicao_id);

drop trigger if exists instituicoes_linhas_updated_at on public.instituicoes_linhas;
create trigger instituicoes_linhas_updated_at
  before update on public.instituicoes_linhas
  for each row execute function public.set_updated_at();

alter table public.instituicoes_linhas enable row level security;

drop policy if exists "service_role full access" on public.instituicoes_linhas;
create policy "service_role full access"
  on public.instituicoes_linhas
  using (true)
  with check (true);

-- Rollback:
-- drop table if exists public.instituicoes_linhas cascade;
-- alter table public.instituicoes
--   drop column if exists contato_nome,
--   drop column if exists contato_telefone,
--   drop column if exists contato_email,
--   drop column if exists portal_url,
--   drop column if exists portal_usuario,
--   drop column if exists portal_senha,
--   drop column if exists observacoes;
