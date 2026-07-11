-- ============================================================
-- MIGRATION: Campos de vitrine publica + vistoria para "imovel" (Bolsa de Ativos)
-- Date: 2026-07-11
-- Scope: Fase 1 da Bolsa de Grandes Ativos Imobiliarios e Alternativos.
--        Deve rodar APOS 20260711_cm_asset_type_add_imovel.sql ja commitada
--        (referencia o valor de enum 'imovel' em WHERE/CASE).
--        Aplicada em producao via mcp__plugin_supabase_supabase__apply_migration.
-- Rollback:
--   DROP VIEW IF EXISTS cm_vitrine_publica_imoveis;
--   ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS allow_public_listing;
--   ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS public_gallery;
--   ALTER TABLE cm_asset_listings DROP COLUMN IF EXISTS inspection_requests;
--   -- reverter generate_cm_anonymous_id para a versao sem o case 'imovel'
--   -- (ver 20260619_cm_marketplace_foundation.sql, secao 15)
-- ============================================================

ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS allow_public_listing boolean NOT NULL DEFAULT false;
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS public_gallery jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE cm_asset_listings ADD COLUMN IF NOT EXISTS inspection_requests jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN cm_asset_listings.allow_public_listing IS 'Opt-in explicito da Mesa para exibir este ativo na vitrine publica sem login (/bolsa/imoveis). Default false — nunca publico por acidente. Independente de listing_status.';
COMMENT ON COLUMN cm_asset_listings.public_gallery IS 'Array de midias higienizadas (sem marca dagua, logotipo ou identificador fisico) para a landing page publica do ativo. Formato: [{storage_path, caption, order}].';
COMMENT ON COLUMN cm_asset_listings.inspection_requests IS 'Fila de pedidos de vistoria tecnica feitos por compradores na landing page publica. Cada item: {id, buyer_name, buyer_email, buyer_phone, requested_at, nda_accepted_at, ncnd_accepted_at, proof_of_funds_status (pendente|em_analise|aprovado|rejeitado), proof_of_funds_document_url, approved_by, approved_at, scheduled_at, status}. Agendamento so pode ser confirmado pela Mesa quando proof_of_funds_status = aprovado — trava manual, sem motor automatizado de KYC financeiro nesta fase.';

-- Classe "imovel" no gerador de ID anonimo (CM-IM-{REGIAO}-NNNN)
CREATE OR REPLACE FUNCTION generate_cm_anonymous_id(
  p_asset_type cm_asset_type,
  p_esfera text DEFAULT 'FED'
) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_type_code text;
  v_esfera_code text;
  v_seq int;
  v_id text;
BEGIN
  v_type_code := CASE p_asset_type
    WHEN 'precatorio' THEN 'PR'
    WHEN 'direito_creditorio' THEN 'DC'
    WHEN 'cgi' THEN 'CG'
    WHEN 'cri' THEN 'CR'
    WHEN 'fidc' THEN 'FI'
    WHEN 'imovel' THEN 'IM'
    ELSE 'OT'
  END;

  v_esfera_code := CASE UPPER(COALESCE(p_esfera, 'FED'))
    WHEN 'FEDERAL' THEN 'FED'
    WHEN 'ESTADUAL' THEN 'EST'
    WHEN 'MUNICIPAL' THEN 'MUN'
    ELSE UPPER(LEFT(COALESCE(p_esfera, 'FED'), 3))
  END;

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(anonymous_id, '^CM-[A-Z]{2}-[A-Z]{3}-', ''), '')::int
  ), 0) + 1
  INTO v_seq
  FROM cm_asset_listings
  WHERE anonymous_id LIKE 'CM-' || v_type_code || '-' || v_esfera_code || '-%';

  v_id := 'CM-' || v_type_code || '-' || v_esfera_code || '-' || LPAD(v_seq::text, 4, '0');
  RETURN v_id;
END;
$$;

-- View publica anonimizada, EXCLUSIVA para a vitrine sem login de imoveis/alternativos.
-- Nunca expoe seller_name, seller_cpf_cnpj, numero_processo, ente_devedor.
-- So mostra listings com opt-in explicito (allow_public_listing = true).
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
  listing_status,
  created_at
FROM cm_asset_listings
WHERE asset_type = 'imovel'
  AND allow_public_listing = true
  AND listing_status IN ('ativo_vitrine', 'proposta_recebida')
  AND deleted_at IS NULL;

COMMENT ON VIEW cm_vitrine_publica_imoveis IS 'View publica anonimizada e sem autenticacao para /api/public/bolsa/imoveis. Distinta de cm_vitrine_public (que exige sessao e serve a Mesa de Capitais inteira). Exclui todo dado de vendedor/processo.';
