-- Ajustes de segurança da API de Propostas (BRIEF docs/briefs/2026-11-06_api-v1-ajustes-seguranca.md)
-- Envios pendentes (limite e limpeza), reserva de Idempotency-Key e controle de repetição de alertas.
-- Mesma regra da 20261106a: RLS ligada, nada para anon/authenticated, acesso só pelas rotas de servidor.

begin;

create table if not exists public.partner_api_uploads (
  id              uuid primary key default gen_random_uuid(),
  key_id          uuid not null references public.partner_api_keys(id),
  partner_id      uuid not null references public.profiles(id),
  proposal_id     uuid not null references public.credit_desk_proposals(id) on delete cascade,
  storage_path    text not null unique,
  tipo_documento  text not null,
  criado_em       timestamptz not null default now(),
  expira_em       timestamptz not null,
  confirmado_em   timestamptz
);
create index if not exists partner_api_uploads_pendentes_idx
  on public.partner_api_uploads (key_id, criado_em) where confirmado_em is null;

create table if not exists public.partner_api_idempotencia (
  key_id           uuid not null references public.partner_api_keys(id),
  idempotency_key  text not null check (char_length(idempotency_key) between 1 and 100),
  status           text not null check (status in ('em_andamento','concluida')),
  proposal_id      uuid references public.credit_desk_proposals(id) on delete set null,
  criado_em        timestamptz not null default now(),
  primary key (key_id, idempotency_key)
);

create table if not exists public.partner_api_alertas (
  id          uuid primary key default gen_random_uuid(),
  tipo        text not null,
  referencia  text not null,
  enviado_em  timestamptz not null default now()
);
create index if not exists partner_api_alertas_ref_idx on public.partner_api_alertas (tipo, referencia, enviado_em desc);

alter table public.partner_api_uploads      enable row level security;
alter table public.partner_api_idempotencia enable row level security;
alter table public.partner_api_alertas      enable row level security;

revoke all on public.partner_api_uploads      from anon, authenticated;
revoke all on public.partner_api_idempotencia from anon, authenticated;
revoke all on public.partner_api_alertas      from anon, authenticated;

commit;
