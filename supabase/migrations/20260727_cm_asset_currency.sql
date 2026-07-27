-- ============================================================
-- MIGRATION: Moeda do ativo (BRL/USD/EUR) — Bolsa de Ativos
-- Date: 2026-07-27
-- Scope: cm_asset_listings.currency
-- Rollback: ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS currency;
-- ============================================================

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cm_asset_listings_currency_check'
  ) THEN
    ALTER TABLE cm_asset_listings
      ADD CONSTRAINT cm_asset_listings_currency_check CHECK (currency IN ('BRL', 'USD', 'EUR'));
  END IF;
END $$;

COMMENT ON COLUMN cm_asset_listings.currency IS 'Moeda do ativo (BRL/USD/EUR). Default BRL preserva o comportamento de todos os ativos existentes. Define a simbolizacao e mascara aplicadas na Mesa e na Vitrine.';
