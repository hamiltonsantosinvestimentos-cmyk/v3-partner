-- ============================================================
-- MIGRATION: UF/Municipio do ente devedor + valor minimo de fracionamento (Bolsa de Ativos)
-- Date: 2026-07-08
-- Scope: cm_asset_listings.uf_ente_devedor, .municipio_ente_devedor, .tranche_valor_minimo
-- Rollback: ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS uf_ente_devedor;
--           ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS municipio_ente_devedor;
--           ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS tranche_valor_minimo;
-- ============================================================

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS uf_ente_devedor text;
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS municipio_ente_devedor text;
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS tranche_valor_minimo numeric;

COMMENT ON COLUMN cm_asset_listings.uf_ente_devedor IS 'UF (estado) do ente devedor, estruturado para filtro de jurisdicao no matchmaking.';
COMMENT ON COLUMN cm_asset_listings.municipio_ente_devedor IS 'Municipio do ente devedor (buscado via API IBGE no momento do cadastro).';
COMMENT ON COLUMN cm_asset_listings.tranche_valor_minimo IS 'Valor minimo aceito por fracao quando allows_tranching=true. Usado para impedir fracionamento abaixo do ticket minimo da Mesa.';
