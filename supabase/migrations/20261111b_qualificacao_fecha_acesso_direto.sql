-- 20261111b: fecha o acesso direto (anon e authenticated) as tabelas de qualificacao
-- (BRIEF Trava de Liberacao, secao 4, e politica de sigilo de 31/10/2026: externo nunca acessa o banco).
-- Varredura previa (11/11/2026): nenhum codigo le essas tabelas com o cliente de sessao (teste de CI
-- tests/unit/sigilo-ci.test.ts ampliado), e nenhuma rota passa o cliente de sessao as funcoes de lib.
-- Aplicar: arquivo primeiro, ensaio por perfil em transacao desfeita, depois SQL Editor.
-- Rollback: 20261111b_qualificacao_fecha_acesso_direto_rollback.sql.txt (guarda o estado anterior).
--
-- Estado de partida (consultado em 13/11/2026): anon e authenticated tinham SELECT/INSERT/UPDATE/DELETE
-- em cm_party_qualifications, cm_party_qualification_documents, cm_party_qualification_document_views e
-- cm_qualification_batches. Politicas: documents (select, delete), batches (select, insert, update) para
-- authenticated. field_views, log_erasures e as copias de seguranca ja estavam fechadas.

drop policy if exists cm_party_qual_docs_delete on public.cm_party_qualification_documents;
drop policy if exists cm_party_qual_docs_select on public.cm_party_qualification_documents;
drop policy if exists cm_qual_batches_insert on public.cm_qualification_batches;
drop policy if exists cm_qual_batches_select on public.cm_qualification_batches;
drop policy if exists cm_qual_batches_update on public.cm_qualification_batches;

revoke all on public.cm_party_qualifications from anon, authenticated;
revoke all on public.cm_party_qualification_documents from anon, authenticated;
revoke all on public.cm_party_qualification_document_views from anon, authenticated;
revoke all on public.cm_qualification_batches from anon, authenticated;
