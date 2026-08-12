-- ============================================================
-- MIGRATION: ClickSign - document_id para cancelamento automatico
-- Date: 2026-08-11
-- Scope: Fase 1 do ciclo ClickSign (cancelamento automatico de envelope
-- pendente ao editar contrato ja enviado). A API v3 cancela no nivel do
-- DOCUMENTO dentro do envelope, nao no envelope em si:
-- PATCH /envelopes/{envelope_id}/documents/{document_id}, attributes.status
-- = "canceled". operation_contracts so guardava external_envelope_id ate
-- hoje; o document_id interno era descartado depois de criar o envelope
-- (lib/clicksign.ts, sendToClickSignV3).
--
-- Rollback:
--   ALTER TABLE operation_contracts DROP COLUMN IF EXISTS external_document_id;
-- ============================================================

ALTER TABLE operation_contracts ADD COLUMN IF NOT EXISTS external_document_id text;

COMMENT ON COLUMN operation_contracts.external_document_id IS 'ID do documento dentro do envelope ClickSign (data.id do POST /envelopes/{id}/documents), usado para cancelar via PATCH /envelopes/{id}/documents/{document_id} quando o contrato e editado apos ja ter sido enviado para assinatura. Diferente de external_envelope_id, que identifica o envelope inteiro.';
