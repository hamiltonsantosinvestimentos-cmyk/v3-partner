-- Comissão do mandato por tranche paga (27/10/2026).
-- Antes: 1 comissão de crédito do licenciado por proposta (gerada ao liberar o recurso, sobre
-- mandato + instituição). Agora: na liberação nasce só a parte da instituição, e a parte do
-- mandato nasce em cada tranche quando a Mesa marca "Comissão paga pelo cliente".
-- operation_ref distingue as comissões da mesma proposta: NULL = liberação (instituição),
-- 'mandato:<id da tranche>' = mandato daquela tranche. Rodar no SQL Editor do Supabase.

alter table public.commissions add column if not exists operation_ref text;

drop index if exists public.uq_commissions_credito_licenciado;
create unique index if not exists uq_commissions_credito_licenciado
  on public.commissions (operation_id, coalesce(operation_ref, ''))
  where operation_type = 'CREDITO'
    and is_referral_commission = false
    and operation_id is not null;
