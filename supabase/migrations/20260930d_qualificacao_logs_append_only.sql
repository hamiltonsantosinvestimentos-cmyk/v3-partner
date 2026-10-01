-- =============================================================================
-- LOG APPEND-ONLY DE REVELACAO DE DADO SENSIVEL (BRIEF 30/09/2026, Fase 1A)
-- =============================================================================
-- cm_party_qualification_field_views: quem revelou qual dado sensivel na ficha da Mesa
-- (regra 3.2 do QA de governanca). Gravado no servidor com await ANTES de devolver o dado;
-- se a gravacao falhar, o dado nao e revelado.
--
-- Append-only: sem UPDATE e sem DELETE, garantido por trigger (nao so por ausencia de policy,
-- porque a service role bypassa RLS). A chave estrangeira NAO tem exclusao em cascata. Unica
-- excecao: a sessao que define `set local app.cm_log_cleanup = 'on'` pode apagar, para limpeza
-- de registro ZZTEST de teste. Funcao SEM security definer (nao precisa), com search_path fixo.
--
-- A declaracao do representante legal de menor (log proprio e funcoes atomicas) NAO esta aqui:
-- e a sub-entrega 1D, com especificacao propria (BRIEF 5.17). A funcao cm_append_only() abaixo e
-- generica e sera reaproveitada la.
--
-- Rollback (rodar manualmente): remover a tabela cm_party_qualification_field_views e a funcao
-- cm_append_only().
-- =============================================================================

create or replace function public.cm_append_only()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.cm_log_cleanup', true), '') = 'on' then
    return old;
  end if;
  raise exception 'tabela % e append-only: % nao permitido', tg_table_name, tg_op;
end;
$$;

create table if not exists public.cm_party_qualification_field_views (
  id               uuid primary key default gen_random_uuid(),
  qualification_id uuid not null references public.cm_party_qualifications(id),
  field            text not null,
  viewed_by        uuid,
  viewed_at        timestamptz not null default now(),
  ip               text
);
create index if not exists idx_cm_pq_field_views_qualification
  on public.cm_party_qualification_field_views(qualification_id);

alter table public.cm_party_qualification_field_views enable row level security;
revoke all on public.cm_party_qualification_field_views from anon, authenticated;

drop trigger if exists trg_cm_pq_field_views_append_only on public.cm_party_qualification_field_views;
create trigger trg_cm_pq_field_views_append_only
  before update or delete on public.cm_party_qualification_field_views
  for each row execute function public.cm_append_only();

comment on table public.cm_party_qualification_field_views is
  'Log append-only de revelacao de dado sensivel na ficha da Mesa (CPF, identidade, passaporte). Retencao a definir com o Robson.';
