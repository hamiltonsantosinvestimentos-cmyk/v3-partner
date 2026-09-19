-- Fase 5, sub-entrega 5.3, fatia 1/N (19/09/2026, "siga" de Joao): fundacao
-- da maquina de estados do lado comprador. investor_demands.status hoje e
-- text livre com so 2 valores reais em producao (pendente/ativo), sem
-- nenhuma transicao validada nem historico -- ao contrario do lado venda,
-- que ja tem tudo isso desde a criacao do modulo.
--
-- Decisao de design (ver Dependencias do BRIEF formal): NAO converter
-- status pra um enum novo -- 18 arquivos reais tocam investor_demands hoje,
-- ALTER COLUMN TYPE teria blast radius grande demais pra uma unica fatia.
-- Mantem text, valida pela funcao nova (mesmo espirito, menor risco).
-- cm_status_transitions generaliza (ganha demand_id nullable) em vez de
-- criar uma tabela irma -- reaproveita a mesma auditoria que ja funciona
-- pro lado venda.
--
-- nda_accepted_at ja existia (usado no fluxo de NCNDA de compra existente),
-- reaproveitado como o gate de "NDA assinado" -- nunca duplicar coluna.

alter table public.cm_status_transitions
  add column if not exists demand_id uuid references public.investor_demands(id);

alter table public.investor_demands
  add column if not exists head_approved_by uuid references public.profiles(id),
  add column if not exists head_approved_at timestamptz;

-- Fase 5, fatia 1: liga uma oferta (cm_bids) de volta a demanda estruturada
-- que a originou, quando existir. Nullable -- ofertas manuais sem demanda
-- por tras continuam validas exatamente como sao hoje.
alter table public.cm_bids
  add column if not exists demand_id uuid references public.investor_demands(id);

comment on column public.cm_status_transitions.demand_id is
  'Fase 5 (19/09/2026): mesma tabela de auditoria do lado venda, generalizada pro lado compra. Uma linha sempre tem listing_id OU demand_id preenchido, nunca os dois.';
comment on column public.cm_bids.demand_id is
  'Fase 5 (19/09/2026): vincula a oferta a demanda estruturada que a originou (via match), quando existir. Ao aceitar uma oferta com demand_id preenchido, a demanda transita pra em_negociacao.';

create or replace function public.transition_cm_demand_status(
  p_demand_id uuid,
  p_new_status text,
  p_reason text default null::text,
  p_user_id uuid default null::uuid,
  p_reason_category text default null::text
)
returns boolean
language plpgsql
as $function$
declare
  v_current text;
  v_demand investor_demands%rowtype;
  v_valid boolean := false;
begin
  select * into v_demand from investor_demands where id = p_demand_id for update;
  if not found then return false; end if;

  v_current := v_demand.status;

  v_valid := case
    when v_current = 'reuniao_validada'       and p_new_status = 'formulario_preenchido' then true
    when v_current = 'formulario_preenchido'  and p_new_status = 'reuniao_agendada'       then true
    when v_current = 'reuniao_agendada'       and p_new_status = 'em_qualificacao'        then true
    when v_current = 'em_qualificacao'        and p_new_status = 'nda_assinado'           then v_demand.nda_accepted_at is not null
    when v_current = 'nda_assinado'           and p_new_status = 'em_analise'             then true
    when v_current = 'em_analise'             and p_new_status = 'aprovado_head'          then v_demand.head_approved_by is not null
    when v_current = 'em_analise'             and p_new_status = 'aprovado_com_restricoes' then
      v_demand.head_approved_by is not null and p_reason is not null and length(trim(p_reason)) > 0
    when v_current in ('formulario_preenchido', 'reuniao_agendada', 'em_qualificacao', 'nda_assinado', 'em_analise')
         and p_new_status = 'reprovado' then
      p_reason is not null and length(trim(p_reason)) > 0 and p_reason_category is not null
    when v_current = 'aprovado_head'          and p_new_status = 'ativo'                  then true
    when v_current = 'aprovado_com_restricoes' and p_new_status = 'ativo'                 then true
    -- Etapa 6: dispara quando uma oferta vinculada a esta demanda e aceita
    -- (ver app/api/cm/bids/[id]/route.ts), nunca por clique solto da Mesa.
    when v_current = 'ativo'                  and p_new_status = 'em_negociacao'          then true
    when v_current = 'em_negociacao'          and p_new_status = 'concluido'              then true
    when p_new_status = 'cancelado' then true
    when p_new_status = 'expirado'  then true
    else false
  end;

  if not v_valid then return false; end if;

  update investor_demands
  set status = p_new_status, updated_at = now()
  where id = p_demand_id;

  insert into cm_status_transitions (demand_id, from_status, to_status, reason, reason_category, changed_by)
  values (p_demand_id, v_current::cm_listing_status, p_new_status::cm_listing_status, p_reason, p_reason_category, p_user_id);

  return true;
end;
$function$;
