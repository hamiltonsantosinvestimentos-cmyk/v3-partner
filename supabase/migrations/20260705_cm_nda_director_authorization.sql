-- ============================================================
-- MIGRATION: Autorizacao de diretor para NDA retroativo/manual (Bolsa de Ativos)
-- Date: 2026-07-05
-- Scope: cm_asset_listings ganha state machine de autorizacao para marcacao
--        manual de "NDA ja assinado fora do sistema" (deals antigos, cadastro manual)
-- Ja aplicada em producao via mcp__plugin_supabase_supabase__apply_migration
-- ============================================================

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS nda_authorization_status text NOT NULL DEFAULT 'none';
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS nda_authorization_requested_by uuid REFERENCES profiles(id);
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS nda_authorization_requested_at timestamptz;
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS nda_authorized_by uuid REFERENCES profiles(id);
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS nda_authorization_reason text;

ALTER TABLE cm_asset_listings DROP CONSTRAINT IF EXISTS cm_asset_listings_nda_authorization_status_check;
ALTER TABLE cm_asset_listings ADD CONSTRAINT cm_asset_listings_nda_authorization_status_check
  CHECK (nda_authorization_status IN ('none','pending_director','approved','rejected'));

COMMENT ON COLUMN cm_asset_listings.nda_authorization_status IS 'none | pending_director (GESTAO/MESA_OPERACIONAL marcou NDA retroativo, aguarda diretor) | approved | rejected. Nao se aplica ao fluxo digital normal do wizard publico.';
