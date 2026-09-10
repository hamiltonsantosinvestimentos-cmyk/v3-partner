-- Fix P0 real: cancel_and_edit_contract() (migration 20260908) quebrava
-- TODO PATCH /api/contracts/[id]/edit-body em producao, nao so os contratos
-- em enviado_assinatura, porque o SELECT inicial referenciava as colunas
-- "external_envelope_id"/"external_document_id" sem qualificar a tabela --
-- e RETURNS TABLE(..., external_envelope_id text, external_document_id text)
-- cria variaveis implicitas com o MESMO nome no escopo da funcao, tornando
-- a referencia ambigua em runtime (erro so aparece ao executar, nao ao
-- criar a funcao). Achado testando de verdade contra um contrato sintetico
-- em producao, logo apos o merge do PR #95 -- nunca tinha sido executado
-- de ponta a ponta antes.
--
-- Fix: qualifica a tabela com alias no SELECT inicial. Nenhuma outra
-- mudanca de logica.
create or replace function public.cancel_and_edit_contract(
  p_contract_id uuid,
  p_rendered_html text,
  p_reason text default null::text,
  p_editor_id uuid default null::uuid,
  p_editor_name text default null::text
)
returns table(had_pending_envelope boolean, external_envelope_id text, external_document_id text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_contract record;
  v_had_pending boolean;
  v_old_envelope_id text;
  v_old_document_id text;
begin
  select oc.id, oc.rendered_html, oc.status_signature, oc.external_envelope_id, oc.external_document_id
    into v_contract
    from operation_contracts oc
    where oc.id = p_contract_id
    for update;

  if not found then
    raise exception 'Contrato não encontrado' using errcode = 'P0002';
  end if;

  if v_contract.status_signature = 'assinado' then
    raise exception 'Contrato já assinado, não pode ser editado' using errcode = 'P0001';
  end if;
  if v_contract.status_signature = 'cancelado' then
    raise exception 'Contrato cancelado, não pode ser editado' using errcode = 'P0001';
  end if;

  v_had_pending := v_contract.status_signature = 'enviado_assinatura' and v_contract.external_envelope_id is not null;
  v_old_envelope_id := v_contract.external_envelope_id;
  v_old_document_id := v_contract.external_document_id;

  if v_contract.rendered_html is not null then
    insert into operation_contract_versions (contract_id, rendered_html, edited_by, edited_by_name, reason)
    values (p_contract_id, v_contract.rendered_html, p_editor_id, p_editor_name, p_reason);
  end if;

  if v_had_pending then
    update operation_contracts
      set rendered_html = p_rendered_html,
          status_signature = 'cancelado'
      where id = p_contract_id;

    update operation_contracts
      set status_signature = 'rascunho',
          external_envelope_id = null,
          external_document_id = null,
          sent_to_signature_at = null
      where id = p_contract_id;
  else
    update operation_contracts
      set rendered_html = p_rendered_html
      where id = p_contract_id;
  end if;

  return query select v_had_pending, v_old_envelope_id, v_old_document_id;
end;
$function$;
