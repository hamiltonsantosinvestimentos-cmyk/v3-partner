-- ============================================================
-- MIGRATION: Email na trilha de auditoria por documento (Deal Room) — Bolsa de Ativos
-- Date: 2026-07-08
-- Scope: cm_deal_room_document_views.buyer_email
-- Rollback: ALTER TABLE cm_deal_room_document_views DROP COLUMN IF EXISTS buyer_email;
-- ============================================================

ALTER TABLE cm_deal_room_document_views ADD COLUMN IF NOT EXISTS buyer_email text;
COMMENT ON COLUMN cm_deal_room_document_views.buyer_email IS 'Email do visualizador no momento do download, junto com CPF e IP — trilha de auditoria completa.';
