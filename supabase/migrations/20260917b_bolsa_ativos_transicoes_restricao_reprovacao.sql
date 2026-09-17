-- ============================================================
-- MIGRATION: transicoes de aprovado_com_restricoes / reprovado
-- Date: 2026-09-17
-- Scope: continuacao de 20260917a. Precisa vir em migration separada
-- porque ALTER TYPE ADD VALUE nao pode ser usado na mesma transacao
-- em que uma funcao passa a referenciar o valor novo.
--
-- Regras de transicao (BRIEF aprovado por Joao 17/09/2026):
--   em_analise -> aprovado_com_restricoes: mesma autoridade de
--     aprovado_head (head_approved_by obrigatorio, setado pela rota
--     PATCH /status), com o texto de restricao obrigatorio em p_reason.
--   aprovado_com_restricoes -> ativo_vitrine: segue igual a
--     aprovado_head -> ativo_vitrine, o ativo publica com a restricao
--     visivel no historico (cm_status_transitions.reason).
--   {formulario_preenchido, nda_assinado, em_analise} -> reprovado:
--     reprovar pode acontecer em qualquer etapa anterior a publicacao
--     (nao so apos due diligence completa), sempre com justificativa
--     obrigatoria em p_reason. Nao head-only na rota (ADMIN/GESTAO/
--     MESA_OPERACIONAL) -- decisao de nao elevar reprovacao ao mesmo
--     nivel de autoridade de aprovacao, ja que rejeitar tem risco menor
--     que aprovar.
--
-- Rollback: reverter para a definicao anterior desta funcao (ver
-- supabase/migrations/20260619_cm_marketplace_foundation.sql, secao 16).
-- ============================================================

create or replace function public.transition_cm_listing_status(
  p_listing_id uuid,
  p_new_status cm_listing_status,
  p_reason text default null,
  p_user_id uuid default null
) returns boolean
language plpgsql as $$
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
    when v_current = 'formulario_preenchido'  and p_new_status = 'nda_assinado'          then v_listing.nda_signed_at is not null
    when v_current = 'nda_assinado'           and p_new_status = 'em_analise'            then true
    when v_current = 'em_analise'             and p_new_status = 'aprovado_head'         then v_listing.head_approved_by is not null
    when v_current = 'em_analise'             and p_new_status = 'aprovado_com_restricoes' then
      v_listing.head_approved_by is not null and p_reason is not null and length(trim(p_reason)) > 0
    when v_current in ('formulario_preenchido', 'nda_assinado', 'em_analise') and p_new_status = 'reprovado' then
      p_reason is not null and length(trim(p_reason)) > 0
    when v_current = 'aprovado_head'          and p_new_status = 'ativo_vitrine'         then true
    when v_current = 'aprovado_com_restricoes' and p_new_status = 'ativo_vitrine'        then true
    when v_current = 'ativo_vitrine'          and p_new_status = 'proposta_recebida'     then true
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

  insert into cm_status_transitions (listing_id, from_status, to_status, reason, changed_by)
  values (p_listing_id, v_current, p_new_status, p_reason, p_user_id);

  return true;
end;
$$;
