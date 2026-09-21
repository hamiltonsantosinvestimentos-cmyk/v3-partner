-- Fase 5, 5.3 (20/09/2026, "go" de Joao): NCNDA por assinatura real na Etapa 3.
--
-- Fluxo (Joao): intake com aceite leve de LGPD -> qualificacao das partes ->
-- aprovacao da Mesa -> assinatura do NCNDA. O Mandato e o pre-contrato ficam
-- para depois da due diligence (vitrine ou fechamento), fora desta migration.
--
-- Lado COMPRA: o gate em_qualificacao -> nda_assinado deixa de olhar o
-- checkbox do intake (investor_demands.nda_accepted_at) e passa a exigir um
-- NCNDA (V3C-NDA) assinado cujo lote de qualificacao pertence a demanda.
-- Sem coluna nova em operation_contracts (decisao de Joao): o elo e
-- operation_contracts.qualification_batch_id -> cm_qualification_batches.demand_id.
-- O status_signature = 'assinado' e gravado pelo cron clicksign-sync, pelo
-- webhook e pela rota de assinatura, entao nenhuma dessas rotas muda.
--
-- Lado VENDA: o gate ja olhava listing.nda_signed_at, mas so a via manual
-- (nda-authorize, anexo mais aprovacao de diretor) o preenchia. O gatilho
-- abaixo faz o NCNDA assinado de um ativo preencher esse campo sozinho. A via
-- manual continua existindo (aditivo, nao destrutivo).
--
-- Antes de aplicar (verificado no banco real em 20/09/2026): 0 demandas em
-- em_qualificacao e 0 ativos com nda_signed_at, entao o gate novo nao bloqueia
-- ninguem que ja esta no meio do caminho.
--
-- ATENCAO: aplicar junto com o deploy do codigo. A rota de status e a tela
-- (bloco "NCNDA do Comprador") foram escritas para este gate.

-- 1) Helper: a demanda tem NCNDA assinado? (fonte unica, usada pela funcao de
--    transicao, pela rota de status e pela tela)
create or replace function public.demand_has_signed_ncnda(p_demand_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from operation_contracts oc
    join cm_qualification_batches b on b.id = oc.qualification_batch_id
    where b.demand_id = p_demand_id
      and oc.contract_code like 'V3C-NDA-%'
      and oc.status_signature = 'assinado'
      and oc.deleted_at is null
  );
$$;

comment on function public.demand_has_signed_ncnda(uuid) is
  'Fase 5 (20/09/2026): true se existe NCNDA (serie V3C-NDA) assinado, nao excluido, gerado a partir de um lote de qualificacao desta demanda de compra. Gate da Etapa 3 do comprador.';

-- 2) transition_cm_demand_status: MESMA assinatura de 5 argumentos (CREATE OR
--    REPLACE substitui, nao cria sobrecarga, ver 20260919f). Unica mudanca em
--    relacao a 20260919j: o ramo em_qualificacao -> nda_assinado.
create or replace function public.transition_cm_demand_status(
  p_demand_id uuid,
  p_new_status text,
  p_reason text default null::text,
  p_user_id uuid default null::uuid,
  p_reason_category text default null::text
)
returns boolean
language plpgsql
set search_path = public
as $function$
declare
  v_current text;
  v_effective text;
  v_demand investor_demands%rowtype;
  v_valid boolean := false;
begin
  select * into v_demand from investor_demands where id = p_demand_id for update;
  if not found then return false; end if;

  v_current := v_demand.status;
  v_effective := case when v_current = 'pendente' then 'reuniao_validada' else v_current end;

  if v_effective not in (
    'reuniao_validada','formulario_preenchido','reuniao_agendada','em_qualificacao',
    'nda_assinado','em_analise','aprovado_head','aprovado_com_restricoes',
    'ativo','em_negociacao','concluido','reprovado','cancelado','expirado'
  ) then
    return false;
  end if;

  v_valid := case
    when v_effective = 'reuniao_validada'       and p_new_status = 'formulario_preenchido' then true
    when v_effective = 'formulario_preenchido'  and p_new_status = 'reuniao_agendada'       then true
    when v_effective = 'reuniao_agendada'       and p_new_status = 'em_qualificacao'        then true
    when v_effective = 'em_qualificacao'        and p_new_status = 'nda_assinado'           then public.demand_has_signed_ncnda(p_demand_id)
    when v_effective = 'nda_assinado'           and p_new_status = 'em_analise'             then true
    when v_effective = 'em_analise'             and p_new_status = 'aprovado_head'          then v_demand.head_approved_by is not null
    when v_effective = 'em_analise'             and p_new_status = 'aprovado_com_restricoes' then
      v_demand.head_approved_by is not null and p_reason is not null and length(trim(p_reason)) > 0
    when v_effective in ('reuniao_validada', 'formulario_preenchido', 'reuniao_agendada', 'em_qualificacao', 'nda_assinado', 'em_analise')
         and p_new_status = 'reprovado' then
      p_reason is not null and length(trim(p_reason)) > 0 and p_reason_category is not null
    when v_effective = 'aprovado_head'          and p_new_status = 'ativo'                  then true
    when v_effective = 'aprovado_com_restricoes' and p_new_status = 'ativo'                 then true
    when v_effective = 'ativo'                  and p_new_status = 'em_negociacao'          then true
    when v_effective = 'em_negociacao'          and p_new_status = 'concluido'              then true
    when p_new_status = 'cancelado' and v_effective not in ('reprovado','cancelado','expirado','concluido') then true
    when p_new_status = 'expirado'  and v_effective not in ('reprovado','cancelado','expirado','concluido') then true
    else false
  end;

  if not v_valid then return false; end if;

  update investor_demands
  set status = p_new_status, updated_at = now()
  where id = p_demand_id;

  insert into cm_status_transitions (demand_id, from_status, to_status, reason, reason_category, changed_by)
  values (p_demand_id, v_effective::cm_listing_status, p_new_status::cm_listing_status, p_reason, p_reason_category, p_user_id);

  return true;
end;
$function$;

comment on function public.transition_cm_demand_status(uuid, text, text, uuid, text) is
  'Fase 5 (20/09/2026): maquina de estados do lado comprador. pendente e tratado como reuniao_validada (20260919j). em_qualificacao -> nda_assinado exige NCNDA assinado via demand_has_signed_ncnda(), nao mais o checkbox do intake. Estados terminais nao reabrem.';

-- 3) Lado venda: NCNDA assinado de um ativo preenche listing.nda_signed_at.
--    SECURITY DEFINER com search_path fixo (regra v3-numbering-governance).
--    Dispara em qualquer caminho que grave status_signature (cron, webhook,
--    rota de assinatura, entrada manual), sem tocar em nenhuma dessas rotas.
create or replace function public.sync_listing_nda_from_signed_ncnda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status_signature = 'assinado'
     and new.vertical = 'capital_markets'
     and new.listing_id is not null
     and new.contract_code like 'V3C-NDA-%'
     and new.deleted_at is null then
    if tg_op = 'INSERT' or old.status_signature is distinct from 'assinado' then
      update cm_asset_listings
      set nda_signed_at = coalesce(new.signed_at, now()),
          nda_authorization_status = 'approved'
      where id = new.listing_id
        and nda_signed_at is null;
    end if;
  end if;
  return new;
end;
$$;

comment on function public.sync_listing_nda_from_signed_ncnda() is
  'Fase 5 (20/09/2026): NCNDA (V3C-NDA, capital_markets) assinado preenche cm_asset_listings.nda_signed_at e marca nda_authorization_status = approved. Nunca sobrescreve um NDA ja registrado.';

drop trigger if exists trg_sync_listing_nda_from_signed_ncnda on public.operation_contracts;
create trigger trg_sync_listing_nda_from_signed_ncnda
  after insert or update of status_signature on public.operation_contracts
  for each row execute function public.sync_listing_nda_from_signed_ncnda();

-- ROLLBACK (guardar, nao executar junto):
--   drop trigger if exists trg_sync_listing_nda_from_signed_ncnda on public.operation_contracts;
--   drop function if exists public.sync_listing_nda_from_signed_ncnda();
--   -- restaurar transition_cm_demand_status de 20260919j (troca a linha do ramo
--   -- em_qualificacao -> nda_assinado de volta para: v_demand.nda_accepted_at is not null)
--   drop function if exists public.demand_has_signed_ncnda(uuid);
