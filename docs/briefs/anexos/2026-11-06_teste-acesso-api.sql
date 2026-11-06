-- TESTE DE ACESSO (seção 6.8 do BRIEF 2026-11-06 API de Propostas). Rodar no SQL Editor do Supabase.
-- Aplica a migration 20261106a DENTRO de uma transação, testa como anon, partner A e partner B,
-- mostra o resultado e DESFAZ TUDO no ROLLBACK final. Nada fica gravado.
begin;
-- API de Propostas para partners (BRIEF docs/briefs/2026-11-06_api-partner-propostas-credito.md)
-- Tabelas da chave de API, termo de uso, aceites, códigos de e-mail, log de chamadas, bloqueios,
-- incidentes e PLD da proposta. Tudo fechado para anon e authenticated; acesso pelas rotas de
-- servidor com a chave de serviço. Única exceção: o partner lê as próprias chaves (sem o hash)
-- pela view partner_api_keys_minhas, com a sessão dele (security_invoker + política por auth.uid()).


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


-- ── Dados de teste (dentro da transação) ────────────────────────────────────────────────────
create temp table _t (teste text, esperado text, resultado text);
grant all on _t to anon, authenticated;
create temp table _ids as
  select (array_agg(id order by created_at))[1] as a, (array_agg(id order by created_at))[2] as b
  from public.profiles where role in ('GOLD','DIAMANTE','PARTNER_PRO','ENTERPRISE');
grant select on _ids to anon, authenticated;
insert into public.partner_api_termos (versao, texto, hash, vigencia_inicio) values ('0.teste', 'texto', 'h', now());
insert into public.partner_api_keys (partner_id, nome, prefixo, key_hash, escopos, ips_permitidos, expira_em, termo_versao, criada_por)
  select a, 'chave A', 'v3_live_aaaa', 'hash-a', array['propostas:ler'], array['1.2.3.4/32']::cidr[], now() + interval '1 year', '0.teste', a from _ids
  union all
  select b, 'chave B', 'v3_live_bbbb', 'hash-b', array['propostas:ler'], array['1.2.3.4/32']::cidr[], now() + interval '1 year', '0.teste', b from _ids;

-- ── anon ────────────────────────────────────────────────────────────────────────────────────
set local role anon;
do $$
declare t text; n int;
begin
  foreach t in array array['partner_api_termos','partner_api_termo_aceites','partner_api_codigos','partner_api_keys',
    'partner_api_requests','partner_api_bloqueios','partner_api_incidentes','credit_proposal_pld','partner_api_keys_minhas'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      insert into _t values ('anon select ' || t, 'negado', 'LEU ' || n || ' linhas');
    exception when insufficient_privilege then
      insert into _t values ('anon select ' || t, 'negado', 'negado');
    end;
  end loop;
  begin
    insert into public.partner_api_keys (partner_id, nome, prefixo, key_hash, escopos, ips_permitidos, expira_em, termo_versao, criada_por)
      values (gen_random_uuid(), 'x', 'x', 'x', array['propostas:ler'], array['1.1.1.1/32']::cidr[], now(), '0.teste', gen_random_uuid());
    insert into _t values ('anon insert partner_api_keys', 'negado', 'INSERIU');
  exception when others then insert into _t values ('anon insert partner_api_keys', 'negado', 'negado'); end;
end $$;
reset role;

-- ── authenticated como partner A ────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true) from _ids;
set local role authenticated;
do $$
declare t text; n int; nomes text;
begin
  select string_agg(nome, ',') into nomes from public.partner_api_keys_minhas;
  insert into _t values ('partner A lê a view', 'só chave A', coalesce(nomes, '(nenhuma)'));
  begin
    execute 'select count(key_hash) from public.partner_api_keys' into n;
    insert into _t values ('partner A lê key_hash', 'negado', 'LEU');
  exception when insufficient_privilege then insert into _t values ('partner A lê key_hash', 'negado', 'negado'); end;
  foreach t in array array['partner_api_requests','partner_api_termo_aceites','partner_api_codigos','partner_api_bloqueios',
    'partner_api_termos','partner_api_incidentes','credit_proposal_pld'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      insert into _t values ('partner A select ' || t, 'negado', 'LEU ' || n || ' linhas');
    exception when insufficient_privilege then insert into _t values ('partner A select ' || t, 'negado', 'negado'); end;
  end loop;
  begin
    update public.partner_api_keys set nome = 'hack';
    get diagnostics n = row_count;
    insert into _t values ('partner A update partner_api_keys', 'negado', case when n = 0 then 'negado (0 linhas)' else 'ALTEROU ' || n end);
  exception when insufficient_privilege then insert into _t values ('partner A update partner_api_keys', 'negado', 'negado'); end;
  begin
    delete from public.partner_api_keys;
    get diagnostics n = row_count;
    insert into _t values ('partner A delete partner_api_keys', 'negado', case when n = 0 then 'negado (0 linhas)' else 'APAGOU ' || n end);
  exception when insufficient_privilege then insert into _t values ('partner A delete partner_api_keys', 'negado', 'negado'); end;
end $$;
reset role;

-- ── authenticated como partner B ────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true) from _ids;
set local role authenticated;
do $$
declare nomes text;
begin
  select string_agg(nome, ',') into nomes from public.partner_api_keys_minhas;
  insert into _t values ('partner B lê a view', 'só chave B', coalesce(nomes, '(nenhuma)'));
end $$;
reset role;

-- ── Imutabilidade (como dono da tabela) ─────────────────────────────────────────────────────
do $$
begin
  begin update public.partner_api_termos set texto = 'x' where versao = '0.teste';
    insert into _t values ('update em partner_api_termos', 'bloqueado', 'ALTEROU');
  exception when others then insert into _t values ('update em partner_api_termos', 'bloqueado', 'bloqueado'); end;
end $$;

-- O resultado sai como mensagem de erro de propósito: o erro aborta a transação, então nada fica
-- gravado mesmo que o editor não rode o ROLLBACK. Leia a lista na mensagem.
do $$
declare r text;
begin
  select string_agg(rpad(teste, 45) || ' | esperado: ' || rpad(esperado, 12) || ' | resultado: ' || resultado, E'\n' order by teste) into r from _t;
  raise exception E'RESULTADO DO TESTE DE ACESSO (nada foi gravado):\n%', r;
end $$;
rollback;
