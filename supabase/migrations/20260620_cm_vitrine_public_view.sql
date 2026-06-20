-- ============================================================
-- MIGRATION: View anonimizada cm_vitrine_public
-- Date: 2026-06-20
-- Author: DARA via OPTIMUS PRIME
-- Scope: View publica que expoe listings na vitrine SEM dados sensiveis
-- Regra de negocio: NUNCA expor seller_name, seller_cpf_cnpj, numero_processo
-- ============================================================

DROP VIEW IF EXISTS cm_vitrine_public;

CREATE VIEW cm_vitrine_public AS
SELECT
  id,
  anonymous_id,
  asset_type,
  ente_devedor,
  esfera,
  tribunal,
  natureza,
  valor_face,
  valor_atualizado,
  desagio_pretendido,
  tir_estimada,
  vpl,
  prazo_estimado_meses,
  risk_score,
  allows_tranching,
  listing_status,
  created_at
FROM cm_asset_listings
WHERE listing_status IN ('ativo_vitrine', 'proposta_recebida');

COMMENT ON VIEW cm_vitrine_public IS 'View anonimizada para vitrine publica. Exclui seller_name, seller_cpf_cnpj, numero_processo. Filtra apenas listings com status ativo_vitrine ou proposta_recebida.';
