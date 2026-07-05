-- ============================================================
-- MIGRATION: Exclusao de ativos com lixeira (30 dias) + gate de governanca
-- Date: 2026-07-05
-- Scope: soft delete em cm_asset_listings + view cm_vitrine_public atualizada
-- Ja aplicada em producao via mcp__plugin_supabase_supabase__apply_migration
-- ============================================================

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES profiles(id);
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS deletion_reason text;
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS deletion_status text NOT NULL DEFAULT 'none';
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS deletion_requested_by uuid REFERENCES profiles(id);
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz;

ALTER TABLE cm_asset_listings DROP CONSTRAINT IF EXISTS cm_asset_listings_deletion_status_check;
ALTER TABLE cm_asset_listings ADD CONSTRAINT cm_asset_listings_deletion_status_check
  CHECK (deletion_status IN ('none','pending_governance','approved','rejected'));

CREATE INDEX IF NOT EXISTS idx_cm_asset_listings_deleted_at ON cm_asset_listings(deleted_at) WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN cm_asset_listings.deleted_at IS 'Soft delete — quando preenchido, ativo some do Kanban/Vitrine/Matchmaking mas fica na Lixeira por 30 dias.';
COMMENT ON COLUMN cm_asset_listings.deletion_status IS 'none | pending_governance (GESTAO/MESA_OPERACIONAL solicitou, aguarda ADMIN) | approved | rejected';

-- Atualiza a view publica da vitrine para nunca exibir ativo excluido
DROP VIEW IF EXISTS cm_vitrine_public;
CREATE VIEW cm_vitrine_public AS
SELECT
  id, anonymous_id, asset_type, ente_devedor, esfera, tribunal, natureza,
  valor_face, valor_atualizado, desagio_pretendido, tir_estimada, vpl,
  prazo_estimado_meses, risk_score, allows_tranching, listing_status, created_at
FROM cm_asset_listings
WHERE listing_status IN ('ativo_vitrine', 'proposta_recebida')
  AND deleted_at IS NULL;

COMMENT ON VIEW cm_vitrine_public IS 'View anonimizada para vitrine publica. Exclui seller_name, seller_cpf_cnpj, numero_processo e ativos soft-deleted (deleted_at).';
