-- Fase 5, sub-entrega 5.3, fatia 2a (19/09/2026, "go" de Joao): corrige o buraco
-- achado ao ligar a maquina de estados do lado comprador na pratica.
--
-- Achado (verificado no banco real antes de escrever): 19 das 29 investor_demands
-- nascem e ficam em status = 'pendente' (app/api/cm/intake/buy/generate cria
-- assim, o link de intake ainda nao foi preenchido). 'pendente' NAO existe no
-- enum cm_listing_status e transition_cm_demand_status() (fatia 1) nao tinha
-- nenhum ramo partindo dele -- pior: a auditoria faz v_current::cm_listing_status,
-- entao QUALQUER transicao a partir de 'pendente' (ate cancelar) estourava erro
-- de cast em vez de so retornar false. A fatia 1 testou so a partir de
-- 'reuniao_validada', por isso passou batido.
--
-- Decisao de Joao (opcao 1 recomendada): NAO migrar as 19 linhas (18 arquivos
-- tocam essa coluna, blast radius). A funcao passa a tratar 'pendente' como
-- equivalente a 'reuniao_validada' na validacao E na auditoria (from_status
-- grava 'reuniao_validada', o unico label do enum que representa esse estagio).
--
-- CREATE OR REPLACE com a MESMA assinatura de 5 argumentos: substitui, nao cria
-- segunda sobrecarga (armadilha ja documentada em 20260919f).

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
  -- 'pendente' = link de intake gerado, formulario ainda nao preenchido.
  -- Estagio equivalente a reuniao_validada do lado venda (pre-qualificacao ja feita).
  v_effective := case when v_current = 'pendente' then 'reuniao_validada' else v_current end;

  -- Estado desconhecido (nao representavel no enum de auditoria): recusa limpo
  -- em vez de estourar erro de cast la embaixo.
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
    when v_effective = 'em_qualificacao'        and p_new_status = 'nda_assinado'           then v_demand.nda_accepted_at is not null
    when v_effective = 'nda_assinado'           and p_new_status = 'em_analise'             then true
    when v_effective = 'em_analise'             and p_new_status = 'aprovado_head'          then v_demand.head_approved_by is not null
    when v_effective = 'em_analise'             and p_new_status = 'aprovado_com_restricoes' then
      v_demand.head_approved_by is not null and p_reason is not null and length(trim(p_reason)) > 0
    when v_effective in ('reuniao_validada', 'formulario_preenchido', 'reuniao_agendada', 'em_qualificacao', 'nda_assinado', 'em_analise')
         and p_new_status = 'reprovado' then
      p_reason is not null and length(trim(p_reason)) > 0 and p_reason_category is not null
    when v_effective = 'aprovado_head'          and p_new_status = 'ativo'                  then true
    when v_effective = 'aprovado_com_restricoes' and p_new_status = 'ativo'                 then true
    -- Etapa 6: dispara quando uma oferta vinculada a esta demanda e aceita
    -- (ver app/api/cm/bids/[id]/route.ts), nunca por clique solto da Mesa.
    when v_effective = 'ativo'                  and p_new_status = 'em_negociacao'          then true
    when v_effective = 'em_negociacao'          and p_new_status = 'concluido'              then true
    -- Estados terminais nao reabrem: cancelar/expirar so a partir de estado vivo.
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
  'Fase 5 (19/09/2026): maquina de estados do lado comprador. pendente e tratado como reuniao_validada (fatia 2a). Estados terminais (reprovado/cancelado/expirado/concluido) nao reabrem.';
