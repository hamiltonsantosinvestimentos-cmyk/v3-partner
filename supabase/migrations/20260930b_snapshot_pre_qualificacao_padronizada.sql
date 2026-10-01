-- =============================================================================
-- SNAPSHOT ANTES DA PADRONIZACAO DA QUALIFICACAO DE PARTES (BRIEF 30/09/2026, Fase 1A)
-- =============================================================================
-- Regra do projeto: snapshot obrigatorio antes de qualquer migration. Copia das
-- tabelas que as migrations seguintes alteram (cm_party_qualifications e v3_clients).
--
-- CONTEM DADO PESSOAL (CPF, CNPJ, nome, e-mail, endereco). Por isso:
--   - RLS habilitado e nenhum policy: so a service role le (bypassa RLS);
--   - anon e authenticated sem nenhum privilegio;
--   - REMOVER EM 2026-10-30 (30 dias corridos depois da verificacao das migrations).
--
-- Rollback: nada a desfazer aqui (so cria copias). Para restaurar dados de uma das
-- tabelas originais, usar estas copias como fonte.
-- Item 3 da decisao de Joao em 30/09/2026 ("backup com dado pessoal: ok").
-- =============================================================================

create table if not exists public.zz_bak_20260930_cm_party_qualifications as
  select * from public.cm_party_qualifications;

create table if not exists public.zz_bak_20260930_v3_clients as
  select * from public.v3_clients;

alter table public.zz_bak_20260930_cm_party_qualifications enable row level security;
alter table public.zz_bak_20260930_v3_clients enable row level security;

revoke all on public.zz_bak_20260930_cm_party_qualifications from anon, authenticated;
revoke all on public.zz_bak_20260930_v3_clients from anon, authenticated;

comment on table public.zz_bak_20260930_cm_party_qualifications is
  'Snapshot de 30/09/2026 antes da padronizacao da qualificacao. Contem dado pessoal. REMOVER EM 2026-10-30.';
comment on table public.zz_bak_20260930_v3_clients is
  'Snapshot de 30/09/2026 antes da padronizacao da qualificacao. Contem dado pessoal. REMOVER EM 2026-10-30.';
