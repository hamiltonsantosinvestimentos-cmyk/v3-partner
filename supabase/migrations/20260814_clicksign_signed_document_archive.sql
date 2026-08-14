-- ============================================================
-- MIGRATION: ClickSign - arquivamento automatico do PDF assinado
-- Date: 2026-08-14
-- Scope: Fase 2 do ciclo ClickSign (ver Fase 1, 20260811k). A API v3
-- (envelopes) nao expoe nenhum endpoint de download do documento final
-- assinado (confirmado por pesquisa: nao existe em nenhuma referencia
-- oficial documents/{id}, nem downloads/file_url/signed_file_url; isso so
-- existe na API v1, depreciada). O unico canal real e o Observador de
-- Assinatura (signature_watchers, attach_documents_enabled: true), que
-- entrega o PDF por E-MAIL quando o envelope fecha, nao por webhook.
--
-- Estas colunas guardam onde o poller de e-mail (lib/clicksign-archive.ts,
-- app/api/cron/clicksign-archive) arquivou a copia assinada, uma vez
-- capturada.
--
-- Nota de governanca: a coluna `storage_url` ja existe em operation_contracts
-- (confirmada via types/supabase.ts) mas NAO aparece em nenhuma migration
-- deste repositorio nem e usada em nenhum lugar do codigo -- foi aplicada
-- direto via SQL Editor em algum momento e nunca virou arquivo nem
-- documentacao (mesmo risco ja registrado em v3-numbering-governance.md).
-- Nao reaproveitada aqui de proposito: sem saber a intencao original, usar
-- colunas novas e nomeadas explicitamente e mais seguro que herdar um campo
-- de proposito desconhecido.
--
-- Rollback:
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS signed_document_path;
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS signed_document_archived_at;
-- ============================================================

ALTER TABLE operation_contracts ADD COLUMN IF NOT EXISTS signed_document_path text;
ALTER TABLE operation_contracts ADD COLUMN IF NOT EXISTS signed_document_archived_at timestamptz;

COMMENT ON COLUMN operation_contracts.signed_document_path IS 'Path no bucket Supabase Storage "documents" (contratos-assinados/{id}.pdf) onde o PDF final assinado foi arquivado pelo poller de e-mail do Observador de Assinatura ClickSign. Null enquanto nao capturado.';
COMMENT ON COLUMN operation_contracts.signed_document_archived_at IS 'Timestamp de quando o poller de e-mail capturou e arquivou o PDF assinado, distinto de signed_at (que reflete o evento de assinatura reportado pelo webhook/ClickSign, nao a captura do arquivo).';
