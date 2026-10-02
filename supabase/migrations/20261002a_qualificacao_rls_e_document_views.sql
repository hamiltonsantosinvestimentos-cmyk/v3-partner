-- =============================================================================
-- 20261002a: Fase 1C passo 1 (BRIEF 30/09/2026, seção 5.12 D). NAO APLICAR antes do registro
-- escrito do parecer do Robson (condição de execução do BRIEF).
--
-- 1) RLS: remove SELECT e INSERT do `authenticated` em cm_party_qualifications. A policy de SELECT
--    deixava ADMIN, GESTAO e MESA_OPERACIONAL lerem CPF, RG e identidade direto do navegador, sem
--    log, o que anularia a máscara aplicada no servidor. Conferido em 02/10/2026: todo consumidor
--    real usa a service role. Teste obrigatório com sessão real de cada papel ANTES e DEPOIS
--    (chamada direta e telas: painel de contratos, pendências, bloco NCNDA do comprador).
-- 2) cm_party_qualification_document_views: SELECT do `authenticated` removido (IP do colaborador),
--    document_id passa a ON DELETE SET NULL (remover um anexo não apaga o log antes dos 36 meses),
--    coluna qualification_id (âncora do titular) e backfill.
--
-- Snapshot antes do backfill, a remover em 30 dias corridos (2026-11-01).
--
-- Rollback (manual):
--   create policy cm_party_qual_select on public.cm_party_qualifications for select to authenticated
--     using ((select public.get_user_role()) in ('ADMIN','GESTAO','MESA_OPERACIONAL'));
--   create policy cm_party_qual_insert on public.cm_party_qualifications for insert to authenticated
--     with check ((select public.get_user_role()) in ('ADMIN','GESTAO','MESA_OPERACIONAL'));  -- conferir o texto original em 20260728c
--   create policy cm_party_qual_doc_views_select on public.cm_party_qualification_document_views for select
--     to authenticated using ((select public.get_user_role()) in ('ADMIN','GESTAO','MESA_OPERACIONAL'));
--   restaurar document_id NOT NULL e ON DELETE CASCADE a partir do snapshot; drop da coluna qualification_id.
-- =============================================================================

-- Snapshot da tabela de log de documentos antes de alterar (dado pessoal: IP). RLS ligada, sem acesso público.
create table if not exists public.cm_party_qualification_document_views_bkp_20261002 as
  select * from public.cm_party_qualification_document_views;
alter table public.cm_party_qualification_document_views_bkp_20261002 enable row level security;
revoke all on public.cm_party_qualification_document_views_bkp_20261002 from anon, authenticated;
comment on table public.cm_party_qualification_document_views_bkp_20261002 is
  'Snapshot de 02/10/2026 antes da migration 20261002a. REMOVER em 2026-11-01.';

-- RLS: sem leitura nem escrita direta do navegador.
drop policy if exists cm_party_qual_select on public.cm_party_qualifications;
drop policy if exists cm_party_qual_insert on public.cm_party_qualifications;
drop policy if exists cm_party_qual_doc_views_select on public.cm_party_qualification_document_views;

-- document_views: vínculo que sobrevive à remoção do anexo.
alter table public.cm_party_qualification_document_views alter column document_id drop not null;
alter table public.cm_party_qualification_document_views
  drop constraint if exists cm_party_qualification_document_views_document_id_fkey;
alter table public.cm_party_qualification_document_views
  add constraint cm_party_qualification_document_views_document_id_fkey
  foreign key (document_id) references public.cm_party_qualification_documents(id) on delete set null;

-- Âncora do titular (nullable, sem exclusão em cascata: soft delete é o único caminho de exclusão da qualificação).
alter table public.cm_party_qualification_document_views
  add column if not exists qualification_id uuid references public.cm_party_qualifications(id);
create index if not exists idx_cm_party_qual_doc_views_qualification
  on public.cm_party_qualification_document_views(qualification_id);

-- Backfill: documento -> cliente -> qualificação do cliente. Só quando o cliente tem UMA qualificação
-- (contando as excluídas por soft delete); vínculo ambíguo fica nulo e sai no relatório abaixo.
update public.cm_party_qualification_document_views v
set qualification_id = q.id
from public.cm_party_qualification_documents d
join (
  select v3_client_id, (array_agg(id))[1] as id
  from public.cm_party_qualifications
  where v3_client_id is not null
  group by v3_client_id
  having count(*) = 1
) q on q.v3_client_id = d.v3_client_id
where v.document_id = d.id and v.qualification_id is null;

-- Relatório para João (rodar depois, não faz parte da migration):
--   select count(*) filter (where qualification_id is null) as sem_ancora, count(*) as total
--   from public.cm_party_qualification_document_views;

comment on table public.cm_party_qualification_document_views is
  'Trilha de auditoria de abertura de documento de KYC pela Mesa. Retenção de 36 meses (função cm_purge_access_logs), ver BRIEF 5.12 D. Linhas sem qualification_id só saem pela retenção.';
