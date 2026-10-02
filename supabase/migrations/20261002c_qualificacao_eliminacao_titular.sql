-- =============================================================================
-- 20261002c: Fase 1C passo 1 (BRIEF 5.12 D). NAO APLICAR antes do registro escrito do Robson.
--
-- Eliminação de registros específicos do log de acesso a pedido do titular. Função transacional:
-- apaga e grava a auditoria (cm_party_qualification_log_erasures, criada em 20261002b) no MESMO
-- comando; se uma falhar, nenhuma vale. Valida que todos os ids pertencem à qualificação informada
-- e recusa registros com menos de 24 horas (impede o ADMIN de zerar o próprio contador de limite
-- de revelação). Motivo obrigatório. Sem SECURITY DEFINER, search_path fixo, revoke execute.
-- Chamada só pela rota ADMIN (service role). A exceção app.cm_log_cleanup da 20260930d, descrita
-- como "limpeza de ZZTEST", passa a ser usada em produção por esta função e pela de retenção.
--
-- Rollback (manual): drop function public.cm_erase_access_logs(uuid, text, uuid[], text, uuid);
-- =============================================================================

create or replace function public.cm_erase_access_logs(
  p_qualification_id uuid,
  p_source text,
  p_ids uuid[],
  p_reason text,
  p_executor uuid
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_ids uuid[] := (select coalesce(array_agg(distinct x), '{}') from unnest(p_ids) x);
  v_found integer;
  v_latest timestamptz;
  v_deleted integer;
begin
  if p_source not in ('field_views', 'document_views') then
    raise exception 'tabela de origem invalida';
  end if;
  if p_executor is null then
    raise exception 'executor obrigatorio';
  end if;
  if p_reason is null or length(btrim(p_reason)) < 10 then
    raise exception 'motivo obrigatorio (minimo 10 caracteres)';
  end if;
  if cardinality(v_ids) = 0 then
    raise exception 'nenhum registro selecionado';
  end if;

  if p_source = 'field_views' then
    select count(*), max(viewed_at) into v_found, v_latest
    from public.cm_party_qualification_field_views
    where id = any(v_ids) and qualification_id = p_qualification_id;
  else
    select count(*), max(viewed_at) into v_found, v_latest
    from public.cm_party_qualification_document_views
    where id = any(v_ids) and qualification_id = p_qualification_id;
  end if;

  if v_found <> cardinality(v_ids) then
    raise exception 'registros nao pertencem a esta qualificacao';
  end if;
  if v_latest >= now() - interval '24 hours' then
    raise exception 'ELEGIVEL_A_PARTIR_DE:%', to_char(v_latest + interval '24 hours', 'YYYY-MM-DD"T"HH24:MI:SSOF');
  end if;

  perform set_config('app.cm_log_cleanup', 'on', true);

  if p_source = 'field_views' then
    with d as (delete from public.cm_party_qualification_field_views where id = any(v_ids) and qualification_id = p_qualification_id returning 1)
    select count(*) into v_deleted from d;
  else
    with d as (delete from public.cm_party_qualification_document_views where id = any(v_ids) and qualification_id = p_qualification_id returning 1)
    select count(*) into v_deleted from d;
  end if;

  insert into public.cm_party_qualification_log_erasures (executed_by, source_table, qualification_id, reason, deleted_count)
  values (p_executor, p_source, p_qualification_id, btrim(p_reason), v_deleted);

  return v_deleted;
end;
$$;

revoke execute on function public.cm_erase_access_logs(uuid, text, uuid[], text, uuid) from public, anon, authenticated;
