-- 20261108d: audit_logs só de inclusão (decisão de João em 08/11/2026, achado do QA do B3).
--
-- Estado verificado no banco vivo em 08/11/2026: RLS ligada; leitura só ADMIN; INSERT só service_role;
-- sem trigger de proteção; anon e authenticated com todos os privilégios (inclusive TRUNCATE, que não
-- passa pela RLS); 2.049 linhas. Nenhuma função, cron, view ou trigger do banco, nem o código (32 usos),
-- atualiza ou apaga linhas da tabela.
--
-- O que muda: anon e public perdem tudo; authenticated perde UPDATE, DELETE, TRUNCATE, REFERENCES e
-- TRIGGER (mantém SELECT, restrito pela política a ADMIN, e INSERT, sem efeito porque a política só
-- deixa o service_role inserir); triggers bloqueiam UPDATE, DELETE e TRUNCATE para todos, inclusive a
-- chave de serviço. service_role mantém INSERT e SELECT.
--
-- Rollback: 20261108d_audit_logs_somente_inclusao_rollback.sql.txt

revoke all on table public.audit_logs from anon, public;
revoke update, delete, truncate, references, trigger on table public.audit_logs from authenticated;

create or replace function public.audit_logs_somente_inclusao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'audit_logs é só de inclusão: % bloqueado', tg_op using errcode = '42501';
  return null;
end;
$$;

revoke execute on function public.audit_logs_somente_inclusao() from public, anon, authenticated;

drop trigger if exists audit_logs_bloqueia_update_delete on public.audit_logs;
create trigger audit_logs_bloqueia_update_delete
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_somente_inclusao();

drop trigger if exists audit_logs_bloqueia_truncate on public.audit_logs;
create trigger audit_logs_bloqueia_truncate
  before truncate on public.audit_logs
  for each statement execute function public.audit_logs_somente_inclusao();
