-- ============================================================
-- MIGRATION: Identificacao por nome — apelido + numero interno (Bolsa de Ativos)
-- Date: 2026-07-07
-- Scope: cm_asset_listings.apelido + cm_asset_listings.numero_interno
-- Rollback: ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS apelido;
--           ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS numero_interno;
-- ============================================================

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS apelido text;
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS numero_interno text;

COMMENT ON COLUMN cm_asset_listings.apelido IS 'Apelido/nome curto atribuido pela Mesa para identificar o credito no dia a dia (ex: "Tunep"). Nunca substitui anonymous_id — e complementar, editavel a qualquer momento.';
COMMENT ON COLUMN cm_asset_listings.numero_interno IS 'Numero de referencia interno da Mesa para o credito, independente do codigo anonymous_id gerado pelo sistema.';
