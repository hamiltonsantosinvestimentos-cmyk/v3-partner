-- Fase 5, sub-entrega 5.1 (19/09/2026, "go" de Joao), parte 2. Depende da
-- migration anterior (20260919d) ja ter comitado os 2 valores novos do enum.
--
-- 1) transition_cm_listing_status() ganha as transicoes novas de Etapa 2/3
--    e um parametro p_reason_category (nullable, nao quebra os 40+ pontos
--    de chamada existentes que nao o passam).
-- 2) cm_status_transitions e cm_bids ganham reason_category / motivo
--    estruturado de declinio -- nunca mais texto livre solto via
--    window.prompt(), agora uma lista fixa validada no servidor.

alter table public.cm_status_transitions
  add column if not exists reason_category text;

alter table public.cm_bids
  add column if not exists decline_reason_category text,
  add column if not exists reason text;

comment on column public.cm_status_transitions.reason_category is
  'Categoria fixa do motivo de reprovacao/restricao (Fase 5, 19/09/2026): cedente_nao_aceita_carta_v3, mandatario_desconhecido, vendido_outro_escritorio, ausencia_homologacao, falta_clareza_documental, outros. Alimenta relatorio de gargalos, nunca texto livre solto.';
comment on column public.cm_bids.decline_reason_category is
  'Categoria fixa do motivo de recusa de proposta (Fase 5, 19/09/2026): preco_fora_mercado, outros. Preco fora de mercado nunca reprova o ativo, so a proposta -- ver logica de reversao automatica em app/api/cm/bids/[id]/route.ts.';
comment on column public.cm_bids.reason is
  'Texto livre complementar ao decline_reason_category, alimenta relatorio de KPI/After Action Review.';

create or replace function public.transition_cm_listing_status(
  p_listing_id uuid,
  p_new_status cm_listing_status,
  p_reason text default null::text,
  p_user_id uuid default null::uuid,
  p_reason_category text default null::text
)
returns boolean
language plpgsql
as $function$
declare
  v_current cm_listing_status;
  v_listing cm_asset_listings%rowtype;
  v_valid boolean := false;
begin
  select * into v_listing from cm_asset_listings where id = p_listing_id for update;
  if not found then return false; end if;

  v_current := v_listing.listing_status;

  v_valid := case
    when v_current = 'reuniao_validada'       and p_new_status = 'formulario_preenchido' then true
    -- Etapa 2 (Fase 5, 19/09/2026): reuniao passa a disparar automaticamente
    -- assim que o intake fecha, nao mais so apos a qualificacao terminar.
    when v_current = 'formulario_preenchido'  and p_new_status = 'reuniao_agendada'       then true
    -- Mesa confirma manualmente que a reuniao aconteceu, dispara os lotes de
    -- qualificacao das partes (Etapa 3).
    when v_current = 'reuniao_agendada'       and p_new_status = 'em_qualificacao'        then true
    when v_current = 'em_qualificacao'        and p_new_status = 'nda_assinado'           then v_listing.nda_signed_at is not null
    when v_current = 'nda_assinado'           and p_new_status = 'em_analise'             then true
    when v_current = 'em_analise'             and p_new_status = 'aprovado_head'          then v_listing.head_approved_by is not null
    when v_current = 'em_analise'             and p_new_status = 'aprovado_com_restricoes' then
      v_listing.head_approved_by is not null and p_reason is not null and length(trim(p_reason)) > 0
    when v_current in ('formulario_preenchido', 'reuniao_agendada', 'em_qualificacao', 'nda_assinado', 'em_analise')
         and p_new_status = 'reprovado' then
      p_reason is not null and length(trim(p_reason)) > 0 and p_reason_category is not null
    when v_current = 'aprovado_head'          and p_new_status = 'ativo_vitrine'         then true
    when v_current = 'aprovado_com_restricoes' and p_new_status = 'ativo_vitrine'        then true
    when v_current = 'ativo_vitrine'          and p_new_status = 'proposta_recebida'     then true
    -- Fase 5 (19/09/2026): recusar a ultima proposta pendente de um ativo
    -- devolve ele pra vitrine, nunca reprova nem exclui -- ver app/api/cm/bids/[id]/route.ts.
    when v_current = 'proposta_recebida'      and p_new_status = 'ativo_vitrine'         then true
    when v_current = 'proposta_recebida'      and p_new_status = 'em_escrow_due_diligence' then true
    when v_current = 'em_escrow_due_diligence' and p_new_status = 'liquidado'            then true
    when p_new_status = 'cancelado' then true
    when p_new_status = 'expirado'  then true
    else false
  end;

  if not v_valid then return false; end if;

  update cm_asset_listings
  set listing_status = p_new_status, updated_at = now()
  where id = p_listing_id;

  insert into cm_status_transitions (listing_id, from_status, to_status, reason, reason_category, changed_by)
  values (p_listing_id, v_current, p_new_status, p_reason, p_reason_category, p_user_id);

  return true;
end;
$function$;
