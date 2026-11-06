-- TESTE DE ACESSO das 3 tabelas da migration 20261106b (BRIEF ajustes de segurança da API).
-- Aplica a migration DENTRO de uma transação, testa anon e um partner logado, e aborta no fim
-- mostrando o resultado. Nada fica gravado.
begin;
-- Ajustes de segurança da API de Propostas (BRIEF docs/briefs/2026-11-06_api-v1-ajustes-seguranca.md)
-- Envios pendentes (limite e limpeza), reserva de Idempotency-Key e controle de repetição de alertas.
-- Mesma regra da 20261106a: RLS ligada, nada para anon/authenticated, acesso só pelas rotas de servidor.


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


create temp table _t (teste text, esperado text, resultado text);
grant all on _t to anon, authenticated;
create temp table _ids as select id as a from public.profiles where role in ('GOLD','DIAMANTE','PARTNER_PRO','ENTERPRISE') order by created_at limit 1;
grant select on _ids to anon, authenticated;

set local role anon;
do $$
declare t text; n int;
begin
  foreach t in array array['partner_api_uploads','partner_api_idempotencia','partner_api_alertas'] loop
    begin execute format('select count(*) from public.%I', t) into n; insert into _t values ('anon select ' || t, 'negado', 'LEU ' || n);
    exception when insufficient_privilege then insert into _t values ('anon select ' || t, 'negado', 'negado'); end;
  end loop;
  begin insert into public.partner_api_alertas (tipo, referencia) values ('x','y'); insert into _t values ('anon insert partner_api_alertas', 'negado', 'INSERIU');
  exception when others then insert into _t values ('anon insert partner_api_alertas', 'negado', 'negado'); end;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true) from _ids;
set local role authenticated;
do $$
declare t text; n int;
begin
  foreach t in array array['partner_api_uploads','partner_api_idempotencia','partner_api_alertas'] loop
    begin execute format('select count(*) from public.%I', t) into n; insert into _t values ('partner select ' || t, 'negado', 'LEU ' || n);
    exception when insufficient_privilege then insert into _t values ('partner select ' || t, 'negado', 'negado'); end;
  end loop;
  begin insert into public.partner_api_alertas (tipo, referencia) values ('x','y'); insert into _t values ('partner insert partner_api_alertas', 'negado', 'INSERIU');
  exception when others then insert into _t values ('partner insert partner_api_alertas', 'negado', 'negado'); end;
end $$;
reset role;

do $$
declare r text;
begin
  select string_agg(rpad(teste, 42) || ' | esperado: ' || rpad(esperado, 8) || ' | resultado: ' || resultado, E'\n' order by teste) into r from _t;
  raise exception E'RESULTADO DO TESTE DE ACESSO (nada foi gravado):\n%', r;
end $$;
rollback;
