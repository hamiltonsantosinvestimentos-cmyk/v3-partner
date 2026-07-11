-- ============================================================
-- MIGRATION: Switcher de Teses Narrativas Treinadas (Bolsa de Ativos)
-- Date: 2026-07-11
-- Scope: Fase 3 da Bolsa de Grandes Ativos Imobiliarios e Alternativos.
--        Aplicada em producao via mcp__plugin_supabase_supabase__apply_migration.
-- Rollback:
--   ALTER TABLE cm_asset_listings DROP CONSTRAINT IF EXISTS cm_asset_listings_thesis_check;
--   ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS selected_thesis_template;
--   ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS public_narrative;
--   ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS public_narrative_generated_at;
-- ============================================================

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS selected_thesis_template text;
ALTER TABLE cm_asset_listings DROP CONSTRAINT IF EXISTS cm_asset_listings_thesis_check;
ALTER TABLE cm_asset_listings ADD CONSTRAINT cm_asset_listings_thesis_check
  CHECK (selected_thesis_template IS NULL OR selected_thesis_template IN ('despacho_imediato', 'rendimento_longo_prazo', 'retrofit_incorporacao'));

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS public_narrative text;
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS public_narrative_generated_at timestamptz;

COMMENT ON COLUMN cm_asset_listings.selected_thesis_template IS 'Matriz de tese pre-treinada selecionada pelo operador: despacho_imediato | rendimento_longo_prazo | retrofit_incorporacao. Reconfigura o system prompt do Claude na geracao de narrativa e no Chat IA do ativo (Fase 3).';
COMMENT ON COLUMN cm_asset_listings.public_narrative IS 'Narrativa comercial gerada com base na tese selecionada, exibida na landing page publica (/bolsa/imoveis/[id]). Passa pelo Gate Brand Guardian antes de ser salva.';
