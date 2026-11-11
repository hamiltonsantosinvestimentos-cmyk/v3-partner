-- Análise jurídica do cadastro de partner (CheckTudo, Dossiê Jurídico Resumido).
-- BRIEF docs/briefs/2026-11-10_analise-juridica-cadastro-partner.md
-- Histórico das consultas pagas: só a service role (rota ADMIN) acessa. RLS ligada, sem política,
-- revoke de anon/authenticated. Somente inclusão (sem update, delete nem truncate).
-- Guarda só o documento mascarado e os 5 totais; o dossiê bruto do CheckTudo não é gravado.

create table if not exists public.partner_registration_juridico (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.partner_registrations(id) on delete restrict,
  doc_tipo text not null check (doc_tipo in ('cpf', 'cnpj')),
  doc_mascarado text not null,
  escopo text not null check (escopo in ('PJ_PF', 'PF', 'PJ')),
  ok boolean not null,
  resultado jsonb,
  erro text,
  consultado_por uuid references public.profiles(id),
  consultado_por_nome text,
  consultado_em timestamptz not null default now()
);

create index if not exists partner_registration_juridico_reg_idx
  on public.partner_registration_juridico (registration_id, consultado_em desc);

alter table public.partner_registration_juridico enable row level security;
revoke all on public.partner_registration_juridico from anon, authenticated;

create or replace function public.partner_registration_juridico_somente_inclusao()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'partner_registration_juridico é somente inclusão (histórico de consultas pagas)';
end $$;
revoke all on function public.partner_registration_juridico_somente_inclusao() from public, anon, authenticated;

drop trigger if exists partner_registration_juridico_somente_inclusao on public.partner_registration_juridico;
create trigger partner_registration_juridico_somente_inclusao
  before update or delete on public.partner_registration_juridico
  for each row execute function public.partner_registration_juridico_somente_inclusao();

drop trigger if exists partner_registration_juridico_sem_truncate on public.partner_registration_juridico;
create trigger partner_registration_juridico_sem_truncate
  before truncate on public.partner_registration_juridico
  for each statement execute function public.partner_registration_juridico_somente_inclusao();

comment on table public.partner_registration_juridico is
  'Histórico das análises jurídicas (CheckTudo, querycode 200) dos cadastros de partner. Só a service role acessa (rota ADMIN). Somente inclusão. BRIEF 2026-11-10_analise-juridica-cadastro-partner.';
