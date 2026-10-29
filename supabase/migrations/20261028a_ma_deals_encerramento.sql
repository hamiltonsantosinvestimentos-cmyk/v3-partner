-- BRIEF 28/10/2026 (Mesa M&A: saneamento, Ganho/Perdido e arrastar), bloco B, seção 4.6.
-- Encerramento de deal (Ganho/Perdido) e mudança de fase com histórico na mesma transação.
-- Colunas novas nullable; nenhuma tabela nova (o histórico usa ma_deal_history, já existente).
-- RLS de ma_deals e ma_deal_history não muda.
-- Rollback: 20261028a_ma_deals_encerramento_rollback.sql.txt

alter table public.ma_deals
  add column if not exists closed_date date,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references public.profiles(id) on delete set null,
  add column if not exists closed_from_stage public.deal_stage,
  add column if not exists closed_reason_category text,
  add column if not exists closed_reason text,
  add column if not exists closed_note text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ma_deals_closed_reason_category_chk') then
    alter table public.ma_deals add constraint ma_deals_closed_reason_category_chk check (
      closed_reason_category is null or closed_reason_category in (
        'cliente_desistiu','concorrencia','documentacao_insuficiente',
        'inviabilidade_financeira','sem_investidor','sem_resposta',
        'valuation_sem_acordo','outro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ma_deals_closed_lost_motivo_chk') then
    alter table public.ma_deals add constraint ma_deals_closed_lost_motivo_chk check (
      stage <> 'CLOSED_LOST'
      or (closed_reason_category is not null and length(trim(coalesce(closed_reason,''))) >= 10));
  end if;
end $$;

-- Mudança de fase e histórico na mesma transação (nenhuma função parecida em pg_proc, conferido em 28/10).
-- Validação de papel, regra de transição e campos fica na rota (PATCH /api/ma-deals); a função só grava.
-- Idempotente: se o deal já está na fase de destino, não grava nada (evento repetido do webhook da ClickSign).
create or replace function public.ma_deal_transition(
  p_deal_id uuid, p_to_stage public.deal_stage, p_changed_by uuid, p_notes text,
  p_fields jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_from public.deal_stage;
begin
  select stage into v_from from ma_deals where id = p_deal_id for update;
  if v_from is null then raise exception 'deal % não encontrado', p_deal_id; end if;
  if v_from = p_to_stage then return; end if;
  update ma_deals set stage = p_to_stage, updated_at = now(),
    probability_percent = coalesce((p_fields->>'probability_percent')::int, probability_percent),
    closed_date = (p_fields->>'closed_date')::date,
    closed_at = (p_fields->>'closed_at')::timestamptz,
    closed_by = (p_fields->>'closed_by')::uuid,
    closed_from_stage = (p_fields->>'closed_from_stage')::public.deal_stage,
    closed_reason_category = p_fields->>'closed_reason_category',
    closed_reason = p_fields->>'closed_reason',
    closed_note = p_fields->>'closed_note'
  where id = p_deal_id;
  insert into ma_deal_history (deal_id, from_stage, to_stage, notes, changed_by)
  values (p_deal_id, v_from, p_to_stage, p_notes, p_changed_by);
end $$;

revoke all on function public.ma_deal_transition(uuid, public.deal_stage, uuid, text, jsonb) from public, anon, authenticated;

comment on column public.ma_deal_clients.status is
  'prospecto, a_performar, performado. Nunca rebaixado automaticamente, exceto na reabertura de deal Ganho por ADMIN (BRIEF 28/10/2026), com o status anterior registrado em ma_deal_history.notes.';
