-- Pasta Pública: fim do acesso direto de externos (BRIEF docs/briefs/2026-11-24_pasta-publica-acesso-direto-e-listagem.md).
-- Remove as 5 políticas que deixavam quem tem concessão em folder_access_grants ler e gravar direto no bucket
-- v3-docs-publico e ler direto folder_registry, folder_access_grants e document_chunks, por fora das rotas da V3.
-- Ficam só as políticas de ADMIN. As rotas /api/governance/* leem com a chave de serviço e conferem a concessão.
-- Segunda camada: revoke de anon e authenticated nas duas tabelas de pasta (só a chave de serviço as usa).
-- Rollback: 20261125a_pasta_publica_sem_acesso_direto.rollback.sql.txt (texto lido do pg_policies em 24/11/2026;
-- as políticas granted_* não existiam em nenhuma migration do repositório).
begin;

drop policy if exists granted_read_storage on storage.objects;
drop policy if exists granted_write_storage on storage.objects;
drop policy if exists granted_read_registry on public.folder_registry;
drop policy if exists user_read_own_grants on public.folder_access_grants;
drop policy if exists granted_read_chunks on public.document_chunks;

revoke all on public.folder_registry from anon, authenticated;
revoke all on public.folder_access_grants from anon, authenticated;

commit;
