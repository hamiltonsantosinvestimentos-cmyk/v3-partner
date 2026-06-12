-- ═══════════════════════════════════════════════════════
--  market_benchmarks — seed B3 BGI (Boi Gordo) + unique index
--  Habilita upsert idempotente por (sector, sub_sector, benchmark_key)
-- ═══════════════════════════════════════════════════════

-- A coluna value/description usadas no INSERT abaixo correspondem a
-- value_numeric/benchmark_label (schema real de 20260609_market_benchmarks.sql).

-- ON CONFLICT requer índice único — o índice existente é não-único.
DROP INDEX IF EXISTS idx_mb_sector_subkey;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mb_sector_subkey_unique
  ON market_benchmarks(sector, sub_sector, benchmark_key)
  WHERE valid_until IS NULL;

-- ───────────────────────────────────────────────────────
--  SEED: B3 BGI — Indicador CEPEA/B3 Boi Gordo
--  Referência de liquidação financeira do contrato futuro BGI (R$/@)
-- ───────────────────────────────────────────────────────
INSERT INTO market_benchmarks
  (sector, sub_sector, benchmark_key, benchmark_label, value_numeric, unit, source)
VALUES
  ('agronegocio','genetica_bovina','preco_arroba_boi_gordo_rs',
   'Preço arroba Boi Gordo — indicador CEPEA/B3 SP (R$/@), referência de liquidação do contrato futuro BGI',
   346.00, 'BRL/@', 'CEPEA_B3_SP_20260611')
ON CONFLICT (sector, sub_sector, benchmark_key) WHERE valid_until IS NULL
DO UPDATE SET
  value_numeric   = EXCLUDED.value_numeric,
  benchmark_label = EXCLUDED.benchmark_label,
  source          = EXCLUDED.source,
  updated_at      = now();

-- ───────────────────────────────────────────────────────
--  ROLLBACK
-- ───────────────────────────────────────────────────────
-- DELETE FROM market_benchmarks
--   WHERE sector = 'agronegocio' AND sub_sector = 'genetica_bovina'
--     AND benchmark_key = 'preco_arroba_boi_gordo_rs';
-- DROP INDEX IF EXISTS idx_mb_sector_subkey_unique;
-- CREATE INDEX IF NOT EXISTS idx_mb_sector_subkey
--   ON market_benchmarks(sector, sub_sector, benchmark_key)
--   WHERE valid_until IS NULL;
