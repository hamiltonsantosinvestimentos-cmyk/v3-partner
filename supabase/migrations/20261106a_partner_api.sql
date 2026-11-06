-- API de Propostas para partners (BRIEF docs/briefs/2026-11-06_api-partner-propostas-credito.md)
-- Tabelas da chave de API, termo de uso, aceites, códigos de e-mail, log de chamadas, bloqueios,
-- incidentes e PLD da proposta. Tudo fechado para anon e authenticated; acesso pelas rotas de
-- servidor com a chave de serviço. Única exceção: o partner lê as próprias chaves (sem o hash)
-- pela view partner_api_keys_minhas, com a sessão dele (security_invoker + política por auth.uid()).

begin;

-- ── Termo de uso: texto integral de cada versão (somente inserção) ──────────────────────────
create table if not exists public.partner_api_termos (
  id               uuid primary key default gen_random_uuid(),
  versao           text not null unique,
  texto            text not null,
  hash             text not null,
  vigencia_inicio  timestamptz not null,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now()
);

-- ── Aceites do termo (somente inserção) ─────────────────────────────────────────────────────
create table if not exists public.partner_api_termo_aceites (
  id                   uuid primary key default gen_random_uuid(),
  partner_id           uuid not null references public.profiles(id),
  user_id              uuid not null references public.profiles(id),
  versao               text not null references public.partner_api_termos(versao),
  texto_hash           text not null,
  aceite_geral         boolean not null check (aceite_geral),
  aceite_destaques     boolean not null check (aceite_destaques),
  poderes_confirmados  boolean not null check (poderes_confirmados),
  ip                   text,
  user_agent           text,
  dispositivo          text,
  sessao_id            text,
  aceito_em            timestamptz not null default now()
);
create index if not exists partner_api_termo_aceites_partner_idx on public.partner_api_termo_aceites (partner_id, versao);

-- ── Código de confirmação por e-mail para criar chave ───────────────────────────────────────
create table if not exists public.partner_api_codigos (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.profiles(id),
  codigo_hash  text not null,
  expira_em    timestamptz not null,
  usado_em     timestamptz,
  tentativas   int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists partner_api_codigos_partner_idx on public.partner_api_codigos (partner_id, created_at desc);

-- ── Chaves ──────────────────────────────────────────────────────────────────────────────────
create table if not exists public.partner_api_keys (
  id                    uuid primary key default gen_random_uuid(),
  partner_id            uuid not null references public.profiles(id),
  nome                  text not null check (char_length(nome) between 3 and 80),
  prefixo               text not null,
  key_hash              text not null unique,
  escopos               text[] not null check (escopos <@ array['propostas:criar','propostas:ler']::text[] and cardinality(escopos) > 0),
  ips_permitidos        cidr[] not null check (cardinality(ips_permitidos) between 1 and 10),
  expira_em             timestamptz not null,
  termo_versao          text not null references public.partner_api_termos(versao),
  limite_por_minuto     int not null default 60 check (limite_por_minuto between 1 and 600),
  limite_propostas_dia  int not null default 200 check (limite_propostas_dia between 1 and 5000),
  criada_por            uuid not null references public.profiles(id),
  ultimo_uso_em         timestamptz,
  ultimo_ip             text,
  aviso_vencimento_em   timestamptz,
  revogada_em           timestamptz,
  revogada_por          uuid references public.profiles(id),
  motivo_revogacao      text,
  created_at            timestamptz not null default now()
);
create index if not exists partner_api_keys_partner_idx on public.partner_api_keys (partner_id, created_at desc);

-- ── Log de chamadas (12 meses; limpeza pelo cron) ───────────────────────────────────────────
create table if not exists public.partner_api_requests (
  id               bigserial primary key,
  key_id           uuid references public.partner_api_keys(id),
  partner_id       uuid references public.profiles(id),
  idempotency_key  text,
  metodo           text not null,
  rota             text not null,
  status_http      int not null,
  codigo_erro      text,
  proposal_id      uuid,
  ip               text,
  created_at       timestamptz not null default now()
);
create unique index if not exists partner_api_requests_idem_uq
  on public.partner_api_requests (key_id, idempotency_key) where idempotency_key is not null and proposal_id is not null;
create index if not exists partner_api_requests_key_idx on public.partner_api_requests (key_id, created_at desc);
create index if not exists partner_api_requests_ip_idx on public.partner_api_requests (ip, created_at desc) where status_http = 401;
create index if not exists partner_api_requests_created_idx on public.partner_api_requests (created_at);

-- ── Bloqueio de IP por tentativas com chave inválida ────────────────────────────────────────
create table if not exists public.partner_api_bloqueios (
  id          uuid primary key default gen_random_uuid(),
  ip          text not null,
  motivo      text not null,
  ate         timestamptz not null,
  created_at  timestamptz not null default now()
);
create index if not exists partner_api_bloqueios_ip_idx on public.partner_api_bloqueios (ip, ate desc);

-- ── Incidentes de segurança (5 anos; somente inserção) ──────────────────────────────────────
create table if not exists public.partner_api_incidentes (
  id              uuid primary key default gen_random_uuid(),
  ocorrido_em     timestamptz not null,
  partner_id      uuid references public.profiles(id),
  key_id          uuid references public.partner_api_keys(id),
  descricao       text not null check (char_length(descricao) >= 10),
  medidas         text,
  corrige_id      uuid references public.partner_api_incidentes(id),
  registrado_por  uuid not null references public.profiles(id),
  created_at      timestamptz not null default now()
);

-- ── PLD informado pelo partner (cláusula 7.4): só a mesa vê ─────────────────────────────────
-- Tabela separada de credit_desk_proposals de propósito: o partner lê a própria proposta
-- (inclusive metadata) e não pode ver o PLD.
create table if not exists public.credit_proposal_pld (
  proposal_id            uuid primary key references public.credit_desk_proposals(id) on delete cascade,
  pep                    text check (pep in ('SIM','NAO','NAO_SEI')),
  beneficiario_final     jsonb,
  circunstancia_atipica  text check (circunstancia_atipica is null or char_length(circunstancia_atipica) <= 2000),
  informado_por_key      uuid references public.partner_api_keys(id),
  created_at             timestamptz not null default now()
);

-- ── Colunas novas na proposta (nulas, compatíveis) ──────────────────────────────────────────
alter table public.credit_desk_proposals add column if not exists origem text check (origem is null or origem in ('plataforma','api'));
alter table public.credit_desk_proposals add column if not exists referencia_externa text check (referencia_externa is null or char_length(referencia_externa) <= 80);
create unique index if not exists credit_desk_proposals_ref_externa_uq
  on public.credit_desk_proposals (partner_id, referencia_externa) where referencia_externa is not null;

-- ── Somente inserção: termos, aceites e incidentes ──────────────────────────────────────────
create or replace function public.partner_api_somente_insercao() returns trigger
language plpgsql set search_path = public as $$
begin
  raise exception 'Registro imutável: % não aceita % (BRIEF API de Propostas)', tg_table_name, tg_op;
end $$;
revoke execute on function public.partner_api_somente_insercao() from public, anon, authenticated;

drop trigger if exists partner_api_termos_imutavel on public.partner_api_termos;
create trigger partner_api_termos_imutavel before update or delete on public.partner_api_termos
  for each row execute function public.partner_api_somente_insercao();
drop trigger if exists partner_api_termo_aceites_imutavel on public.partner_api_termo_aceites;
create trigger partner_api_termo_aceites_imutavel before update or delete on public.partner_api_termo_aceites
  for each row execute function public.partner_api_somente_insercao();
drop trigger if exists partner_api_incidentes_imutavel on public.partner_api_incidentes;
create trigger partner_api_incidentes_imutavel before update or delete on public.partner_api_incidentes
  for each row execute function public.partner_api_somente_insercao();

-- ── RLS e privilégios ───────────────────────────────────────────────────────────────────────
alter table public.partner_api_termos         enable row level security;
alter table public.partner_api_termo_aceites  enable row level security;
alter table public.partner_api_codigos        enable row level security;
alter table public.partner_api_keys           enable row level security;
alter table public.partner_api_requests       enable row level security;
alter table public.partner_api_bloqueios      enable row level security;
alter table public.partner_api_incidentes     enable row level security;
alter table public.credit_proposal_pld        enable row level security;

revoke all on public.partner_api_termos         from anon, authenticated;
revoke all on public.partner_api_termo_aceites  from anon, authenticated;
revoke all on public.partner_api_codigos        from anon, authenticated;
revoke all on public.partner_api_keys           from anon, authenticated;
revoke all on public.partner_api_requests       from anon, authenticated;
revoke all on public.partner_api_bloqueios      from anon, authenticated;
revoke all on public.partner_api_incidentes     from anon, authenticated;
revoke all on public.credit_proposal_pld        from anon, authenticated;
revoke all on sequence public.partner_api_requests_id_seq from anon, authenticated;

-- Única leitura com sessão: o partner vê as próprias chaves, sem o hash.
grant select (id, partner_id, nome, prefixo, escopos, ips_permitidos, expira_em, limite_por_minuto,
              limite_propostas_dia, ultimo_uso_em, ultimo_ip, revogada_em, motivo_revogacao, created_at)
  on public.partner_api_keys to authenticated;
drop policy if exists partner_api_keys_select_proprio on public.partner_api_keys;
create policy partner_api_keys_select_proprio on public.partner_api_keys
  for select to authenticated using (partner_id = auth.uid());

create or replace view public.partner_api_keys_minhas with (security_invoker = true) as
  select id, nome, prefixo, escopos, ips_permitidos, expira_em, limite_por_minuto, limite_propostas_dia,
         ultimo_uso_em, ultimo_ip, revogada_em, motivo_revogacao, created_at
  from public.partner_api_keys;
revoke all on public.partner_api_keys_minhas from anon, authenticated;
grant select on public.partner_api_keys_minhas to authenticated;

commit;
