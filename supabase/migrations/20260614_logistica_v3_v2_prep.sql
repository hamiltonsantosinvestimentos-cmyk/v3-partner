-- ═══════════════════════════════════════════════════════
--  Logística V3 — V2 Prep
--  Normalização IATA (Voos) + soft delete + retenção de
--  histórico de preço para automação futura via n8n + Amadeus
--  Aditivo e idempotente — não altera dados existentes (0 rows)
-- ═══════════════════════════════════════════════════════

-- 1. Códigos IATA normalizados (origem/destino) — uso em Voos
ALTER TABLE logistics_items
  ADD COLUMN IF NOT EXISTS origin_iata      varchar(3),
  ADD COLUMN IF NOT EXISTS destination_iata varchar(3);

ALTER TABLE logistics_items
  DROP CONSTRAINT IF EXISTS logistics_items_iata_format_check;

ALTER TABLE logistics_items
  ADD CONSTRAINT logistics_items_iata_format_check
  CHECK (
    category <> 'voo'
    OR (
      (origin_iata      IS NULL OR origin_iata      ~ '^[A-Z]{3}$')
      AND
      (destination_iata IS NULL OR destination_iata ~ '^[A-Z]{3}$')
    )
  );

-- 2. Soft delete — preserva o item para retenção de série histórica
ALTER TABLE logistics_items
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Índice parcial: itens ativos por categoria (consultas de polling V2)
CREATE INDEX IF NOT EXISTS idx_logistics_items_active
  ON logistics_items(category)
  WHERE deleted_at IS NULL;

-- 3. Retenção de logistics_price_history — defesa em profundidade.
--    Soft delete (item 2) já evita DELETE via API; troca de
--    ON DELETE CASCADE → SET NULL impede perda de série histórica
--    mesmo em uma remoção manual via SQL.
ALTER TABLE logistics_price_history
  ALTER COLUMN item_id DROP NOT NULL;

ALTER TABLE logistics_price_history
  DROP CONSTRAINT IF EXISTS logistics_price_history_item_id_fkey;

ALTER TABLE logistics_price_history
  ADD CONSTRAINT logistics_price_history_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES logistics_items(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════
--  ROLLBACK (não executar automaticamente — referência manual)
-- ═══════════════════════════════════════════════════════
-- ALTER TABLE logistics_price_history DROP CONSTRAINT IF EXISTS logistics_price_history_item_id_fkey;
-- ALTER TABLE logistics_price_history ADD CONSTRAINT logistics_price_history_item_id_fkey
--   FOREIGN KEY (item_id) REFERENCES logistics_items(id) ON DELETE CASCADE;
-- ALTER TABLE logistics_price_history ALTER COLUMN item_id SET NOT NULL;
-- DROP INDEX IF EXISTS idx_logistics_items_active;
-- ALTER TABLE logistics_items DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE logistics_items DROP CONSTRAINT IF EXISTS logistics_items_iata_format_check;
-- ALTER TABLE logistics_items DROP COLUMN IF EXISTS origin_iata, DROP COLUMN IF EXISTS destination_iata;
