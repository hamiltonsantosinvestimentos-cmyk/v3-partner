-- Fase 2 do BRIEF "ClickSign vs CertOne" (06_Operacional/SOPs, 07-08/09/2026).
--
-- 1) operation_contracts.esignature_provider: nullable, backward-compatible.
--    NULL = interpretado como "clicksign" (todo contrato existente e todo
--    contrato novo até a Fase 3 ligar o switch no painel). Nenhum contrato
--    real muda de comportamento com esta coluna sozinha.
--
-- 2) cancel_and_edit_contract(): RPC atômica que substitui o "2 updates
--    sequenciais na aplicação" originalmente cogitado para contornar o
--    trigger trg_prevent_signed_update (achado em 07/09/2026). João
--    corretamente apontou que 2 chamadas HTTP separadas (app -> banco)
--    para o mesmo contrato é um risco real de estado inconsistente se a
--    função serverless da Vercel morrer entre as duas (timeout, cold
--    start, etc.). A correção: uma única function PL/pgSQL, com os 2
--    UPDATEs dentro da MESMA transação de banco (atomicidade garantida
--    pelo Postgres, sem depender de round-trip de rede nenhum entre eles).
--
--    O trigger em si NÃO é alterado (não temos certeza de todos os
--    caminhos que ele protege hoje, mudar a função central é risco maior
--    que necessário). A RPC navega a regra existente do trigger:
--      Passo 1: UPDATE ... SET status_signature = 'cancelado' (a exceção
--               que o trigger já permite explicitamente,
--               "NEW.status_signature != 'cancelado'").
--      Passo 2: UPDATE ... SET status_signature = 'rascunho' (OLD já é
--               'cancelado' neste ponto, fora da lista guardada pelo
--               trigger IN ('assinado','enviado_assinatura'), logo nunca
--               bloqueado, independente de outros campos mudarem).
--    Os dois passos executam dentro da mesma invocação de função: se
--    qualquer coisa falhar no meio, a transação inteira reverte, nunca
--    fica um contrato preso em "cancelado" sem virar "rascunho".

alter table public.operation_contracts
  add column if not exists esignature_provider text;

comment on column public.operation_contracts.esignature_provider is
  'Provedor de assinatura digital usado no envio deste contrato (clicksign | certone). NULL = clicksign, por compatibilidade com contratos anteriores à Fase 2 do BRIEF ClickSign vs CertOne (07/09/2026). Nunca recalculado depois do envio.';

create or replace function public.cancel_and_edit_contract(
  p_contract_id uuid,
  p_rendered_html text,
  p_reason text default null,
  p_editor_id uuid default null,
  p_editor_name text default null
)
returns table (
  had_pending_envelope boolean,
  external_envelope_id text,
  external_document_id text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contract record;
  v_had_pending boolean;
  v_old_envelope_id text;
  v_old_document_id text;
begin
  select id, rendered_html, status_signature, external_envelope_id, external_document_id
    into v_contract
    from operation_contracts
    where id = p_contract_id
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

  -- Snapshot do texto anterior ANTES de sobrescrever, mesma regra que já
  -- existia na rota (nunca perder versão), agora dentro da mesma transação.
  if v_contract.rendered_html is not null then
    insert into operation_contract_versions (contract_id, rendered_html, edited_by, edited_by_name, reason)
    values (p_contract_id, v_contract.rendered_html, p_editor_id, p_editor_name, p_reason);
  end if;

  if v_had_pending then
    -- Passo 1: transição explicitamente permitida pelo trigger.
    update operation_contracts
      set rendered_html = p_rendered_html,
          status_signature = 'cancelado'
      where id = p_contract_id;

    -- Passo 2: mesma transação, sem round-trip de rede. OLD já é
    -- 'cancelado' aqui, fora da lista que o trigger guarda.
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
$$;

comment on function public.cancel_and_edit_contract is
  'Edita rendered_html de um contrato de forma atômica, incluindo a transição enviado_assinatura -> rascunho (via cancelado, ver comentário da migration 20260908) quando havia envelope pendente. Substitui o bypass de 2 updates sequenciais na aplicação, achado de governança de dados em 08/09/2026 (BRIEF ClickSign vs CertOne, Fase 2). O cancelamento real no provedor de assinatura (ClickSign/CertOne) continua sendo responsabilidade da aplicação, chamado ANTES desta RPC — não pode entrar numa transação de banco, é uma chamada de rede externa.';
