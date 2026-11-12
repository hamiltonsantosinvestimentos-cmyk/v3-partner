-- 20261111a: trava de liberacao da qualificacao, exclusao justificada de documento
-- e vinculo permanente de envio (BRIEF Trava de Liberacao, 11/11/2026, decisoes 13 a 17).
-- NAO FECHA o acesso direto (isso e a 20261111b, depois da varredura de consumidores).
-- Aplicar: arquivo primeiro, ensaio em transacao desfeita, depois SQL Editor.
-- Rollback: 20261111a_qualificacao_conferencia_trava_e_exclusao_rollback.sql.txt

-- 1) colunas novas (todas anulaveis, salvo deletion_status com default)
alter table public.cm_party_qualifications
  add column if not exists conferida_por uuid,
  add column if not exists conferida_em timestamptz,
  add column if not exists conferencia jsonb,
  add column if not exists contrato_enviado_id uuid,
  add column if not exists primeiro_envio_em timestamptz;

alter table public.cm_party_qualification_documents
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists deletion_reason text,
  add column if not exists deletion_status text not null default 'none',
  add column if not exists deletion_requested_by uuid,
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_decision_reason text,
  add column if not exists deletion_decided_by uuid,
  add column if not exists deletion_decided_at timestamptz,
  add column if not exists superseded_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'chk_cm_party_qual_docs_deletion_status') then
    alter table public.cm_party_qualification_documents
      add constraint chk_cm_party_qual_docs_deletion_status
      check (deletion_status in ('none','pending_governance','approved','rejected'));
  end if;
end $$;

create index if not exists idx_cm_party_qual_docs_ativos
  on public.cm_party_qualification_documents (v3_client_id, document_kind, uploaded_at desc)
  where deleted_at is null and superseded_at is null;

-- 2) preenchimento inicial, uma vez: contratos ja enviados ou assinados
update public.cm_party_qualifications q
   set contrato_enviado_id = b.consumido_por_contract_id,
       primeiro_envio_em   = c.sent_to_signature_at
  from public.cm_qualification_batches b
  join public.operation_contracts c on c.id = b.consumido_por_contract_id
 where q.batch_id = b.id
   and c.sent_to_signature_at is not null
   and q.contrato_enviado_id is null;

-- 3) trigger: vinculo de envio append-only (vale para a chave de servico e para cancel_signature_envelope)
create or replace function public.trg_cm_party_qual_envio_append_only()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.contrato_enviado_id is not null and new.contrato_enviado_id is distinct from old.contrato_enviado_id then
    raise exception 'contrato_enviado_id e append-only' using errcode = 'P0001';
  end if;
  if old.primeiro_envio_em is not null and new.primeiro_envio_em is distinct from old.primeiro_envio_em then
    raise exception 'primeiro_envio_em e append-only' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_cm_party_qual_envio_append_only on public.cm_party_qualifications;
create trigger trg_cm_party_qual_envio_append_only
  before update of contrato_enviado_id, primeiro_envio_em on public.cm_party_qualifications
  for each row execute function public.trg_cm_party_qual_envio_append_only();

-- 4) trigger: liberacao so pelas duas funcoes (sinal local gravado por elas)
create or replace function public.trg_cm_party_qual_conferencia_guard()
returns trigger language plpgsql set search_path = public as $$
declare dentro boolean := coalesce(current_setting('v3.conferencia_fn', true), '') = 'on';
begin
  if (new.conferida_por is distinct from old.conferida_por
      or new.conferida_em is distinct from old.conferida_em
      or new.conferencia is distinct from old.conferencia) then
    if not dentro then
      raise exception 'conferencia so pode ser gravada pelas funcoes oficiais' using errcode = 'P0001';
    end if;
    if new.conferida_por is null and new.conferida_em is null and new.conferencia is null
       and new.status <> 'pendente' then
      raise exception 'limpar a conferencia exige status pendente' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_cm_party_qual_conferencia_guard on public.cm_party_qualifications;
create trigger trg_cm_party_qual_conferencia_guard
  before update of conferida_por, conferida_em, conferencia on public.cm_party_qualifications
  for each row execute function public.trg_cm_party_qual_conferencia_guard();

-- 5) funcao de liberacao: confere papel, status e provas do MESMO usuario, posteriores a filled_at
create or replace function public.fn_liberar_qualificacao(
  p_qualification_id uuid, p_user_id uuid, p_conferencia jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare q record; role_ text; doc text; fld text; n int;
begin
  select role into role_ from profiles where id = p_user_id;
  if role_ is null or role_ not in ('ADMIN','GESTAO') then
    raise exception 'papel sem permissao para liberar' using errcode = '42501';
  end if;
  select id, status, filled_at into q from cm_party_qualifications where id = p_qualification_id for update;
  if not found then raise exception 'qualificacao nao encontrada' using errcode = 'P0002'; end if;
  if q.status <> 'preenchido' or q.filled_at is null then
    raise exception 'so se libera qualificacao preenchida' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_conferencia->'documentos') <> 'array' or jsonb_array_length(p_conferencia->'documentos') = 0 then
    raise exception 'conferencia sem documento aberto' using errcode = 'P0001';
  end if;
  -- cada documento exigido: aberto por quem libera, depois do preenchimento, e nao excluido
  for doc in select jsonb_array_elements_text(p_conferencia->'documentos') loop
    select count(*) into n from cm_party_qualification_document_views v
      join cm_party_qualification_documents d on d.id = v.document_id
     where v.document_id = doc::uuid and v.viewed_by = p_user_id
       and v.viewed_at > q.filled_at and d.deleted_at is null;
    if n = 0 then raise exception 'documento % nao aberto por quem libera depois do preenchimento', doc using errcode = 'P0001'; end if;
  end loop;
  -- cada campo exigido: revelado por quem libera, depois do preenchimento
  if jsonb_typeof(p_conferencia->'campos') = 'array' then
    for fld in select jsonb_array_elements_text(p_conferencia->'campos') loop
      select count(*) into n from cm_party_qualification_field_views f
       where f.qualification_id = p_qualification_id and f.field = fld
         and f.viewed_by = p_user_id and f.viewed_at > q.filled_at;
      if n = 0 then raise exception 'campo % nao revelado por quem libera depois do preenchimento', fld using errcode = 'P0001'; end if;
    end loop;
  end if;
  perform set_config('v3.conferencia_fn', 'on', true);
  update cm_party_qualifications
     set conferida_por = p_user_id, conferida_em = now(), conferencia = p_conferencia
   where id = p_qualification_id;
  perform set_config('v3.conferencia_fn', 'off', true);
end $$;

-- 6) funcao de limpeza: usada pela reabertura (status volta a pendente) e pela exclusao
create or replace function public.fn_limpar_conferencia(p_qualification_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare role_ text;
begin
  select role into role_ from profiles where id = p_user_id;
  if role_ is null or role_ not in ('ADMIN','GESTAO','MESA_OPERACIONAL') then
    raise exception 'papel sem permissao' using errcode = '42501';
  end if;
  perform set_config('v3.conferencia_fn', 'on', true);
  update cm_party_qualifications
     set conferida_por = null, conferida_em = null, conferencia = null
   where id = p_qualification_id;
  perform set_config('v3.conferencia_fn', 'off', true);
end $$;

-- 7) as funcoes ficam fechadas ao navegador: so a chave de servico executa
revoke execute on function public.fn_liberar_qualificacao(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fn_limpar_conferencia(uuid, uuid) from public, anon, authenticated;
grant execute on function public.fn_liberar_qualificacao(uuid, uuid, jsonb) to service_role;
grant execute on function public.fn_limpar_conferencia(uuid, uuid) to service_role;
