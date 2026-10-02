-- =============================================================================
-- 20261002b: Fase 1C passo 1 (BRIEF 5.12 D). NAO APLICAR antes do registro escrito do Robson.
--
-- Tabela de apagamentos (append-only ESTRITO, sem a exceção app.cm_log_cleanup) e função
-- transacional de retenção de 36 meses dos dois logs de acesso. A execução da retenção grava a
-- própria linha de auditoria no mesmo comando (uma linha por tabela de origem; nada apagado não
-- grava linha). Sem SECURITY DEFINER, search_path fixo, revoke execute de public, anon e authenticated.
-- Só a service role chama (rota de cron, validada por Bearer CRON_SECRET).
--
-- Observação: a tabela de apagamentos fica aqui (e não em 20261002c, como no texto do BRIEF)
-- porque a função de retenção a usa; a 20261002c traz só a função de eliminação do titular.
--
-- Rollback (manual): drop function public.cm_purge_access_logs(integer);
--   drop table public.cm_party_qualification_log_erasures; drop function public.cm_append_only_strict();
-- =============================================================================

create or replace function public.cm_append_only_strict()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'tabela % e append-only estrita: % nao permitido', tg_table_name, tg_op;
end;
$$;

create table if not exists public.cm_party_qualification_log_erasures (
  id               uuid primary key default gen_random_uuid(),
  executed_at      timestamptz not null default now(),
  executed_by      uuid references public.profiles(id),          -- nulo na retenção automática
  source_table     text not null check (source_table in ('field_views', 'document_views')),
  qualification_id uuid references public.cm_party_qualifications(id), -- nulo na retenção automática
  reason           text not null,
  deleted_count    integer not null check (deleted_count > 0)
);
comment on table public.cm_party_qualification_log_erasures is
  'Registro append-only estrito de cada apagamento de log de acesso (retenção de 36 meses ou eliminação a pedido do titular). Sem nenhum dado do titular.';

alter table public.cm_party_qualification_log_erasures enable row level security;
revoke all on public.cm_party_qualification_log_erasures from anon, authenticated;

drop trigger if exists trg_cm_pq_log_erasures_append_only on public.cm_party_qualification_log_erasures;
create trigger trg_cm_pq_log_erasures_append_only
  before update or delete on public.cm_party_qualification_log_erasures
  for each row execute function public.cm_append_only_strict();

create or replace function public.cm_purge_access_logs(p_months integer default 36)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - make_interval(months => p_months);
  n_fv integer := 0;
  n_dv integer := 0;
begin
  if p_months < 36 then
    raise exception 'retencao minima de 36 meses (recebido %)', p_months;
  end if;
  perform set_config('app.cm_log_cleanup', 'on', true);

  with d as (delete from public.cm_party_qualification_field_views where viewed_at < v_cutoff returning 1)
  select count(*) into n_fv from d;
  with d as (delete from public.cm_party_qualification_document_views where viewed_at < v_cutoff returning 1)
  select count(*) into n_dv from d;

  if n_fv > 0 then
    insert into public.cm_party_qualification_log_erasures (executed_by, source_table, qualification_id, reason, deleted_count)
    values (null, 'field_views', null, 'retencao de 36 meses', n_fv);
  end if;
  if n_dv > 0 then
    insert into public.cm_party_qualification_log_erasures (executed_by, source_table, qualification_id, reason, deleted_count)
    values (null, 'document_views', null, 'retencao de 36 meses', n_dv);
  end if;

  return jsonb_build_object('field_views', n_fv, 'document_views', n_dv);
end;
$$;

revoke execute on function public.cm_purge_access_logs(integer) from public, anon, authenticated;
