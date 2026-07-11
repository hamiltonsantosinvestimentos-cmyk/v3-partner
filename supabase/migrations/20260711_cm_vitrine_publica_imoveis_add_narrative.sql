-- ============================================================
-- MIGRATION: public_narrative exposta na vitrine publica de imoveis
-- Date: 2026-07-11
-- Scope: Fase 3. Recria cm_vitrine_publica_imoveis (criada na Fase 1) para
--        incluir a coluna public_narrative (adicionada nesta mesma fase),
--        usada pela landing page publica /bolsa/imoveis/[id].
--        Aplicada em producao via mcp__plugin_supabase_supabase__apply_migration.
-- Rollback: recriar a view sem a coluna public_narrative — ver
--           20260711_cm_imovel_vitrine_publica_fields.sql.
-- ============================================================

DROP VIEW IF EXISTS cm_vitrine_publica_imoveis;
CREATE VIEW cm_vitrine_publica_imoveis AS
SELECT
  id,
  anonymous_id,
  asset_type,
  uf_ente_devedor AS uf,
  municipio_ente_devedor AS municipio,
  natureza,
  valor_face,
  valor_atualizado,
  risk_score,
  public_gallery,
  public_narrative,
  listing_status,
  created_at
FROM cm_asset_listings
WHERE asset_type = 'imovel'
  AND allow_public_listing = true
  AND listing_status IN ('ativo_vitrine', 'proposta_recebida')
  AND deleted_at IS NULL;

COMMENT ON VIEW cm_vitrine_publica_imoveis IS 'View publica anonimizada e sem autenticacao para /api/public/bolsa/imoveis. Distinta de cm_vitrine_public (que exige sessao e serve a Mesa de Capitais inteira). Exclui todo dado de vendedor/processo.';
