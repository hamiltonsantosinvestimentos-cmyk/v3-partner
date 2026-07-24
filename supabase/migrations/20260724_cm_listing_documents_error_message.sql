-- ============================================================
-- MIGRATION: Coluna de erro para documentos da Bolsa de Ativos
-- Date: 2026-07-24
-- Scope: cm_listing_documents.error_message
-- Motivo: W9 (Doc Extract Large) e W-CM-Audio-Intake nao tinham onde
--         gravar a mensagem de erro quando OCR/transcricao falhava,
--         causando falha silenciosa (documento travado sem sinal de erro).
-- Rollback: ALTER TABLE cm_listing_documents DROP COLUMN IF EXISTS error_message;
-- ============================================================

ALTER TABLE cm_listing_documents ADD COLUMN IF NOT EXISTS error_message text;

COMMENT ON COLUMN cm_listing_documents.error_message IS 'Mensagem de erro do W9/W-CM-Audio-Intake quando validation_status = ''erro''. Null quando nao houve falha.';
