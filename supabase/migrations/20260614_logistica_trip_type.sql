-- ═══════════════════════════════════════════════════════
--  Logística V3 — Tipo de Viagem (Ida / Ida e volta)
--  Aditivo e idempotente — aplica-se a category = 'voo'
-- ═══════════════════════════════════════════════════════

ALTER TABLE logistics_items
  ADD COLUMN IF NOT EXISTS trip_type text;

ALTER TABLE logistics_items
  DROP CONSTRAINT IF EXISTS logistics_items_trip_type_check;

ALTER TABLE logistics_items
  ADD CONSTRAINT logistics_items_trip_type_check
  CHECK (trip_type IS NULL OR trip_type IN ('ida','ida_e_volta'));

-- Backfill de voos existentes sem tipo definido
UPDATE logistics_items
  SET trip_type = 'ida_e_volta'
  WHERE category = 'voo' AND trip_type IS NULL;

-- ═══════════════════════════════════════════════════════
--  ROLLBACK (não executar automaticamente — referência manual)
-- ═══════════════════════════════════════════════════════
-- ALTER TABLE logistics_items DROP CONSTRAINT IF EXISTS logistics_items_trip_type_check;
-- ALTER TABLE logistics_items DROP COLUMN IF EXISTS trip_type;
