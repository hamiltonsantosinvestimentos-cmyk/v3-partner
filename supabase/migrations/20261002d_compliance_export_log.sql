-- 20261002d: registro append-only de exportações da Auditoria de acessos (Compliance, só ADMIN).
-- Quem exportou, quando, filtros e nº de linhas. Gravado pelo servidor com await ANTES do arquivo.
-- Reutiliza cm_append_only_strict() (20261002b). Sem dado de titular. Retenção: 36 meses (a definir a rotina).
-- Rollback: drop table public.cm_compliance_export_log;
create table if not exists public.cm_compliance_export_log (
  id          uuid primary key default gen_random_uuid(),
  exported_at timestamptz not null default now(),
  exported_by uuid references public.profiles(id),
  filters     jsonb not null default '{}'::jsonb,
  row_count   integer not null check (row_count >= 0),
  truncated   boolean not null default false
);
alter table public.cm_compliance_export_log enable row level security;
revoke all on public.cm_compliance_export_log from anon, authenticated;
create trigger trg_cm_compliance_export_log_append_only
  before update or delete on public.cm_compliance_export_log
  for each row execute function public.cm_append_only_strict();
