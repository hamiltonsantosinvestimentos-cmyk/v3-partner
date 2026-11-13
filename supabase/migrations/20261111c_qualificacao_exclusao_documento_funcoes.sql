-- 20261111c: funcoes de exclusao justificada de documento de qualificacao
-- (BRIEF Trava de Liberacao, secao 3, decisoes 11 a 17). Depende da 20261111a (colunas).
-- Aplicar: arquivo primeiro, ensaio em transacao desfeita, depois SQL Editor.
-- Rollback: 20261111c_qualificacao_exclusao_documento_funcoes_rollback.sql.txt
--
-- Regra da guarda (a mais restritiva vence, sobre TODAS as qualificacoes que usam o documento,
-- pelo v3_client_id da ficha e pela cadeia de representantes):
--   * lote consumido por contrato (rascunho, enviado, assinado ou qualquer status): bloqueia
--     ('lote_em_contrato'): cancelar o rascunho antes pelo fluxo existente;
--   * qualificacao com primeiro_envio_em (houve envio, mesmo cancelado): bloqueia ('envio_anterior'),
--     so o socio libera (solicitacao ao socio e outra entrega).
-- Sem bloqueio: exclui (logico), reabre cada ficha preenchida (status pendente, filled_at nulo,
-- conferencia limpa) e volta o lote de completo para coletando, tudo na mesma transacao.

-- 1) impacto: lista as qualificacoes afetadas e o bloqueio de cada uma (leitura, sem efeito)
create or replace function public.fn_documento_exclusao_impacto(p_document_id uuid)
returns table (
  qualification_id uuid, role_in_document text, status text,
  contract_code text, contract_status text, bloqueio text
)
language plpgsql stable security definer set search_path = public as $$
declare v3id uuid;
begin
  select d.v3_client_id into v3id from cm_party_qualification_documents d where d.id = p_document_id;
  if v3id is null then raise exception 'documento nao encontrado' using errcode = 'P0002'; end if;
  return query
  select q.id, q.role_in_document, q.status,
         c.contract_code, c.status_signature::text,
         case
           when b.consumido_por_contract_id is not null then 'lote_em_contrato'
           when q.primeiro_envio_em is not null then 'envio_anterior'
           else null
         end
    from cm_party_qualifications q
    join cm_qualification_batches b on b.id = q.batch_id
    left join operation_contracts c on c.id = b.consumido_por_contract_id
   where q.deleted_at is null
     and (q.v3_client_id = v3id
          or (q.representation is not null
              and jsonb_path_exists(q.representation, '$.**.v3_client_id ? (@ == $id)',
                                    jsonb_build_object('id', to_jsonb(v3id::text)))))
   order by q.role_in_document, q.id;
end $$;

-- 2) exclusao: papel, motivo, guarda e efeito, atomicos. Devolve o resumo sem dado pessoal.
create or replace function public.fn_excluir_documento_qualificacao(
  p_document_id uuid, p_user_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare role_ text; d record; n_bloq int; ids uuid[]; n_reab int := 0; n_tit int := 0; user_name text;
begin
  select role, full_name into role_, user_name from profiles where id = p_user_id;
  if role_ is null or role_ not in ('ADMIN','GESTAO') then
    raise exception 'papel sem permissao para excluir direto' using errcode = '42501';
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
                             'motivo', btrim(p_reason), 'fichas_reabertas', n_reab, 'titulares', n_tit));

  return jsonb_build_object('fichas_reabertas', n_reab, 'titulares', n_tit);
end $$;

revoke execute on function public.fn_documento_exclusao_impacto(uuid) from public, anon, authenticated;
revoke execute on function public.fn_excluir_documento_qualificacao(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_documento_exclusao_impacto(uuid) to service_role;
grant execute on function public.fn_excluir_documento_qualificacao(uuid, uuid, text) to service_role;
