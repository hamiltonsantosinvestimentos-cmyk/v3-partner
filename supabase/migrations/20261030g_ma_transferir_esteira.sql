-- Bloco C da Mesa M&A: transferir deal para a Bolsa de Ativos ou a Mesa de Crédito.
-- BRIEF: 06_Operacional/SOPs/2026-10-30_Operacional_BRIEF-Mesa-MA-Transferir-Esteira-Cliente360_v1.html
-- QA de governança: LIBERADO na rodada 4 (revisão 3.2). A revisão 3.3 do BRIEF (ajustes descobertos
-- ao escrever esta migration) está em QA (rodada 5/6). Go de implementação do João em 30/10/2026; a
-- aplicação em produção exige o SQL mostrado e um segundo go.
-- Pré-requisitos já em produção: RLS de ma_deals (20261030a), camadas de acesso anônimo
-- (20261030d, 20261030e) e v3_clients somente serviço (20261030f).
--
-- O que faz (estende tabelas existentes, sem tabela nova):
--   1) credit_desk_proposals ganha ma_deal_id (nullable).
--   2) Campos obrigatórios deixam de ser obrigatórios SÓ para registro vindo de transferência:
--      CHECK amarrado a ma_deal_id, com faixa de valor (maior que zero e até R$ 50 bi).
--      Bolsa: anonymous_id (o código V3-BA, obrigatório e único) e valor_face; Crédito: code,
--      requested_value e credit_line. Código único permite vários vazios.
--   3) Um registro ativo por deal em cada destino (índice único parcial).
--   4) Gatilho: ma_deal_id só pode ser gravado de dentro da função de transferência (marcador de
--      transação app.ma_transfer = id do deal). Fecha o atalho do CHECK relaxado.
--   5) Duas funções SECURITY DEFINER com search_path fixado. Execução só para service_role; as
--      rotas validam o papel pela sessão e passam p_actor, e a função revalida p_actor.
--
-- Decisões de implementação registradas (BRIEF revisão 3.3):
--   - A pasta MPS NÃO recebe grant da função: ADMIN já acessa por papel, os demais só por grant
--     explícito, e nenhum grant é criado. (Hoje GESTAO não abre pasta por papel e não há perfil GESTAO.)
--   - NCNDA assinado = operation_contracts do deal, série V3C-NDA, status_signature = assinado.
--   - Análise de Crédito liberada = partner_service_orders PAID do deal ou asset_data.analise_gate_override.
--   - Qualificação concluída = cm_party_qualifications.status = 'preenchido'.
--   - ma_deals.sector é texto livre e credit_desk_proposals.sector é chave estrangeira do dicionário
--     deal_sector_codes (achado do ensaio): a proposta nasce sem setor e a confirmação da
--     classificação grava o setor do dicionário (p_setor) junto com o código.
-- Rollback: ver 20261030g_ma_transferir_esteira_rollback.sql.txt

-- 1) vínculo e relaxamento -------------------------------------------------------------------
alter table public.credit_desk_proposals add column if not exists ma_deal_id uuid references public.ma_deals(id);

alter table public.credit_desk_proposals
  alter column code drop not null,
  alter column requested_value drop not null,
  alter column credit_line drop not null;
alter table public.cm_asset_listings
  alter column valor_face drop not null,
  alter column anonymous_id drop not null;

alter table public.credit_desk_proposals drop constraint if exists chk_credit_transfer_campos;
alter table public.credit_desk_proposals add constraint chk_credit_transfer_campos
  check ((code is not null and requested_value is not null and credit_line is not null) or ma_deal_id is not null);
alter table public.credit_desk_proposals drop constraint if exists chk_credit_transfer_faixa;
alter table public.credit_desk_proposals add constraint chk_credit_transfer_faixa
  check (ma_deal_id is null or requested_value is null or (requested_value > 0 and requested_value <= 50000000000));

alter table public.cm_asset_listings drop constraint if exists chk_listing_transfer_campos;
alter table public.cm_asset_listings add constraint chk_listing_transfer_campos
  check ((anonymous_id is not null and valor_face is not null) or ma_deal_id is not null);
alter table public.cm_asset_listings drop constraint if exists chk_listing_transfer_faixa;
alter table public.cm_asset_listings add constraint chk_listing_transfer_faixa
  check (ma_deal_id is null or valor_face is null or (valor_face > 0 and valor_face <= 50000000000));

-- 2) um registro ativo por deal em cada destino -------------------------------------------------
create unique index if not exists ux_cm_listing_ma_deal_ativo on public.cm_asset_listings (ma_deal_id)
  where ma_deal_id is not null and deleted_at is null;
create unique index if not exists ux_credit_prop_ma_deal_ativo on public.credit_desk_proposals (ma_deal_id)
  where ma_deal_id is not null and deleted_at is null;

-- 3) gatilho: ma_deal_id só pela função de transferência ----------------------------------------
create or replace function public.trg_exige_transferencia_ma() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.ma_deal_id is not null and (tg_op = 'INSERT' or new.ma_deal_id is distinct from old.ma_deal_id) then
    if coalesce(current_setting('app.ma_transfer', true), '') <> new.ma_deal_id::text then
      raise exception 'ma_deal_id só pode ser gravado pela função de transferência' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

revoke execute on function public.trg_exige_transferencia_ma() from public, anon, authenticated;

drop trigger if exists trg_exige_transferencia_ma_listings on public.cm_asset_listings;
create trigger trg_exige_transferencia_ma_listings before insert or update of ma_deal_id on public.cm_asset_listings
  for each row execute function public.trg_exige_transferencia_ma();
drop trigger if exists trg_exige_transferencia_ma_credito on public.credit_desk_proposals;
create trigger trg_exige_transferencia_ma_credito before insert or update of ma_deal_id on public.credit_desk_proposals
  for each row execute function public.trg_exige_transferencia_ma();

-- 4) transferir ------------------------------------------------------------------------------------
create or replace function public.ma_deal_transfer_to_desk(
  p_deal uuid,
  p_actor uuid,
  p_destino text,
  p_motivo text,
  p_justificativa_sem_parte text default null,
  p_v3_client_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_nome text;
  d public.ma_deals%rowtype;
  v_client uuid;
  v_doc text;
  v_n int;
  v_valor numeric;
  v_id uuid;
  v_sem_parte boolean := false;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_just text := nullif(btrim(coalesce(p_justificativa_sem_parte, '')), '');
  v_override jsonb;
  v_destino_label text;
begin
  select role::text, full_name into v_role, v_nome from public.profiles where id = p_actor;
  if v_role is null or v_role not in ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL') then
    raise exception 'Sem permissão para transferir deals' using errcode = '42501';
  end if;
  if p_destino not in ('bolsa', 'credito') then
    raise exception 'Mesa de destino inválida' using errcode = '22023';
  end if;
  if char_length(v_motivo) < 20 then
    raise exception 'O motivo precisa ter ao menos 20 caracteres' using errcode = '22023';
  end if;

  select * into d from public.ma_deals where id = p_deal and deleted_at is null for update;
  if not found then
    raise exception 'Deal não encontrado' using errcode = 'P0002';
  end if;
  if d.stage::text in ('CLOSED_WON', 'CLOSED_LOST') then
    raise exception 'Deal encerrado não pode ser transferido' using errcode = '23514';
  end if;

  -- gate: NCNDA assinado
  if not exists (
    select 1 from public.operation_contracts oc
    where oc.deal_id = p_deal and oc.contract_code like 'V3C-NDA-%'
      and oc.status_signature = 'assinado' and oc.deleted_at is null
  ) then
    raise exception 'NCNDA assinado é obrigatório para transferir o deal' using errcode = '23514';
  end if;

  -- gate: Análise de Crédito (só destino Crédito)
  if p_destino = 'credito' then
    v_override := coalesce(d.asset_data -> 'analise_gate_override', 'null'::jsonb);
    if v_override in ('null'::jsonb, 'false'::jsonb, '""'::jsonb) then
      if not exists (select 1 from public.partner_service_orders pso where pso.ma_deal_id = p_deal and pso.status = 'PAID') then
        raise exception 'Transferência para a Mesa de Crédito bloqueada: a Análise de Crédito ainda está pendente de pagamento. Só um ADMIN autoriza.' using errcode = '23514';
      end if;
    end if;
  end if;

  -- um registro ativo por destino
  if p_destino = 'bolsa' and exists (select 1 from public.cm_asset_listings where ma_deal_id = p_deal and deleted_at is null) then
    raise exception 'Este deal já tem um registro ativo na Bolsa de Ativos' using errcode = '23505';
  end if;
  if p_destino = 'credito' and exists (select 1 from public.credit_desk_proposals where ma_deal_id = p_deal and deleted_at is null) then
    raise exception 'Este deal já tem uma proposta ativa na Mesa de Crédito' using errcode = '23505';
  end if;

  -- cliente (Cliente 360)
  select count(*) into v_n from public.ma_deal_clients where deal_id = p_deal;
  if p_v3_client_id is not null then
    if not exists (select 1 from public.ma_deal_clients where deal_id = p_deal and v3_client_id = p_v3_client_id) then
      raise exception 'O cliente informado não está vinculado a este deal' using errcode = '22023';
    end if;
    v_client := p_v3_client_id;
  elsif v_n = 1 then
    select v3_client_id into v_client from public.ma_deal_clients where deal_id = p_deal;
  elsif v_n > 1 then
    raise exception 'Escolha o cliente: o deal tem mais de uma parte vinculada' using errcode = '22023';
  end if;

  if v_client is null
     or not exists (select 1 from public.cm_party_qualifications q
                    where q.v3_client_id = v_client and q.status = 'preenchido' and q.deleted_at is null) then
    if v_just is null or char_length(v_just) < 20 then
      raise exception 'Sem cliente vinculado ao Cliente 360 ou com qualificação pendente, escreva a justificativa (mínimo de 20 caracteres)' using errcode = '22023';
    end if;
    v_sem_parte := true;
  end if;
  if v_client is not null then
    select document_number into v_doc from public.v3_clients where id = v_client;
  end if;

  v_valor := case when d.deal_value > 0 and d.deal_value <= 50000000000 then d.deal_value else null end;
  v_destino_label := case p_destino when 'bolsa' then 'Bolsa de Ativos' else 'Mesa de Crédito' end;

  perform set_config('app.ma_transfer', p_deal::text, true);

  if p_destino = 'bolsa' then
    insert into public.cm_asset_listings
      (asset_type, seller_name, seller_cpf_cnpj, valor_face, listing_status, ma_deal_id, v3_client_id, created_by)
    values
      ('outros', coalesce(nullif(btrim(d.target_company), ''), nullif(btrim(d.title), ''), 'A definir'), v_doc,
       v_valor, 'reuniao_validada', p_deal, v_client, p_actor)
    returning id into v_id;
    insert into public.cm_deal_notes (listing_id, author_id, content, is_system)
    values (v_id, p_actor,
      'Transferido da Mesa M&A (' || coalesce(d.v3_code, d.code, p_deal::text) || '). Motivo: ' || v_motivo
        || case when v_sem_parte then E'\nJustificativa (sem cliente vinculado ou com qualificação pendente): ' || v_just else '' end,
      true);
  else
    insert into public.credit_desk_proposals
      (title, client_name, client_cpf_cnpj, requested_value, created_by, partner_id, v3_client_id, ma_deal_id, metadata)
    values
      (coalesce(nullif(btrim(d.title), ''), nullif(btrim(d.target_company), ''), 'A definir'),
       coalesce(nullif(btrim(d.target_company), ''), nullif(btrim(d.title), ''), 'A definir'), v_doc,
       v_valor, p_actor, null, v_client, p_deal,
       jsonb_build_object('transferencia', jsonb_build_object(
         'origem', 'mesa_ma', 'deal', coalesce(d.v3_code, d.code), 'motivo', v_motivo,
         'justificativa_sem_parte', v_just, 'executor', v_nome, 'em', now())))
    returning id into v_id;
  end if;

  -- linha do tempo do deal: texto genérico, sem mesa, código nem motivo
  insert into public.ma_deal_history (deal_id, from_stage, to_stage, notes, changed_by)
  values (p_deal, d.stage, d.stage, 'Deal encaminhado a outra mesa', p_actor);

  -- auditoria (ADMIN e GESTAO leem): mesa, motivo, justificativa
  insert into public.audit_logs (user_id, user_name, action, entity, entity_id, new_data)
  values (p_actor, v_nome, 'DEAL_TRANSFER_TO_DESK', 'ma_deals', p_deal::text,
    jsonb_build_object('destino', v_destino_label, 'registro_id', v_id, 'motivo', v_motivo,
                       'justificativa_sem_parte', v_just, 'v3_client_id', v_client, 'sem_cliente_360', v_client is null));

  -- zera o marcador: nenhum comando posterior na mesma transação grava ma_deal_id sem passar pela função
  perform set_config('app.ma_transfer', '', true);

  return jsonb_build_object('registro_id', v_id, 'destino', p_destino, 'sem_cliente_360', v_client is null,
                            'qualificacao_dispensada_por_justificativa', v_sem_parte);
end $$;

revoke execute on function public.ma_deal_transfer_to_desk(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.ma_deal_transfer_to_desk(uuid, uuid, text, text, text, uuid) to service_role;

-- 5) confirmar a classificação: emite o código --------------------------------------------------
create or replace function public.ma_desk_confirm_classification(
  p_registro uuid,
  p_actor uuid,
  p_destino text,
  p_setor text,
  p_asset_type text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_role text;
  v_nome text;
  v_codigo text;
  v_deal uuid;
  l public.cm_asset_listings%rowtype;
  c public.credit_desk_proposals%rowtype;
begin
  select role::text, full_name into v_role, v_nome from public.profiles where id = p_actor;
  if v_role is null or v_role not in ('ADMIN', 'GESTAO', 'MESA_OPERACIONAL') then
    raise exception 'Sem permissão para confirmar a classificação' using errcode = '42501';
  end if;
  if p_destino not in ('bolsa', 'credito') then
    raise exception 'Mesa de destino inválida' using errcode = '22023';
  end if;
  if not exists (select 1 from public.deal_sector_codes where code = p_setor and active) then
    raise exception 'Setor fora do dicionário de códigos' using errcode = '22023';
  end if;

  if p_destino = 'bolsa' then
    select * into l from public.cm_asset_listings where id = p_registro and ma_deal_id is not null and deleted_at is null for update;
    if not found then raise exception 'Registro de transferência não encontrado' using errcode = 'P0002'; end if;
    if l.anonymous_id is not null then
      return jsonb_build_object('codigo', l.anonymous_id, 'ja_emitido', true);
    end if;
    if p_asset_type is null then
      raise exception 'Informe o tipo do ativo para confirmar a classificação' using errcode = '22023';
    end if;
    if p_asset_type not in (select e::text from unnest(enum_range(null::public.cm_asset_type)) e) then
      raise exception 'Tipo de ativo inválido' using errcode = '22023';
    end if;
    v_codigo := public.next_v3_code('BA', p_setor, now());
    update public.cm_asset_listings
       set anonymous_id = v_codigo, numero_interno = v_codigo, asset_type = p_asset_type::public.cm_asset_type
     where id = p_registro;
    v_deal := l.ma_deal_id;
    insert into public.cm_deal_notes (listing_id, author_id, content, is_system)
    values (p_registro, p_actor, 'Classificação confirmada. Código emitido: ' || v_codigo || '.', true);
  else
    select * into c from public.credit_desk_proposals where id = p_registro and ma_deal_id is not null and deleted_at is null for update;
    if not found then raise exception 'Registro de transferência não encontrado' using errcode = 'P0002'; end if;
    if c.code is not null then
      return jsonb_build_object('codigo', c.code, 'ja_emitido', true);
    end if;
    v_codigo := public.next_v3_code('CR', p_setor, now());
    update public.credit_desk_proposals
       set code = v_codigo,
           sector = p_setor,
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('classificacao_confirmada_em', now(), 'classificacao_confirmada_por', v_nome)
     where id = p_registro;
    v_deal := c.ma_deal_id;
  end if;

  insert into public.audit_logs (user_id, user_name, action, entity, entity_id, new_data)
  values (p_actor, v_nome, 'DESK_CLASSIFICATION_CONFIRMED', case p_destino when 'bolsa' then 'cm_asset_listings' else 'credit_desk_proposals' end,
          p_registro::text, jsonb_build_object('codigo', v_codigo, 'setor', p_setor, 'ma_deal_id', v_deal, 'asset_type', p_asset_type));

  return jsonb_build_object('codigo', v_codigo, 'ja_emitido', false);
end $$;

revoke execute on function public.ma_desk_confirm_classification(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.ma_desk_confirm_classification(uuid, uuid, text, text, text) to service_role;
