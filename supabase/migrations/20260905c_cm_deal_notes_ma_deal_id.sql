-- ============================================================
-- MIGRATION: cm_deal_notes ganha deal_id (3a ancora, Mesa M&A)
-- Date: 2026-09-05
-- Scope: aditiva. cm_deal_notes nasceu so para listing_id (Bolsa de Ativos),
-- ganhou demand_id (comprador) em 19/08/2026. Mesmo padrao de "exatamente
-- uma ancora exclusiva" aplicado pela terceira vez, agora para deal_id
-- (Mesa M&A). BRIEF aprovado por Joao em 05/09/2026 ("Go"),
-- 2026-09-05_Operacional_BRIEF-Notas-Internas-Mesa-MA_v1.html.
-- ============================================================

ALTER TABLE cm_deal_notes ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES ma_deals(id) ON DELETE CASCADE;

ALTER TABLE cm_deal_notes DROP CONSTRAINT IF EXISTS cm_deal_notes_listing_ou_demand_check;
ALTER TABLE cm_deal_notes ADD CONSTRAINT cm_deal_notes_listing_ou_demand_ou_deal_check
  CHECK (
    (num_nonnulls(listing_id, demand_id, deal_id) = 1)
  );

COMMENT ON COLUMN cm_deal_notes.deal_id IS
  'Nota interna vinculada a um deal da Mesa M&A (ma_deals). Exatamente um de listing_id/demand_id/deal_id, nunca dois nem nenhum (05/09/2026).';
