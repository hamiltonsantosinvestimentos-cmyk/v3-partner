-- Migration: business_plan_engine_jsonb_contract
-- Documental/defensiva — não altera estrutura de tabelas (segue padrão JSONB de
-- ma_deals.asset_data, mesmo contrato de financial_projections/forja_result/teaser_cego).
-- Idempotente — segura para reexecução.

COMMENT ON COLUMN ma_deals.asset_data IS
  'JSONB rico do ativo. Sub-campos documentados: financial_projections (dados financeiros '
  'estruturados por setor — fonte única de verdade numérica), business_plan (narrativa '
  'gerada pelo Business Plan Engine sobre financial_projections — nunca calcula, apenas '
  'narra; ver docs/specs/2026-06-business-plan-engine.md), forja_result, teaser_cego, '
  'tese_investimento.';

-- CONCURRENTLY omitido: apply_migration executa em transação (incompatível).
CREATE INDEX IF NOT EXISTS idx_ma_deals_has_financial_projections
  ON ma_deals USING gin ((asset_data -> 'financial_projections'))
  WHERE asset_data ? 'financial_projections';

CREATE INDEX IF NOT EXISTS idx_ma_deals_sector_lower
  ON ma_deals (lower(sector));

-- ROLLBACK:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_ma_deals_sector_lower;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_ma_deals_has_financial_projections;
-- COMMENT ON COLUMN ma_deals.asset_data IS NULL;
