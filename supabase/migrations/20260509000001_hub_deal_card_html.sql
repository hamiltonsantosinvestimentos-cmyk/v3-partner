-- Migration: Hub V3 — deal_card_html em deal_intakes
-- 2026-05-09

BEGIN;

ALTER TABLE deal_intakes
  ADD COLUMN IF NOT EXISTS deal_card_html TEXT;

COMMENT ON COLUMN deal_intakes.deal_card_html IS
  'HTML completo do deal card gerado pelo n8n W2. Exibido no Hub /hub do portal V3.';

COMMIT;
