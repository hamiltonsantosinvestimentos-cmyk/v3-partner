-- TESTE DE ACESSO da tabela da migration 20261109_credit_document_names (BRIEF nomear documentos das propostas).
-- Aplica a migration DENTRO de uma transação, testa anon e um partner logado, e aborta no fim
-- mostrando o resultado. Nada fica gravado.
begin;

create table public.credit_document_names (
  storage_path  text primary key,
  proposal_id   uuid not null references public.credit_desk_proposals(id) on delete cascade,
  nome_exibicao text check (nome_exibicao is null or char_length(nome_exibicao) <= 120),
  tipo          text,
  periodo       text check (periodo is null or periodo ~ '^[0-9]{4}(-[0-9]{4})?$'),
  titular       text check (titular is null or char_length(titular) <= 100),
  confianca     numeric(3,2) check (confianca is null or (confianca >= 0 and confianca <= 1)),
  status        text not null check (status in ('ok', 'sem_leitura', 'ignorado', 'erro')),
  tentativas    int  not null default 1,
  modelo        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index credit_document_names_proposal_idx on public.credit_document_names (proposal_id);
alter table public.credit_document_names enable row level security;
revoke all on public.credit_document_names from anon, authenticated;

-- Uma linha de exemplo (gravada como dono da migration), para o teste de leitura ter o que ler.
insert into public.credit_document_names (storage_path, proposal_id, nome_exibicao, status)
select 'teste/arquivo.pdf', id, 'DRE 2025 - Teste.pdf', 'ok' from public.credit_desk_proposals limit 1;

create temp table _t (teste text, esperado text, resultado text);
grant insert, select on _t to anon, authenticated;
insert into _t select 'policies na tabela', '0', count(*)::text from pg_policies where tablename = 'credit_document_names';
insert into _t select 'RLS ligada', 'true', relrowsecurity::text from pg_class where oid = 'public.credit_document_names'::regclass;

create temp table _ids as select id as a from public.profiles where role in ('GOLD','DIAMANTE','PARTNER_PRO','ENTERPRISE','PARTNER') order by created_at limit 1;
grant select on _ids to anon, authenticated;
create temp table _prop as select id as p from public.credit_desk_proposals limit 1;
grant select on _prop to anon, authenticated;

set local role anon;
do $$
declare n int;
begin
  begin select count(*) into n from public.credit_document_names; insert into _t values ('anon select', 'negado', 'LEU ' || n);
  exception when insufficient_privilege then insert into _t values ('anon select', 'negado', 'negado'); end;
  begin insert into public.credit_document_names (storage_path, proposal_id, status) select 'x', p, 'ok' from _prop; insert into _t values ('anon insert', 'negado', 'INSERIU');
  exception when insufficient_privilege then insert into _t values ('anon insert', 'negado', 'negado'); end;
end $$;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true) from _ids;
set local role authenticated;
do $$
declare n int;
begin
  begin select count(*) into n from public.credit_document_names; insert into _t values ('partner select', 'negado', 'LEU ' || n);
  exception when insufficient_privilege then insert into _t values ('partner select', 'negado', 'negado'); end;
  begin insert into public.credit_document_names (storage_path, proposal_id, status) select 'y', p, 'ok' from _prop; insert into _t values ('partner insert', 'negado', 'INSERIU');
  exception when insufficient_privilege then insert into _t values ('partner insert', 'negado', 'negado'); end;
  begin update public.credit_document_names set nome_exibicao = 'z'; insert into _t values ('partner update', 'negado', 'ATUALIZOU');
  exception when insufficient_privilege then insert into _t values ('partner update', 'negado', 'negado'); end;
end $$;
reset role;

do $$
declare r text;
begin
  select string_agg(rpad(teste, 24) || ' | esperado: ' || rpad(esperado, 7) || ' | resultado: ' || resultado, E'\n' order by teste) into r from _t;
  raise exception E'RESULTADO DO TESTE DE ACESSO (nada foi gravado):\n%', r;
end $$;
rollback;
