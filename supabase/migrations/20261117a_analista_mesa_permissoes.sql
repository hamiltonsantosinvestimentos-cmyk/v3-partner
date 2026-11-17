-- 20261117a: Permissoes do Analista de Mesa (BRIEF 2026-11-17, QA liberado na rodada 4, go do Joao em 17/11/2026).
-- 1) fn_excluir_documento_qualificacao passa a aceitar MESA_OPERACIONAL com a permissao individual
--    'qualificacao_excluir_documento' (user_feature_access), com limite diario de 20 (P0429) e papel do autor no log.
--    O resto da funcao e identico ao da 20261111c (motivo de 5 a 500, bloqueios, reabertura, log).
-- 2) endurecimento: anon e authenticated perdem todos os privilegios de tabela em user_feature_access (RLS ja so deixa ADMIN;
--    a politica de sigilo pede as duas camadas). Todo uso em codigo e por chave de servico; has_compliance_dashboard_access()
--    e SECURITY DEFINER e nao depende do privilegio do chamador.
-- Privilegios medidos em 17/11/2026 antes deste arquivo (para o rollback): anon e authenticated tinham
-- DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE.

create or replace function public.fn_excluir_documento_qualificacao(
  p_document_id uuid, p_user_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare role_ text; d record; n_bloq int; ids uuid[]; n_reab int := 0; n_tit int := 0; user_name text;
begin
  select role::text, full_name into role_, user_name from profiles where id = p_user_id;
  -- ADMIN e GESTAO pelo papel; MESA_OPERACIONAL (Analista de Mesa) so com a permissao individual (segunda camada, alem da rota)
  if role_ is null or not (
       role_ in ('ADMIN','GESTAO')
    or (role_ = 'MESA_OPERACIONAL' and exists (
          select 1 from user_feature_access
           where user_id = p_user_id and feature = 'qualificacao_excluir_documento'))
  ) then
    raise exception 'papel sem permissao para excluir direto' using errcode = '42501';
  end if;
  -- limite diario do analista (20 por dia, dia de Brasilia). O lock por usuario fecha a corrida das duas exclusoes simultaneas
  -- na 20a posicao; e de transacao e libera no fim da chamada. ADMIN e GESTAO nao tem limite.
  if role_ = 'MESA_OPERACIONAL' then
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
    if (select count(*) from audit_logs
         where user_id = p_user_id and action = 'DELETE'
           and entity = 'cm_party_qualification_documents'
           and new_data->>'evento' = 'documento_qualificacao_excluido'
           and created_at >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')) >= 20 then
      raise exception 'limite diario de exclusoes atingido' using errcode = 'P0429';
    end if;
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 or char_length(btrim(p_reason)) > 500 then
    raise exception 'motivo precisa ter de 5 a 500 caracteres' using errcode = 'P0001';
  end if;

  select id, v3_client_id, document_kind, deleted_at, superseded_at into d
    from cm_party_qualification_documents where id = p_document_id for update;
  if not found then raise exception 'documento nao encontrado' using errcode = 'P0002'; end if;
  if d.deleted_at is not null or d.superseded_at is not null then
    raise exception 'documento ja excluido ou substituido' using errcode = 'P0001';
  end if;

  select count(*) into n_bloq from fn_documento_exclusao_impacto(p_document_id) where bloqueio is not null;
  if n_bloq > 0 then
    raise exception 'exclusao bloqueada: % qualificacao(oes) em lote com contrato ou com envio anterior', n_bloq using errcode = 'P0001';
  end if;

  update cm_party_qualification_documents
     set deleted_at = now(), deleted_by = p_user_id, deletion_reason = btrim(p_reason),
         deletion_status = 'approved', deletion_decided_by = p_user_id, deletion_decided_at = now()
   where id = p_document_id;

  -- reabre cada ficha preenchida afetada (o titular reenvia pelo MESMO link) e limpa a conferencia
  select array_agg(i.qualification_id) into ids
    from fn_documento_exclusao_impacto(p_document_id) i where i.status = 'preenchido';
  if ids is not null then
    perform set_config('v3.conferencia_fn', 'on', true);
    update cm_party_qualifications
       set status = 'pendente', filled_at = null,
           conferida_por = null, conferida_em = null, conferencia = null
     where id = any(ids);
    perform set_config('v3.conferencia_fn', 'off', true);
    get diagnostics n_reab = row_count;
    select count(distinct lower(email)) into n_tit from cm_party_qualifications where id = any(ids);
    update cm_qualification_batches set status = 'coletando', completed_at = null
     where status = 'completo'
       and id in (select batch_id from cm_party_qualifications where id = any(ids));
  end if;

  insert into audit_logs (user_id, user_name, action, entity, entity_id, new_data)
  values (p_user_id, user_name, 'DELETE', 'cm_party_qualification_documents', p_document_id::text,
          jsonb_build_object('evento', 'documento_qualificacao_excluido', 'tipo', d.document_kind,
                             'motivo', btrim(p_reason), 'fichas_reabertas', n_reab, 'titulares', n_tit,
                             'papel_autor', role_));

  return jsonb_build_object('fichas_reabertas', n_reab, 'titulares', n_tit);
end $$;

-- create or replace preserva o revoke e o grant de execute; repetidos por clareza (idempotente).
revoke execute on function public.fn_excluir_documento_qualificacao(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_excluir_documento_qualificacao(uuid, uuid, text) to service_role;

revoke all on public.user_feature_access from anon, authenticated;
