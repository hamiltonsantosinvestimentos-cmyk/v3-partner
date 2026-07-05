-- ROLLBACK: 20260705_cm_asset_soft_delete_governance.sql

DROP VIEW IF EXISTS cm_vitrine_public;
CREATE VIEW cm_vitrine_public AS
SELECT
  id, anonymous_id, asset_type, ente_devedor, esfera, tribunal, natureza,
  valor_face, valor_atualizado, desagio_pretendido, tir_estimada, vpl,
  prazo_estimado_meses, risk_score, allows_tranching, listing_status, created_at
FROM cm_asset_listings
WHERE listing_status IN ('ativo_vitrine', 'proposta_recebida');

ALTER TABLE cm_asset_listings DROP CONSTRAINT IF EXISTS cm_asset_listings_deletion_status_check;
DROP INDEX IF EXISTS idx_cm_asset_listings_deleted_at;
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS deletion_requested_at;
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS deletion_requested_by;
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS deletion_status;
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS deletion_reason;
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS deleted_at;
